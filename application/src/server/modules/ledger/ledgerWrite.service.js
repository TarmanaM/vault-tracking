// Server Module: Ledger Write & Reversal Service
// Handles atomic double-entry transaction creation and reversal

import prisma from "@/server/db/prisma";
import { toDecimal, addMoney, subMoney, mulMoney, divMoney, roundMoney } from "@/shared/money";
import { recordCardUsage } from "@/lib/habitEngine";
import { getOrCreateAppSettings, resolveFxRate } from "@/lib/fxService";
import {
  ensureDefaultSubContainer,
  applySubVaultMutationInTx,
  evaluateBasePartitionState,
} from "@/lib/subVaultService";
import {
  recomputePartyBalances,
  rememberPartyExternalAccount,
  recalculateLedgerRunningBalances,
  settleDebtEntries,
} from "./ledgerBalance.service";

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

    let consumeDec = toDecimal(0);
    let incomeDec = toDecimal(0);

    if (nature === "EXPENSE" && party.partyType === "SELF") {
      consumeDec = grossDec.negated();
    } else if (nature === "PAYABLE_BORROW" && payableMode === "EXPENSE_TALANG") {
      consumeDec = grossDec.negated();
    } else if (nature === "INCOME") {
      incomeDec = grossDec;
    }

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

    if (txSubVaultWarning) {
      await tx.transaction.update({
        where: { id: createdTx.id },
        data: { subVaultWarning: true },
      });
      createdTx.subVaultWarning = true;
    }

    if (actionCardId && sourceVault) {
      await recordCardUsage(tx, parseInt(actionCardId, 10), grossDec, sourceVault.id, txDate);
    }

    await recalculateLedgerRunningBalances(tx, uid);

    return createdTx;
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
