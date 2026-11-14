// Core Double-Entry & Ledger Integrity Service
// Enforces Rule 9 (English comments), Rule 13 (Atomic prisma.$transaction),
// Rule 14 (Decimal precision), and Rule 15 (Strict Consume Invariant)

import prisma from "./prisma.js";
import { toDecimal, addMoney, subMoney, roundMoney } from "./money.js";
import { recordCardUsage } from "./habitEngine.js";

/**
 * Recompute a Party's separate Receivable, Payable, and Net balances from open debt entries
 */
export async function recomputePartyBalances(tx, partyId) {
  const openIncomes = await tx.debtLedgerEntry.findMany({
    where: {
      partyId,
      direction: "INCREASE",
      remainingOpenAmount: { gt: 0 },
    },
  });

  let recTotal = toDecimal(0);
  let payTotal = toDecimal(0);

  for (const entry of openIncomes) {
    const rem = toDecimal(entry.remainingOpenAmount);
    if (entry.entryCategory === "RECEIVABLE") {
      recTotal = addMoney(recTotal, rem);
    } else if (entry.entryCategory === "PAYABLE") {
      payTotal = addMoney(payTotal, rem);
    }
  }

  const netRec = subMoney(recTotal, payTotal);

  return await tx.party.update({
    where: { id: partyId },
    data: {
      receivableBalance: roundMoney(recTotal),
      payableBalance: roundMoney(payTotal),
      netReceivableBalance: roundMoney(netRec),
    },
  });
}

/**
 * Append a new external bank/e-wallet note to a Party's saved external accounts list
 */
async function rememberPartyExternalAccount(tx, party, accountNote) {
  if (!accountNote || !accountNote.trim()) return;
  const trimmed = accountNote.trim();
  let existing = [];
  try {
    existing = party.externalAccountsJson ? JSON.parse(party.externalAccountsJson) : [];
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }

  const exists = existing.some((acc) => acc.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    const updated = [...existing, trimmed];
    await tx.party.update({
      where: { id: party.id },
      data: { externalAccountsJson: JSON.stringify(updated) },
    });
  }
}

/**
 * Recalculate chronological running vault balances and total net wealth across all transaction legs
 */
export async function recalculateLedgerRunningBalances(tx) {
  const allTxs = await tx.transaction.findMany({
    include: {
      legs: { orderBy: { id: "asc" } },
      debtLedgerEntries: true,
    },
    orderBy: [
      { transactionDate: "asc" },
      { transactionTime: "asc" },
      { id: "asc" },
    ],
  });

  // Identify pre-initial-fund absorbed deltas so INITIAL_FUND stays anchored accurately
  const vaults = await tx.vault.findMany();
  const initialDateByVault = {};
  for (const t of allTxs) {
    if (t.nature === "INITIAL_FUND") {
      for (const leg of t.legs) {
        if (!initialDateByVault[leg.vaultId]) {
          initialDateByVault[leg.vaultId] = {
            date: t.transactionDate,
            time: t.transactionTime,
            id: t.id,
          };
        }
      }
    }
  }

  const vaultRunning = {};
  for (const v of vaults) {
    vaultRunning[v.id] = toDecimal(0);
  }

  // Pre-seed vaults with absorbed pre-initial-fund net outflows so INITIAL_FUND lands on its true counted anchor
  for (const t of allTxs) {
    if (!t.isBackdated || t.nature === "INITIAL_FUND") continue;
    for (const leg of t.legs) {
      const initMarker = initialDateByVault[leg.vaultId];
      if (!initMarker) continue;
      const isBeforeInit =
        t.transactionDate < initMarker.date ||
        (t.transactionDate.getTime() === initMarker.date.getTime() &&
          (t.transactionTime < initMarker.time || (t.transactionTime === initMarker.time && t.id < initMarker.id)));
      if (isBeforeInit) {
        vaultRunning[leg.vaultId] = subMoney(vaultRunning[leg.vaultId], leg.netMutation);
      }
    }
  }

  // Track cumulative party net debt in chronological order for accurate total wealth snapshots
  let runningNetReceivable = toDecimal(0);

  for (const t of allTxs) {
    for (const de of t.debtLedgerEntries) {
      const amt = toDecimal(de.amount);
      if (de.entryCategory === "RECEIVABLE") {
        runningNetReceivable =
          de.direction === "INCREASE"
            ? addMoney(runningNetReceivable, amt)
            : subMoney(runningNetReceivable, amt);
      } else if (de.entryCategory === "PAYABLE") {
        runningNetReceivable =
          de.direction === "INCREASE"
            ? subMoney(runningNetReceivable, amt)
            : addMoney(runningNetReceivable, amt);
      }
    }

    for (const leg of t.legs) {
      const prev = vaultRunning[leg.vaultId] || toDecimal(0);
      const next = addMoney(prev, leg.netMutation);
      vaultRunning[leg.vaultId] = next;

      let sumVaults = toDecimal(0);
      for (const val of Object.values(vaultRunning)) {
        sumVaults = addMoney(sumVaults, val);
      }
      const totalWealth = addMoney(sumVaults, runningNetReceivable);

      await tx.transactionLeg.update({
        where: { id: leg.id },
        data: {
          runningVaultBalance: roundMoney(next),
          runningTotalWealth: roundMoney(totalWealth),
        },
      });
    }
  }
}

/**
 * Settle open debt entries either by targeting one specific entry or using FIFO auto-allocation
 */
async function settleDebtEntries({
  tx,
  transactionId,
  partyId,
  entryCategory,
  settlementAmount,
  referenceDebtId = null,
  settlementMethod = "CASH_OR_BANK",
  notes = null,
}) {
  let remainingToAllocate = toDecimal(settlementAmount);

  if (referenceDebtId) {
    const target = await tx.debtLedgerEntry.findUnique({
      where: { id: parseInt(referenceDebtId, 10) },
    });
    if (!target || target.partyId !== partyId || target.entryCategory !== entryCategory) {
      throw new Error("Referenced debt entry not found for this party");
    }

    const openAmt = toDecimal(target.remainingOpenAmount);
    if (remainingToAllocate.greaterThan(openAmt)) {
      throw new Error(`Payment exceeds selected item's remaining balance (Rp ${openAmt.toFixed(0)})`);
    }

    const newRem = subMoney(openAmt, remainingToAllocate);
    await tx.debtLedgerEntry.update({
      where: { id: target.id },
      data: {
        remainingOpenAmount: roundMoney(newRem),
        status: newRem.isZero() ? "SETTLED" : "PARTIAL",
      },
    });

    await tx.debtLedgerEntry.create({
      data: {
        transactionId,
        partyId,
        entryCategory,
        direction: "DECREASE",
        settlementMethod,
        amount: roundMoney(remainingToAllocate),
        referenceDebtId: target.id,
        remainingOpenAmount: toDecimal(0),
        status: "SETTLED",
        notes,
      },
    });
    return;
  }

  // FIFO Auto-Allocate oldest OPEN / PARTIAL items first
  const openItems = await tx.debtLedgerEntry.findMany({
    where: {
      partyId,
      entryCategory,
      direction: "INCREASE",
      remainingOpenAmount: { gt: 0 },
    },
    include: { transaction: true },
    orderBy: [
      { transaction: { transactionDate: "asc" } },
      { id: "asc" },
    ],
  });

  const totalOpen = openItems.reduce((acc, item) => addMoney(acc, item.remainingOpenAmount), toDecimal(0));
  if (remainingToAllocate.greaterThan(totalOpen)) {
    throw new Error(
      `Amount exceeds total open ${entryCategory.toLowerCase()} balance (Rp ${totalOpen.toFixed(0)})`
    );
  }

  for (const item of openItems) {
    if (remainingToAllocate.lessThanOrEqualTo(0)) break;

    const itemOpen = toDecimal(item.remainingOpenAmount);
    const alloc = remainingToAllocate.greaterThan(itemOpen) ? itemOpen : remainingToAllocate;
    const newRem = subMoney(itemOpen, alloc);

    await tx.debtLedgerEntry.update({
      where: { id: item.id },
      data: {
        remainingOpenAmount: roundMoney(newRem),
        status: newRem.isZero() ? "SETTLED" : "PARTIAL",
      },
    });

    await tx.debtLedgerEntry.create({
      data: {
        transactionId,
        partyId,
        entryCategory,
        direction: "DECREASE",
        settlementMethod,
        amount: roundMoney(alloc),
        referenceDebtId: item.id,
        remainingOpenAmount: toDecimal(0),
        status: "SETTLED",
        notes,
      },
    });

    remainingToAllocate = subMoney(remainingToAllocate, alloc);
  }
}

/**
 * Create a financial transaction atomically with multi-vault legs, auto-retroactive detection, and debt ledger updates
 */
export async function createTransaction(payload) {
  return await prisma.$transaction(async (tx) => {
    const {
      title,
      nature,
      categoryId = null,
      commitmentType = "NONE",
      priorityTier = "NONE",
      partyId,
      actionCardId = null,
      sourceVaultId = null,
      targetVaultId = null,
      grossAmount,
      taxFeeAmount = 0,
      coinChangeAmount = 0,
      transactionDate = new Date(),
      transactionTime = null,
      notes = null,
      counterpartyAccountNote = null,
      payableMode = "EXPENSE_TALANG", // EXPENSE_TALANG | CASH_LOAN
      referenceDebtId = null,
    } = payload;

    const party = await tx.party.findUnique({ where: { id: parseInt(partyId, 10) } });
    if (!party) throw new Error(`Party with id ${partyId} not found`);

    const needsSourceVault =
      nature !== "PAYABLE_BORROW" || payableMode === "CASH_LOAN";

    let sourceVault = null;
    if (needsSourceVault) {
      if (!sourceVaultId) throw new Error("Source/Destination vault is required");
      sourceVault = await tx.vault.findUnique({ where: { id: parseInt(sourceVaultId, 10) } });
      if (!sourceVault) throw new Error(`Vault with id ${sourceVaultId} not found`);
    } else if (sourceVaultId) {
      sourceVault = await tx.vault.findUnique({ where: { id: parseInt(sourceVaultId, 10) } });
    }

    // Parse business timestamp
    const txDate = new Date(transactionDate);
    let txTime = transactionTime;
    if (txTime && /^\d{2}:\d{2}$/.test(txTime)) {
      const [hh, mm] = txTime.split(":").map(Number);
      txDate.setHours(hh, mm, 0, 0);
    } else {
      txTime = `${String(txDate.getHours()).padStart(2, "0")}:${String(txDate.getMinutes()).padStart(2, "0")}`;
    }

    const monthTag = `${txDate.toLocaleString("en-US", { month: "short" })},${txDate.getFullYear()}`;
    const grossDec = roundMoney(grossAmount);
    const taxDec = roundMoney(taxFeeAmount);
    const changeDec = roundMoney(coinChangeAmount);

    if (grossDec.lessThanOrEqualTo(0)) {
      throw new Error("Transaction amount must be greater than zero");
    }

    // #15 Auto-Detect Retroactive if txDate is earlier than the latest checkpoint of sourceVault
    let isBackdated = false;
    let linkedCheckpoint = null;
    if (sourceVault && nature !== "INITIAL_FUND") {
      const latestCp = await tx.vaultCheckpoint.findFirst({
        where: { vaultId: sourceVault.id },
        orderBy: { checkpointTimestamp: "desc" },
      });
      if (latestCp && txDate < latestCp.checkpointTimestamp) {
        isBackdated = true;
        linkedCheckpoint = latestCp;
      }
    }

    // Rule 15: Strict Consume Invariant
    let consumeDec = toDecimal(0);
    let incomeDec = toDecimal(0);

    if (nature === "EXPENSE" && party.partyType === "SELF") {
      consumeDec = grossDec.negated();
    } else if (nature === "PAYABLE_BORROW" && payableMode === "EXPENSE_TALANG") {
      // Buying personal consumption paid upfront by someone else counts immediately toward consume
      consumeDec = grossDec.negated();
    } else if (nature === "INCOME") {
      incomeDec = grossDec;
    }

    // 1. Create General Ledger Header
    const createdTx = await tx.transaction.create({
      data: {
        transactionDate: txDate,
        transactionTime: txTime,
        monthTag,
        title,
        nature,
        categoryId: categoryId ? parseInt(categoryId, 10) : null,
        commitmentType,
        priorityTier,
        partyId: party.id,
        actionCardId: actionCardId ? parseInt(actionCardId, 10) : null,
        grossAmount: grossDec,
        consumeAmount: consumeDec,
        incomeAmount: incomeDec,
        isBackdated,
        linkedCheckpointId: linkedCheckpoint ? linkedCheckpoint.id : null,
        counterpartyAccountNote: counterpartyAccountNote?.trim() || null,
        notes,
      },
    });

    // Save external bank/e-wallet note for future autocomplete if provided
    if (counterpartyAccountNote) {
      await rememberPartyExternalAccount(tx, party, counterpartyAccountNote);
    }

    // Helper: decide whether ending vault balance should mutate or be absorbed into checkpoint
    let absorbAmountToUnexplained = toDecimal(0);
    let absorbAmountToAnchor = toDecimal(0);

    async function handleAbsorptionIfBackdated(mutationDeltaDec) {
      if (!isBackdated || !linkedCheckpoint) return true; // Mutate currentBalance normally

      // Try absorbing into RECONCILIATION_LOST of the linked checkpoint first
      const lostTx = await tx.transaction.findFirst({
        where: {
          linkedCheckpointId: linkedCheckpoint.id,
          nature: "RECONCILIATION_LOST",
        },
        include: { legs: true },
      });

      const absDelta = mutationDeltaDec.abs();

      if (mutationDeltaDec.lessThan(0) && lostTx && toDecimal(lostTx.grossAmount).greaterThan(0)) {
        const currentLost = toDecimal(lostTx.grossAmount);
        const reduceLostBy = absDelta.greaterThan(currentLost) ? currentLost : absDelta;
        const newLostAmount = subMoney(currentLost, reduceLostBy);

        if (newLostAmount.isZero()) {
          await tx.transaction.delete({ where: { id: lostTx.id } });
        } else {
          await tx.transaction.update({
            where: { id: lostTx.id },
            data: { grossAmount: roundMoney(newLostAmount) },
          });
          if (lostTx.legs[0]) {
            await tx.transactionLeg.update({
              where: { id: lostTx.legs[0].id },
              data: {
                creditOut: roundMoney(newLostAmount),
                netMutation: roundMoney(newLostAmount.negated()),
              },
            });
          }
        }

        absorbAmountToUnexplained = reduceLostBy;
        const leftover = subMoney(absDelta, reduceLostBy);
        if (leftover.greaterThan(0)) {
          absorbAmountToAnchor = leftover;
        }
      } else {
        absorbAmountToAnchor = absDelta;
      }

      // Update checkpoint anchor tracking so ending vault balance remains 100% synced
      const updatedDeduction =
        mutationDeltaDec.lessThan(0)
          ? addMoney(linkedCheckpoint.retroactiveDeductionTotal, absDelta)
          : subMoney(linkedCheckpoint.retroactiveDeductionTotal, absDelta);

      await tx.vaultCheckpoint.update({
        where: { id: linkedCheckpoint.id },
        data: {
          retroactiveDeductionTotal: roundMoney(updatedDeduction),
          effectiveAnchorAmount: roundMoney(
            subMoney(linkedCheckpoint.originalCountedAmount, updatedDeduction)
          ),
          resolvedDiscrepancyAmount: { increment: roundMoney(absorbAmountToUnexplained) },
          unexplainedDiscrepancyAmount: { increment: roundMoney(absorbAmountToUnexplained) },
        },
      });

      return false; // Do not mutate live currentBalance because checkpoint already counted reality after txDate
    }

    // 2. Create Transaction Legs & Debt Ledger Entries depending on nature
    if (nature === "EXPENSE" || nature === "RECEIVABLE_LEND" || nature === "PAYABLE_REPAY") {
      const delta = grossDec.negated();
      const shouldMutateLive = await handleAbsorptionIfBackdated(delta);

      let newSourceBalance = toDecimal(sourceVault.currentBalance);
      if (shouldMutateLive) {
        newSourceBalance = subMoney(sourceVault.currentBalance, grossDec);
        await tx.vault.update({
          where: { id: sourceVault.id },
          data: { currentBalance: roundMoney(newSourceBalance) },
        });
      }

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: toDecimal(0),
          creditOut: grossDec,
          netMutation: delta,
          runningVaultBalance: roundMoney(newSourceBalance),
          runningTotalWealth: roundMoney(newSourceBalance),
        },
      });

      // Split coin change if paying with Cash and receiving Coins
      if (changeDec.greaterThan(0)) {
        const coinVault = await tx.vault.findFirst({ where: { code: "COIN" } });
        if (coinVault) {
          const newCoinBalance = addMoney(coinVault.currentBalance, changeDec);
          await tx.vault.update({
            where: { id: coinVault.id },
            data: { currentBalance: roundMoney(newCoinBalance) },
          });

          await tx.transactionLeg.create({
            data: {
              transactionId: createdTx.id,
              vaultId: coinVault.id,
              legRole: "COIN_CHANGE",
              debitIn: changeDec,
              creditOut: toDecimal(0),
              netMutation: changeDec,
              runningVaultBalance: roundMoney(newCoinBalance),
              runningTotalWealth: roundMoney(newCoinBalance),
            },
          });
        }
      }

      if (nature === "RECEIVABLE_LEND") {
        await tx.debtLedgerEntry.create({
          data: {
            transactionId: createdTx.id,
            partyId: party.id,
            entryCategory: "RECEIVABLE",
            direction: "INCREASE",
            settlementMethod: "CASH_OR_BANK",
            amount: grossDec,
            remainingOpenAmount: grossDec,
            status: "OPEN",
            notes: counterpartyAccountNote || notes || null,
          },
        });
        await recomputePartyBalances(tx, party.id);
      } else if (nature === "PAYABLE_REPAY") {
        await settleDebtEntries({
          tx,
          transactionId: createdTx.id,
          partyId: party.id,
          entryCategory: "PAYABLE",
          settlementAmount: grossDec,
          referenceDebtId,
          settlementMethod: "CASH_OR_BANK",
          notes: counterpartyAccountNote || notes || null,
        });
        await recomputePartyBalances(tx, party.id);
      }
    } else if (nature === "INCOME" || nature === "RECEIVABLE_COLLECT") {
      const shouldMutateLive = await handleAbsorptionIfBackdated(grossDec);
      let newSourceBalance = toDecimal(sourceVault.currentBalance);
      if (shouldMutateLive) {
        newSourceBalance = addMoney(sourceVault.currentBalance, grossDec);
        await tx.vault.update({
          where: { id: sourceVault.id },
          data: { currentBalance: roundMoney(newSourceBalance) },
        });
      }

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: grossDec,
          creditOut: toDecimal(0),
          netMutation: grossDec,
          runningVaultBalance: roundMoney(newSourceBalance),
          runningTotalWealth: roundMoney(newSourceBalance),
        },
      });

      if (nature === "RECEIVABLE_COLLECT") {
        await settleDebtEntries({
          tx,
          transactionId: createdTx.id,
          partyId: party.id,
          entryCategory: "RECEIVABLE",
          settlementAmount: grossDec,
          referenceDebtId,
          settlementMethod: "CASH_OR_BANK",
          notes: counterpartyAccountNote || notes || null,
        });
        await recomputePartyBalances(tx, party.id);
      }
    } else if (nature === "PAYABLE_BORROW") {
      // #17: User borrows from party or gets treated/covered (ditalangin)
      if (payableMode === "CASH_LOAN" && sourceVault) {
        const shouldMutateLive = await handleAbsorptionIfBackdated(grossDec);
        let newSourceBalance = toDecimal(sourceVault.currentBalance);
        if (shouldMutateLive) {
          newSourceBalance = addMoney(sourceVault.currentBalance, grossDec);
          await tx.vault.update({
            where: { id: sourceVault.id },
            data: { currentBalance: roundMoney(newSourceBalance) },
          });
        }

        await tx.transactionLeg.create({
          data: {
            transactionId: createdTx.id,
            vaultId: sourceVault.id,
            legRole: "PRIMARY",
            debitIn: grossDec,
            creditOut: toDecimal(0),
            netMutation: grossDec,
            runningVaultBalance: roundMoney(newSourceBalance),
            runningTotalWealth: roundMoney(newSourceBalance),
          },
        });
      }

      await tx.debtLedgerEntry.create({
        data: {
          transactionId: createdTx.id,
          partyId: party.id,
          entryCategory: "PAYABLE",
          direction: "INCREASE",
          settlementMethod: "CASH_OR_BANK",
          amount: grossDec,
          remainingOpenAmount: grossDec,
          status: "OPEN",
          notes: notes || null,
        },
      });
      await recomputePartyBalances(tx, party.id);
    } else if (nature === "TRANSFER") {
      if (!targetVaultId) throw new Error("Target vault is required for TRANSFER");
      const targetVault = await tx.vault.findUnique({ where: { id: parseInt(targetVaultId, 10) } });
      if (!targetVault) throw new Error("Target vault not found");

      const newSourceBalance = subMoney(sourceVault.currentBalance, grossDec);
      const newTargetBalance = addMoney(targetVault.currentBalance, grossDec);

      await tx.vault.update({
        where: { id: sourceVault.id },
        data: { currentBalance: roundMoney(newSourceBalance) },
      });
      await tx.vault.update({
        where: { id: targetVault.id },
        data: { currentBalance: roundMoney(newTargetBalance) },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: toDecimal(0),
          creditOut: grossDec,
          netMutation: grossDec.negated(),
          runningVaultBalance: roundMoney(newSourceBalance),
          runningTotalWealth: roundMoney(newSourceBalance),
        },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: targetVault.id,
          legRole: "TRANSFER_TARGET",
          debitIn: grossDec,
          creditOut: toDecimal(0),
          netMutation: grossDec,
          runningVaultBalance: roundMoney(newTargetBalance),
          runningTotalWealth: roundMoney(newTargetBalance),
        },
      });
    }

    // 3. Auto-Split Tax / Admin Fee into separate row if present
    if (taxDec.greaterThan(0) && sourceVault) {
      const adminCategory = await tx.category.findUnique({ where: { code: "EXP_ADMIN_TAX" } });
      const liveVault = await tx.vault.findUnique({ where: { id: sourceVault.id } });
      let newSourceBalance = toDecimal(liveVault.currentBalance);
      if (!isBackdated) {
        newSourceBalance = subMoney(liveVault.currentBalance, taxDec);
        await tx.vault.update({
          where: { id: sourceVault.id },
          data: { currentBalance: roundMoney(newSourceBalance) },
        });
      }

      const childTx = await tx.transaction.create({
        data: {
          transactionDate: txDate,
          transactionTime: txTime,
          monthTag,
          title: `Biaya Admin/Pajak - ${title}`,
          nature: "EXPENSE",
          categoryId: adminCategory ? adminCategory.id : null,
          commitmentType: "FIXED_MANDATORY",
          priorityTier: "SEKUNDER",
          partyId: party.id,
          parentTransactionId: createdTx.id,
          grossAmount: taxDec,
          consumeAmount: taxDec.negated(),
          incomeAmount: toDecimal(0),
          isBackdated,
          linkedCheckpointId: linkedCheckpoint ? linkedCheckpoint.id : null,
          notes: `Auto-split fee for transaction #${createdTx.id}`,
        },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: childTx.id,
          vaultId: sourceVault.id,
          legRole: "ADMIN_FEE",
          debitIn: toDecimal(0),
          creditOut: taxDec,
          netMutation: taxDec.negated(),
          runningVaultBalance: roundMoney(newSourceBalance),
          runningTotalWealth: roundMoney(newSourceBalance),
        },
      });
    }

    // 4. Update Habit Stats if triggered from an Action Card
    if (actionCardId && sourceVault) {
      await recordCardUsage(tx, parseInt(actionCardId, 10), grossDec, sourceVault.id, txDate);
    }

    // 5. Recalculate chronological running balances across ledger legs
    await recalculateLedgerRunningBalances(tx);

    return createdTx;
  });
}

/**
 * Forgives/writes-off an unsettled receivable (full, specific partial, or party-level FIFO partial)
 */
export async function writeOffDebt({
  debtEntryId = null,
  partyId = null,
  amount = null,
  destinationCategoryCode = "EXP_SOCIAL_CHARITY",
  notes = null,
}) {
  return await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { code: destinationCategoryCode } });
    const now = new Date();
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let resolvedPartyId = partyId ? parseInt(partyId, 10) : null;
    let writeOffAmount = amount !== null && amount !== undefined && amount !== "" ? roundMoney(amount) : null;

    if (debtEntryId) {
      const debt = await tx.debtLedgerEntry.findUnique({
        where: { id: parseInt(debtEntryId, 10) },
        include: { party: true },
      });
      if (!debt || toDecimal(debt.remainingOpenAmount).lessThanOrEqualTo(0)) {
        throw new Error("Debt entry not found or already settled");
      }
      resolvedPartyId = debt.partyId;
      if (writeOffAmount === null) {
        writeOffAmount = roundMoney(debt.remainingOpenAmount);
      }
      if (writeOffAmount.lessThanOrEqualTo(0) || writeOffAmount.greaterThan(debt.remainingOpenAmount)) {
        throw new Error("Invalid partial write-off amount");
      }
    } else if (resolvedPartyId) {
      const partyOpenRecs = await tx.debtLedgerEntry.findMany({
        where: {
          partyId: resolvedPartyId,
          entryCategory: "RECEIVABLE",
          direction: "INCREASE",
          remainingOpenAmount: { gt: 0 },
        },
      });
      const totalOpen = partyOpenRecs.reduce((acc, e) => addMoney(acc, e.remainingOpenAmount), toDecimal(0));
      if (totalOpen.lessThanOrEqualTo(0)) {
        throw new Error("No open receivable found for this party");
      }
      if (writeOffAmount === null) {
        writeOffAmount = roundMoney(totalOpen);
      }
      if (writeOffAmount.lessThanOrEqualTo(0) || writeOffAmount.greaterThan(totalOpen)) {
        throw new Error(`Write-off amount must be between Rp 1 and Rp ${totalOpen.toFixed(0)}`);
      }
    } else {
      throw new Error("Either debtEntryId or partyId is required");
    }

    const party = await tx.party.findUnique({ where: { id: resolvedPartyId } });
    if (!party) throw new Error("Party not found");

    const writeOffTx = await tx.transaction.create({
      data: {
        transactionDate: now,
        transactionTime: timeStr,
        monthTag,
        title: `Ikhlaskan Piutang - ${party.name}`,
        nature: "EXPENSE",
        categoryId: category ? category.id : null,
        commitmentType: category?.commitmentType || "SOCIAL_CHARITY",
        priorityTier: category?.priorityTier || "SEKUNDER",
        partyId: party.id,
        grossAmount: writeOffAmount,
        consumeAmount: writeOffAmount.negated(),
        incomeAmount: toDecimal(0),
        notes: notes || `Debt write-off (${destinationCategoryCode})`,
      },
    });

    await settleDebtEntries({
      tx,
      transactionId: writeOffTx.id,
      partyId: party.id,
      entryCategory: "RECEIVABLE",
      settlementAmount: writeOffAmount,
      referenceDebtId: debtEntryId ? parseInt(debtEntryId, 10) : null,
      settlementMethod: "WRITEOFF_FORGIVEN",
      notes: notes || `Written off to ${destinationCategoryCode}`,
    });

    await recomputePartyBalances(tx, party.id);
    await recalculateLedgerRunningBalances(tx);

    return writeOffTx;
  });
}

/**
 * Manually merge / offset Receivable vs Payable entries for a Party without moving cash/bank vaults (#22-2)
 */
export async function offsetPartyDebts({
  partyId,
  receivableIds = [],
  payableIds = [],
  offsetAmount = null,
  notes = null,
}) {
  return await prisma.$transaction(async (tx) => {
    const pId = parseInt(partyId, 10);
    const party = await tx.party.findUnique({ where: { id: pId } });
    if (!party) throw new Error("Party not found");

    const recWhere = {
      partyId: pId,
      entryCategory: "RECEIVABLE",
      direction: "INCREASE",
      remainingOpenAmount: { gt: 0 },
      ...(receivableIds.length > 0 ? { id: { in: receivableIds.map((x) => parseInt(x, 10)) } } : {}),
    };

    const payWhere = {
      partyId: pId,
      entryCategory: "PAYABLE",
      direction: "INCREASE",
      remainingOpenAmount: { gt: 0 },
      ...(payableIds.length > 0 ? { id: { in: payableIds.map((x) => parseInt(x, 10)) } } : {}),
    };

    const [recItems, payItems] = await Promise.all([
      tx.debtLedgerEntry.findMany({
        where: recWhere,
        include: { transaction: true },
        orderBy: [{ transaction: { transactionDate: "asc" } }, { id: "asc" }],
      }),
      tx.debtLedgerEntry.findMany({
        where: payWhere,
        include: { transaction: true },
        orderBy: [{ transaction: { transactionDate: "asc" } }, { id: "asc" }],
      }),
    ]);

    const maxRec = recItems.reduce((acc, e) => addMoney(acc, e.remainingOpenAmount), toDecimal(0));
    const maxPay = payItems.reduce((acc, e) => addMoney(acc, e.remainingOpenAmount), toDecimal(0));
    const maxPossible = maxRec.lessThan(maxPay) ? maxRec : maxPay;

    if (maxPossible.lessThanOrEqualTo(0)) {
      throw new Error("Both open receivables and open payables are required to perform an offset merge");
    }

    const finalOffset =
      offsetAmount !== null && offsetAmount !== undefined && offsetAmount !== ""
        ? roundMoney(offsetAmount)
        : roundMoney(maxPossible);

    if (finalOffset.lessThanOrEqualTo(0) || finalOffset.greaterThan(maxPossible)) {
      throw new Error(`Offset amount must be between Rp 1 and Rp ${maxPossible.toFixed(0)}`);
    }

    const now = new Date();
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const offsetTx = await tx.transaction.create({
      data: {
        transactionDate: now,
        transactionTime: timeStr,
        monthTag,
        title: `Offset Utang-Piutang - ${party.name}`,
        nature: "DEBT_OFFSET",
        categoryId: null,
        commitmentType: "NONE",
        priorityTier: "NONE",
        partyId: party.id,
        grossAmount: finalOffset,
        consumeAmount: toDecimal(0),
        incomeAmount: toDecimal(0),
        notes: notes || `Manual debt merge/offset of Rp ${finalOffset.toFixed(0)}`,
      },
    });

    // Reduce chosen Receivable entries
    let recRem = finalOffset;
    for (const item of recItems) {
      if (recRem.lessThanOrEqualTo(0)) break;
      const open = toDecimal(item.remainingOpenAmount);
      const take = recRem.greaterThan(open) ? open : recRem;
      const newOpen = subMoney(open, take);

      await tx.debtLedgerEntry.update({
        where: { id: item.id },
        data: {
          remainingOpenAmount: roundMoney(newOpen),
          status: newOpen.isZero() ? "SETTLED" : "PARTIAL",
        },
      });
      await tx.debtLedgerEntry.create({
        data: {
          transactionId: offsetTx.id,
          partyId: party.id,
          entryCategory: "RECEIVABLE",
          direction: "DECREASE",
          settlementMethod: "OFFSET_DEDUCTION",
          amount: roundMoney(take),
          referenceDebtId: item.id,
          remainingOpenAmount: toDecimal(0),
          status: "SETTLED",
          notes: notes || "Offset merge",
        },
      });
      recRem = subMoney(recRem, take);
    }

    // Reduce chosen Payable entries
    let payRem = finalOffset;
    for (const item of payItems) {
      if (payRem.lessThanOrEqualTo(0)) break;
      const open = toDecimal(item.remainingOpenAmount);
      const take = payRem.greaterThan(open) ? open : payRem;
      const newOpen = subMoney(open, take);

      await tx.debtLedgerEntry.update({
        where: { id: item.id },
        data: {
          remainingOpenAmount: roundMoney(newOpen),
          status: newOpen.isZero() ? "SETTLED" : "PARTIAL",
        },
      });
      await tx.debtLedgerEntry.create({
        data: {
          transactionId: offsetTx.id,
          partyId: party.id,
          entryCategory: "PAYABLE",
          direction: "DECREASE",
          settlementMethod: "OFFSET_DEDUCTION",
          amount: roundMoney(take),
          referenceDebtId: item.id,
          remainingOpenAmount: toDecimal(0),
          status: "SETTLED",
          notes: notes || "Offset merge",
        },
      });
      payRem = subMoney(payRem, take);
    }

    await recomputePartyBalances(tx, party.id);
    await recalculateLedgerRunningBalances(tx);

    return offsetTx;
  });
}

/**
 * Reverse & delete a transaction atomically (used by 5s Undo & Ledger Delete)
 */
export async function deleteAndReverseTransaction(txId) {
  return await prisma.$transaction(async (tx) => {
    const id = parseInt(txId, 10);
    const transaction = await tx.transaction.findUnique({
      where: { id },
      include: {
        legs: true,
        childTransactions: { include: { legs: true } },
        debtLedgerEntries: true,
      },
    });

    if (!transaction) throw new Error("Transaction not found");

    // Reverse live vault mutations ONLY if transaction was not absorbed as backdated
    if (!transaction.isBackdated) {
      for (const leg of transaction.legs) {
        const vault = await tx.vault.findUnique({ where: { id: leg.vaultId } });
        if (vault) {
          const restored = subMoney(vault.currentBalance, leg.netMutation);
          await tx.vault.update({
            where: { id: vault.id },
            data: { currentBalance: roundMoney(restored) },
          });
        }
      }

      for (const child of transaction.childTransactions) {
        for (const cLeg of child.legs) {
          const vault = await tx.vault.findUnique({ where: { id: cLeg.vaultId } });
          if (vault) {
            const restored = subMoney(vault.currentBalance, cLeg.netMutation);
            await tx.vault.update({
              where: { id: vault.id },
              data: { currentBalance: roundMoney(restored) },
            });
          }
        }
        await tx.transaction.delete({ where: { id: child.id } });
      }
    } else if (transaction.linkedCheckpointId) {
      // Revert backdated checkpoint deduction tracking if possible
      const cp = await tx.vaultCheckpoint.findUnique({ where: { id: transaction.linkedCheckpointId } });
      if (cp) {
        const absAmt = toDecimal(transaction.grossAmount);
        const newDed = subMoney(cp.retroactiveDeductionTotal, absAmt);
        await tx.vaultCheckpoint.update({
          where: { id: cp.id },
          data: {
            retroactiveDeductionTotal: roundMoney(newDed),
            effectiveAnchorAmount: roundMoney(subMoney(cp.originalCountedAmount, newDed)),
          },
        });
      }
    }

    // Reverse debt settlement chains cleanly
    const affectedPartyIds = new Set();
    for (const de of transaction.debtLedgerEntries) {
      affectedPartyIds.add(de.partyId);
      if (de.direction === "DECREASE" && de.referenceDebtId) {
        const orig = await tx.debtLedgerEntry.findUnique({ where: { id: de.referenceDebtId } });
        if (orig) {
          const restoredOpen = addMoney(orig.remainingOpenAmount, de.amount);
          const fullOrig = toDecimal(orig.amount);
          const capped = restoredOpen.greaterThan(fullOrig) ? fullOrig : restoredOpen;
          await tx.debtLedgerEntry.update({
            where: { id: orig.id },
            data: {
              remainingOpenAmount: roundMoney(capped),
              status: capped.equals(fullOrig) ? "OPEN" : "PARTIAL",
            },
          });
        }
      }
    }

    // Delete transaction (cascades legs & debtLedgerEntries belonging to this tx)
    await tx.transaction.delete({ where: { id: transaction.id } });

    for (const pId of affectedPartyIds) {
      await recomputePartyBalances(tx, pId);
    }

    await recalculateLedgerRunningBalances(tx);

    return { id: transaction.id, title: transaction.title };
  });
}
