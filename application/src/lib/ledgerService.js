// Core Double-Entry & Ledger Integrity Service
// Enforces Rule 9 (English comments), Rule 13 (Atomic prisma.$transaction),
// Rule 14 (Decimal precision), and Rule 15 (Strict Consume Invariant)

import prisma from "./prisma.js";
import { toDecimal, addMoney, subMoney, mulMoney, divMoney, roundMoney } from "./money.js";
import { recordCardUsage } from "./habitEngine.js";
import { getOrCreateAppSettings, resolveFxRate } from "./fxService.js";
import {
  ensureDefaultSubContainer,
  applySubVaultMutationInTx,
  evaluateBasePartitionState,
} from "./subVaultService.js";

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
 * Recalculate chronological running vault balances and total net wealth across all transaction legs for one user
 */
export async function recalculateLedgerRunningBalances(tx, userId) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("userId is required to recalculate ledger running balances");
  }

  const allTxs = await tx.transaction.findMany({
    where: { userId: uid },
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
  const vaults = await tx.vault.findMany({ where: { userId: uid } });
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
  userId,
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
    const target = await tx.debtLedgerEntry.findFirst({
      where: { id: parseInt(referenceDebtId, 10), userId },
    });
    if (!target || target.partyId !== partyId || target.entryCategory !== entryCategory) {
      throw new Error("Referenced debt entry not found for this party");
    }

    const openAmt = toDecimal(target.remainingOpenAmount);
    if (remainingToAllocate.greaterThan(openAmt)) {
      throw new Error(`Payment exceeds selected item's remaining balance (${openAmt.toFixed(0)})`);
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
        userId,
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
      userId,
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
      `Amount exceeds total open ${entryCategory.toLowerCase()} balance (${totalOpen.toFixed(0)})`
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
        userId,
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
      userId,
      title,
      nature,
      categoryId = null,
      commitmentType = "NONE",
      priorityTier = "NONE",
      partyId,
      actionCardId = null,
      sourceVaultId = null,
      sourceSubContainerId = null,
      targetVaultId = null,
      targetSubContainerId = null,
      grossAmount,
      targetAmount = null,
      manualFxRate = null,
      taxFeeAmount = 0,
      coinUsedAmount = 0,
      coinChangeAmount = 0,
      transactionDate = new Date(),
      transactionTime = null,
      notes = null,
      counterpartyAccountNote = null,
      payableMode = "EXPENSE_TALANG", // EXPENSE_TALANG | CASH_LOAN
      referenceDebtId = null,
    } = payload;

    const uid = parseInt(userId, 10);
    if (!uid || Number.isNaN(uid)) {
      throw new Error("Authenticated userId is required to create transaction");
    }

    const appSetting = await getOrCreateAppSettings(uid, tx);
    const baseCurrency = String(appSetting.baseCurrency || "IDR").toUpperCase();

    const party = await tx.party.findFirst({ where: { id: parseInt(partyId, 10), userId: uid } });
    if (!party) throw new Error(`Party with id ${partyId} not found`);

    let resolvedCategory = null;
    if (categoryId) {
      resolvedCategory = await tx.category.findFirst({
        where: { id: parseInt(categoryId, 10), userId: uid },
      });
      if (!resolvedCategory) {
        throw new Error(`Category with id ${categoryId} not found`);
      }
    }

    if (actionCardId) {
      const ownedCard = await tx.actionCard.findFirst({
        where: { id: parseInt(actionCardId, 10), userId: uid },
      });
      if (!ownedCard) {
        throw new Error(`Action Card with id ${actionCardId} not found`);
      }
    }

    const needsSourceVault =
      nature !== "PAYABLE_BORROW" || payableMode === "CASH_LOAN";

    let sourceVault = null;
    if (needsSourceVault) {
      if (!sourceVaultId) throw new Error("Source/Destination vault is required");
      sourceVault = await tx.vault.findFirst({ where: { id: parseInt(sourceVaultId, 10), userId: uid } });
      if (!sourceVault) throw new Error(`Vault with id ${sourceVaultId} not found`);
    } else if (sourceVaultId) {
      sourceVault = await tx.vault.findFirst({ where: { id: parseInt(sourceVaultId, 10), userId: uid } });
      if (!sourceVault) throw new Error(`Vault with id ${sourceVaultId} not found`);
    }

    // Resolve target Sub-Vault (defaults automatically to Vault's Default Sub-Vault if omitted)
    let sourceSubContainer = null;
    if (sourceVault) {
      if (sourceSubContainerId) {
        sourceSubContainer = await tx.vaultSubContainer.findUnique({
          where: { id: parseInt(sourceSubContainerId, 10) },
        });
        if (!sourceSubContainer || sourceSubContainer.vaultId !== sourceVault.id) {
          throw new Error("Selected sub-vault does not belong to source vault");
        }
      } else {
        sourceSubContainer = await ensureDefaultSubContainer(tx, sourceVault.id);
      }
    }

    const entryCurrency = String(sourceSubContainer?.currency || baseCurrency).toUpperCase();
    const isForeignEntry = entryCurrency !== baseCurrency;

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
    const entryAmountDec = roundMoney(grossAmount);
    const entryTaxDec = roundMoney(taxFeeAmount);
    const coinUsedDec = roundMoney(coinUsedAmount || 0);
    const changeDec = roundMoney(coinChangeAmount || 0);

    if (entryAmountDec.lessThanOrEqualTo(0)) {
      throw new Error("Transaction amount must be greater than zero");
    }
    if (coinUsedDec.lessThan(0) || changeDec.lessThan(0)) {
      throw new Error("Coin amounts cannot be negative");
    }
    if (coinUsedDec.greaterThan(0) && changeDec.greaterThan(0)) {
      throw new Error("Cannot combine Coin Split payment and Coin Change returned on one transaction");
    }
    if ((coinUsedDec.greaterThan(0) || changeDec.greaterThan(0)) && nature !== "EXPENSE") {
      throw new Error("Coin split and coin change options only apply to EXPENSE transactions");
    }
    if ((coinUsedDec.greaterThan(0) || changeDec.greaterThan(0)) && isForeignEntry) {
      throw new Error("Coin split and coin change only apply to base currency cash transactions");
    }
    if (coinUsedDec.greaterThan(entryAmountDec)) {
      throw new Error("Coin split payment cannot exceed total transaction amount");
    }

    const fxInfo = await resolveFxRate({
      fromCurrency: entryCurrency,
      baseCurrency,
      manualFxRate,
      tx,
    });
    const grossDec = isForeignEntry
      ? roundMoney(mulMoney(entryAmountDec, fxInfo.rateDec))
      : entryAmountDec;
    const originalGrossDec = isForeignEntry ? entryAmountDec : null;
    const taxBaseDec = isForeignEntry
      ? roundMoney(mulMoney(entryTaxDec, fxInfo.rateDec))
      : entryTaxDec;

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

    // Rule 15: Strict Consume Invariant (always locked in Base Currency)
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
        userId: uid,
        transactionDate: txDate,
        transactionTime: txTime,
        monthTag,
        title,
        nature,
        categoryId: resolvedCategory ? resolvedCategory.id : null,
        commitmentType: resolvedCategory?.commitmentType || commitmentType,
        priorityTier: resolvedCategory?.priorityTier || priorityTier,
        partyId: party.id,
        actionCardId: actionCardId ? parseInt(actionCardId, 10) : null,
        currency: entryCurrency,
        originalGrossAmount: originalGrossDec,
        fxRateApplied: fxInfo.rateDec,
        grossAmount: grossDec,
        consumeAmount: consumeDec,
        incomeAmount: incomeDec,
        isBackdated,
        linkedCheckpointId: linkedCheckpoint ? linkedCheckpoint.id : null,
        counterpartyAccountNote: counterpartyAccountNote?.trim() || null,
        notes,
      },
    });

    if (counterpartyAccountNote) {
      await rememberPartyExternalAccount(tx, party, counterpartyAccountNote);
    }

    // Promote party to debt contact automatically whenever recording any debt ledger nature
    const isDebtTxNature =
      nature === "RECEIVABLE_LEND" ||
      nature === "RECEIVABLE_COLLECT" ||
      nature === "PAYABLE_BORROW" ||
      nature === "PAYABLE_REPAY";
    if (isDebtTxNature && !party.isDebtContact && party.partyType !== "SELF") {
      await tx.party.update({
        where: { id: party.id },
        data: { isDebtContact: true },
      });
    }

    // Helper: decide whether ending vault balance should mutate or be absorbed into checkpoint
    let absorbAmountToUnexplained = toDecimal(0);
    let absorbAmountToAnchor = toDecimal(0);

    async function handleAbsorptionIfBackdated(mutationDeltaDec) {
      if (!isBackdated || !linkedCheckpoint) return true;

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

      return false;
    }

    let txSubVaultWarning = false;

    async function applyVaultLegMutation({
      vaultObj,
      subObj = null,
      legRole = "PRIMARY",
      signedEntryDelta,
      baseAbsDec,
      legCurrency = baseCurrency,
      rateDec = toDecimal(1),
      skipAbsorption = false,
      txRef = createdTx,
    }) {
      const ccy = String(legCurrency || baseCurrency).toUpperCase();
      const isForeign = ccy !== baseCurrency;
      const isInflow = signedEntryDelta.greaterThan(0);

      if (isForeign) {
        if (!isBackdated && subObj) {
          await applySubVaultMutationInTx(tx, {
            vaultId: vaultObj.id,
            subContainerId: subObj.id,
            mutationAmount: signedEntryDelta,
            baseCurrency,
            contextLabel: title,
          });
        }
        await tx.transactionLeg.create({
          data: {
            userId: uid,
            transactionId: txRef.id,
            vaultId: vaultObj.id,
            subContainerId: subObj?.id || null,
            legRole,
            currency: ccy,
            fxRateApplied: rateDec,
            originalMutation: roundMoney(signedEntryDelta),
            debitIn: toDecimal(0),
            creditOut: toDecimal(0),
            netMutation: toDecimal(0),
            runningVaultBalance: roundMoney(vaultObj.currentBalance),
            runningTotalWealth: roundMoney(vaultObj.currentBalance),
          },
        });
        return true;
      }

      const signedBaseDelta = roundMoney(signedEntryDelta);
      const shouldMutateLive = skipAbsorption
        ? true
        : await handleAbsorptionIfBackdated(signedBaseDelta);

      let newVaultBal = toDecimal(vaultObj.currentBalance);
      if (shouldMutateLive) {
        newVaultBal = addMoney(vaultObj.currentBalance, signedBaseDelta);
        await tx.vault.update({
          where: { id: vaultObj.id },
          data: { currentBalance: roundMoney(newVaultBal) },
        });
        vaultObj.currentBalance = roundMoney(newVaultBal);

        if (subObj) {
          const subRes = await applySubVaultMutationInTx(tx, {
            vaultId: vaultObj.id,
            subContainerId: subObj.id,
            mutationAmount: signedBaseDelta,
            baseCurrency,
            contextLabel: title,
          });
          if (subRes.triggeredWarning) {
            txSubVaultWarning = true;
          }
        }
      }

      await tx.transactionLeg.create({
        data: {
          userId: uid,
          transactionId: txRef.id,
          vaultId: vaultObj.id,
          subContainerId: subObj?.id || null,
          legRole,
          currency: baseCurrency,
          fxRateApplied: toDecimal(1),
          originalMutation: signedBaseDelta,
          debitIn: isInflow ? roundMoney(baseAbsDec) : toDecimal(0),
          creditOut: isInflow ? toDecimal(0) : roundMoney(baseAbsDec),
          netMutation: signedBaseDelta,
          runningVaultBalance: roundMoney(newVaultBal),
          runningTotalWealth: roundMoney(newVaultBal),
        },
      });
      return shouldMutateLive;
    }

    // 2. Create Transaction Legs & Debt Ledger Entries depending on nature
    if (nature === "EXPENSE" || nature === "RECEIVABLE_LEND" || nature === "PAYABLE_REPAY") {
      const primaryOutflowDec =
        nature === "EXPENSE" && coinUsedDec.greaterThan(0)
          ? subMoney(entryAmountDec, coinUsedDec)
          : nature === "EXPENSE" && changeDec.greaterThan(0)
          ? addMoney(entryAmountDec, changeDec)
          : entryAmountDec;

      if (primaryOutflowDec.greaterThan(0)) {
        const primaryBaseAbs = isForeignEntry
          ? roundMoney(mulMoney(primaryOutflowDec, fxInfo.rateDec))
          : primaryOutflowDec;
        await applyVaultLegMutation({
          vaultObj: sourceVault,
          subObj: sourceSubContainer,
          legRole: "PRIMARY",
          signedEntryDelta: primaryOutflowDec.negated(),
          baseAbsDec: primaryBaseAbs,
          legCurrency: entryCurrency,
          rateDec: fxInfo.rateDec,
        });
      }

      // Coin split outflow (Cash + Coin combined payment) or coin change inflow
      if (coinUsedDec.greaterThan(0) || changeDec.greaterThan(0)) {
        const coinVault = await tx.vault.findFirst({
          where: { userId: uid, OR: [{ code: "COIN" }, { vaultType: "PHYSICAL_COIN" }] },
        });
        if (!coinVault) {
          throw new Error("COIN vault not found for coin transaction");
        }

        const coinCp = await tx.vaultCheckpoint.findFirst({
          where: { vaultId: coinVault.id },
          orderBy: { checkpointTimestamp: "desc" },
        });
        const isCoinBackdated = Boolean(coinCp && txDate < coinCp.checkpointTimestamp);
        const coinDefaultSub = await ensureDefaultSubContainer(tx, coinVault.id);

        if (coinUsedDec.greaterThan(0)) {
          const coinDelta = coinUsedDec.negated();
          let newCoinBalance = toDecimal(coinVault.currentBalance);
          if (!isCoinBackdated) {
            newCoinBalance = subMoney(coinVault.currentBalance, coinUsedDec);
            await tx.vault.update({
              where: { id: coinVault.id },
              data: { currentBalance: roundMoney(newCoinBalance) },
            });
            if (coinDefaultSub) {
              await applySubVaultMutationInTx(tx, {
                vaultId: coinVault.id,
                subContainerId: coinDefaultSub.id,
                mutationAmount: coinDelta,
                baseCurrency,
                contextLabel: title,
              });
            }
          }

          await tx.transactionLeg.create({
            data: {
              userId: uid,
              transactionId: createdTx.id,
              vaultId: coinVault.id,
              subContainerId: coinDefaultSub?.id || null,
              legRole: "COIN_SPLIT",
              currency: baseCurrency,
              fxRateApplied: toDecimal(1),
              originalMutation: coinDelta,
              debitIn: toDecimal(0),
              creditOut: coinUsedDec,
              netMutation: coinDelta,
              runningVaultBalance: roundMoney(newCoinBalance),
              runningTotalWealth: roundMoney(newCoinBalance),
            },
          });
        } else if (changeDec.greaterThan(0)) {
          let newCoinBalance = toDecimal(coinVault.currentBalance);
          if (!isCoinBackdated) {
            newCoinBalance = addMoney(coinVault.currentBalance, changeDec);
            await tx.vault.update({
              where: { id: coinVault.id },
              data: { currentBalance: roundMoney(newCoinBalance) },
            });
            if (coinDefaultSub) {
              await applySubVaultMutationInTx(tx, {
                vaultId: coinVault.id,
                subContainerId: coinDefaultSub.id,
                mutationAmount: changeDec,
                baseCurrency,
                contextLabel: title,
              });
            }
          }

          await tx.transactionLeg.create({
            data: {
              userId: uid,
              transactionId: createdTx.id,
              vaultId: coinVault.id,
              subContainerId: coinDefaultSub?.id || null,
              legRole: "COIN_CHANGE",
              currency: baseCurrency,
              fxRateApplied: toDecimal(1),
              originalMutation: changeDec,
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
            userId: uid,
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
          userId: uid,
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
    } else if (nature === "INCOME" || nature === "RECEIVABLE_COLLECT" || nature === "INITIAL_FUND") {
      await applyVaultLegMutation({
        vaultObj: sourceVault,
        subObj: sourceSubContainer,
        legRole: "PRIMARY",
        signedEntryDelta: entryAmountDec,
        baseAbsDec: grossDec,
        legCurrency: entryCurrency,
        rateDec: fxInfo.rateDec,
        skipAbsorption: nature === "INITIAL_FUND",
      });

      if (nature === "RECEIVABLE_COLLECT") {
        await settleDebtEntries({
          tx,
          userId: uid,
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
      if (payableMode === "CASH_LOAN" && sourceVault) {
        await applyVaultLegMutation({
          vaultObj: sourceVault,
          subObj: sourceSubContainer,
          legRole: "PRIMARY",
          signedEntryDelta: entryAmountDec,
          baseAbsDec: grossDec,
          legCurrency: entryCurrency,
          rateDec: fxInfo.rateDec,
        });
      }

      await tx.debtLedgerEntry.create({
        data: {
          userId: uid,
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
      const targetVault = await tx.vault.findFirst({ where: { id: parseInt(targetVaultId, 10), userId: uid } });
      if (!targetVault) throw new Error("Target vault not found");

      let targetSubContainer = null;
      if (targetSubContainerId) {
        targetSubContainer = await tx.vaultSubContainer.findUnique({
          where: { id: parseInt(targetSubContainerId, 10) },
        });
        if (!targetSubContainer || targetSubContainer.vaultId !== targetVault.id) {
          throw new Error("Selected target sub-vault does not belong to target vault");
        }
      } else {
        targetSubContainer = await ensureDefaultSubContainer(tx, targetVault.id);
      }

      if (
        targetVault.id === sourceVault.id &&
        (sourceSubContainer?.id || null) === (targetSubContainer?.id || null)
      ) {
        throw new Error("Source and destination vaults/sub-vaults cannot be the exact same pocket");
      }

      const targetCurrency = String(targetSubContainer?.currency || baseCurrency).toUpperCase();
      let targetEntryDec = entryAmountDec;
      let targetRateDec = toDecimal(1);

      if (targetCurrency !== entryCurrency) {
        const targetFx = await resolveFxRate({
          fromCurrency: targetCurrency,
          baseCurrency,
          tx,
        });
        targetRateDec = targetFx.rateDec;
        if (targetAmount && Number(targetAmount) > 0) {
          targetEntryDec = roundMoney(targetAmount);
        } else if (targetCurrency === baseCurrency) {
          targetEntryDec = grossDec;
        } else {
          targetEntryDec = roundMoney(divMoney(grossDec, targetFx.rateDec));
        }
      }

      await applyVaultLegMutation({
        vaultObj: sourceVault,
        subObj: sourceSubContainer,
        legRole: "PRIMARY",
        signedEntryDelta: entryAmountDec.negated(),
        baseAbsDec: grossDec,
        legCurrency: entryCurrency,
        rateDec: fxInfo.rateDec,
        skipAbsorption: true,
      });

      const reloadedTarget =
        targetVault.id === sourceVault.id
          ? sourceVault
          : targetVault;

      await applyVaultLegMutation({
        vaultObj: reloadedTarget,
        subObj: targetSubContainer,
        legRole: "TRANSFER_TARGET",
        signedEntryDelta: targetEntryDec,
        baseAbsDec: grossDec,
        legCurrency: targetCurrency,
        rateDec: targetRateDec,
        skipAbsorption: true,
      });
    }

    // 3. Auto-Split Tax / Admin Fee into separate row if present
    if (entryTaxDec.greaterThan(0) && sourceVault) {
      const adminCategory = await tx.category.findUnique({
        where: { userId_code: { userId: uid, code: "EXP_ADMIN_TAX" } },
      });
      const liveVault = await tx.vault.findUnique({ where: { id: sourceVault.id } });

      const childTx = await tx.transaction.create({
        data: {
          userId: uid,
          transactionDate: txDate,
          transactionTime: txTime,
          monthTag,
          title: `Admin/Tax Fee - ${title}`,
          nature: "EXPENSE",
          categoryId: adminCategory ? adminCategory.id : null,
          commitmentType: "FIXED_MANDATORY",
          priorityTier: "SEKUNDER",
          partyId: party.id,
          parentTransactionId: createdTx.id,
          currency: entryCurrency,
          originalGrossAmount: isForeignEntry ? entryTaxDec : null,
          fxRateApplied: fxInfo.rateDec,
          grossAmount: taxBaseDec,
          consumeAmount: taxBaseDec.negated(),
          incomeAmount: toDecimal(0),
          isBackdated,
          linkedCheckpointId: linkedCheckpoint ? linkedCheckpoint.id : null,
          notes: `Auto-split fee for transaction #${createdTx.id}`,
        },
      });

      await applyVaultLegMutation({
        vaultObj: liveVault,
        subObj: sourceSubContainer,
        legRole: "ADMIN_FEE",
        signedEntryDelta: entryTaxDec.negated(),
        baseAbsDec: taxBaseDec,
        legCurrency: entryCurrency,
        rateDec: fxInfo.rateDec,
        skipAbsorption: isBackdated,
        txRef: childTx,
      });
    }

    // Flag partition warning on Transaction header if spillover detected
    if (txSubVaultWarning) {
      await tx.transaction.update({
        where: { id: createdTx.id },
        data: { subVaultWarning: true },
      });
      createdTx.subVaultWarning = true;
    }

    // 4. Update Habit Stats if triggered from an Action Card
    if (actionCardId && sourceVault) {
      await recordCardUsage(tx, parseInt(actionCardId, 10), grossDec, sourceVault.id, txDate);
    }

    // 5. Recalculate chronological running balances across this user's ledger legs
    await recalculateLedgerRunningBalances(tx, uid);

    return createdTx;
  });
}

/**
 * Forgives/writes-off an unsettled receivable (full, specific partial, or party-level FIFO partial)
 */
export async function writeOffDebt({
  userId,
  debtEntryId = null,
  partyId = null,
  amount = null,
  destinationCategoryCode = "EXP_SOCIAL_CHARITY",
  notes = null,
}) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("Authenticated userId is required");
  }

  return await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { userId_code: { userId: uid, code: destinationCategoryCode } },
    });
    const now = new Date();
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let resolvedPartyId = partyId ? parseInt(partyId, 10) : null;
    let writeOffAmount = amount !== null && amount !== undefined && amount !== "" ? roundMoney(amount) : null;

    if (debtEntryId) {
      const debt = await tx.debtLedgerEntry.findFirst({
        where: { id: parseInt(debtEntryId, 10), userId: uid },
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
          userId: uid,
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
        throw new Error(`Write-off amount must be between 1 and ${totalOpen.toFixed(0)}`);
      }
    } else {
      throw new Error("Either debtEntryId or partyId is required");
    }

    const party = await tx.party.findFirst({ where: { id: resolvedPartyId, userId: uid } });
    if (!party) throw new Error("Party not found");

    const writeOffTx = await tx.transaction.create({
      data: {
        userId: uid,
        transactionDate: now,
        transactionTime: timeStr,
        monthTag,
        title: `Debt Write-Off - ${party.name}`,
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
      userId: uid,
      transactionId: writeOffTx.id,
      partyId: party.id,
      entryCategory: "RECEIVABLE",
      settlementAmount: writeOffAmount,
      referenceDebtId: debtEntryId ? parseInt(debtEntryId, 10) : null,
      settlementMethod: "WRITEOFF_FORGIVEN",
      notes: notes || `Written off to ${destinationCategoryCode}`,
    });

    await recomputePartyBalances(tx, party.id);
    await recalculateLedgerRunningBalances(tx, uid);

    return writeOffTx;
  });
}

/**
 * Manually merge / offset Receivable vs Payable entries for a Party without moving cash/bank vaults
 */
export async function offsetPartyDebts({
  userId,
  partyId,
  receivableIds = [],
  payableIds = [],
  offsetAmount = null,
  notes = null,
}) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("Authenticated userId is required");
  }

  return await prisma.$transaction(async (tx) => {
    const pId = parseInt(partyId, 10);
    const party = await tx.party.findFirst({ where: { id: pId, userId: uid } });
    if (!party) throw new Error("Party not found");
    if (!party.isDebtContact && party.partyType !== "SELF") {
      await tx.party.update({
        where: { id: pId },
        data: { isDebtContact: true },
      });
    }

    const recWhere = {
      userId: uid,
      partyId: pId,
      entryCategory: "RECEIVABLE",
      direction: "INCREASE",
      remainingOpenAmount: { gt: 0 },
      ...(receivableIds.length > 0 ? { id: { in: receivableIds.map((x) => parseInt(x, 10)) } } : {}),
    };

    const payWhere = {
      userId: uid,
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
      throw new Error(`Offset amount must be between 1 and ${maxPossible.toFixed(0)}`);
    }

    const now = new Date();
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const offsetTx = await tx.transaction.create({
      data: {
        userId: uid,
        transactionDate: now,
        transactionTime: timeStr,
        monthTag,
        title: `Debt Offset Merge - ${party.name}`,
        nature: "DEBT_OFFSET",
        categoryId: null,
        commitmentType: "NONE",
        priorityTier: "NONE",
        partyId: party.id,
        grossAmount: finalOffset,
        consumeAmount: toDecimal(0),
        incomeAmount: toDecimal(0),
        notes: notes || `Manual debt merge/offset of ${finalOffset.toFixed(0)}`,
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
          userId: uid,
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
          userId: uid,
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
    await recalculateLedgerRunningBalances(tx, uid);

    return offsetTx;
  });
}

/**
 * Reverse & delete a transaction atomically (used by 5s Undo & Ledger Delete)
 */
export async function deleteAndReverseTransaction(txId, userId) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("Authenticated userId is required");
  }

  return await prisma.$transaction(async (tx) => {
    const id = parseInt(txId, 10);
    const settings = await getOrCreateAppSettings(uid, tx);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

    const transaction = await tx.transaction.findFirst({
      where: { id, userId: uid },
      include: {
        legs: true,
        childTransactions: { include: { legs: true } },
        debtLedgerEntries: true,
      },
    });

    if (!transaction) throw new Error("Transaction not found");

    const affectedPartitionVaultIds = new Set();

    const reverseSingleLeg = async (leg) => {
      const netMutDec = toDecimal(leg.netMutation);
      if (!netMutDec.isZero()) {
        const vault = await tx.vault.findUnique({ where: { id: leg.vaultId } });
        if (vault) {
          const restored = subMoney(vault.currentBalance, netMutDec);
          await tx.vault.update({
            where: { id: vault.id },
            data: { currentBalance: roundMoney(restored) },
          });
        }
      }

      if (leg.subContainerId) {
        const sub = await tx.vaultSubContainer.findUnique({ where: { id: leg.subContainerId } });
        if (sub) {
          const subDelta =
            leg.originalMutation !== null && leg.originalMutation !== undefined
              ? toDecimal(leg.originalMutation)
              : netMutDec;
          const restoredSub = subMoney(sub.currentBalance, subDelta);
          await tx.vaultSubContainer.update({
            where: { id: sub.id },
            data: { currentBalance: roundMoney(restoredSub) },
          });
          affectedPartitionVaultIds.add(leg.vaultId);
        }
      }
    };

    // Reverse live vault & sub-vault mutations ONLY if transaction was not absorbed as backdated
    if (!transaction.isBackdated) {
      for (const leg of transaction.legs) {
        await reverseSingleLeg(leg);
      }

      for (const child of transaction.childTransactions) {
        for (const cLeg of child.legs) {
          await reverseSingleLeg(cLeg);
        }
        await tx.transaction.delete({ where: { id: child.id } });
      }
    } else if (transaction.linkedCheckpointId) {
      // Revert backdated checkpoint deduction tracking if possible
      const cp = await tx.vaultCheckpoint.findFirst({
        where: { id: transaction.linkedCheckpointId, userId: uid },
      });
      if (cp) {
        const primaryLeg = transaction.legs.find((l) => l.legRole === "PRIMARY");
        const absAmt = primaryLeg ? toDecimal(primaryLeg.netMutation).abs() : toDecimal(transaction.grossAmount);
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
        const orig = await tx.debtLedgerEntry.findFirst({
          where: { id: de.referenceDebtId, userId: uid },
        });
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

    for (const vId of affectedPartitionVaultIds) {
      await evaluateBasePartitionState(tx, vId, baseCurrency);
    }

    await recalculateLedgerRunningBalances(tx, uid);

    return { id: transaction.id, title: transaction.title };
  });
}
