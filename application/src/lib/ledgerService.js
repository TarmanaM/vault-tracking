// Core Double-Entry & Ledger Integrity Service
// Strictly enforces Rule 13 (Atomic prisma.$transaction), Rule 14 (Decimal precision), and Rule 15 (Strict Consume Invariant)

import prisma from "./prisma.js";
import { toDecimal, addMoney, subMoney, roundMoney } from "./money.js";
import { recordCardUsage } from "./habitEngine.js";

/**
 * Creates a financial transaction atomically with its multi-vault legs and ledger updates
 */
export async function createTransaction(payload) {
  return await prisma.$transaction(async (tx) => {
    const {
      title,
      nature,
      categoryId,
      commitmentType = "NONE",
      priorityTier = "NONE",
      partyId,
      actionCardId = null,
      sourceVaultId,
      targetVaultId = null,
      grossAmount,
      taxFeeAmount = 0,
      coinChangeAmount = 0,
      transactionDate = new Date(),
      transactionTime = null,
      notes = null,
      isBackdated = false,
      linkedCheckpointId = null,
    } = payload;

    const party = await tx.party.findUnique({ where: { id: partyId } });
    if (!party) throw new Error(`Party with id ${partyId} not found`);

    const sourceVault = await tx.vault.findUnique({ where: { id: sourceVaultId } });
    if (!sourceVault) throw new Error(`Source vault with id ${sourceVaultId} not found`);

    const txDate = new Date(transactionDate);
    const txTime = transactionTime || `${String(txDate.getHours()).padStart(2, "0")}:${String(txDate.getMinutes()).padStart(2, "0")}`;
    const monthTag = `${txDate.toLocaleString("en-US", { month: "short" })},${txDate.getFullYear()}`;

    const grossDec = roundMoney(grossAmount);
    const taxDec = roundMoney(taxFeeAmount);
    const changeDec = roundMoney(coinChangeAmount);

    // Rule 15: Strict Consume Invariant
    let consumeDec = toDecimal(0);
    let incomeDec = toDecimal(0);

    if (nature === "EXPENSE" && party.partyType === "SELF") {
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
        categoryId: categoryId || null,
        commitmentType,
        priorityTier,
        partyId,
        actionCardId: actionCardId || null,
        grossAmount: grossDec,
        consumeAmount: consumeDec,
        incomeAmount: incomeDec,
        isBackdated,
        linkedCheckpointId: linkedCheckpointId || null,
        notes,
      },
    });

    // 2. Create Transaction Legs depending on nature
    if (nature === "EXPENSE" || nature === "RECEIVABLE_LEND") {
      // Outflow from source vault
      const newSourceBalance = subMoney(sourceVault.currentBalance, grossDec);
      await tx.vault.update({
        where: { id: sourceVault.id },
        data: { currentBalance: newSourceBalance },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: toDecimal(0),
          creditOut: grossDec,
          netMutation: grossDec.negated(),
          runningVaultBalance: newSourceBalance,
          runningTotalWealth: newSourceBalance, // Aggregated by background helper
        },
      });

      // Split coin change if paying with Cash and receiving Coins
      if (changeDec.greaterThan(0)) {
        const coinVault = await tx.vault.findFirst({ where: { code: "COIN" } });
        if (coinVault) {
          const newCoinBalance = addMoney(coinVault.currentBalance, changeDec);
          await tx.vault.update({
            where: { id: coinVault.id },
            data: { currentBalance: newCoinBalance },
          });

          await tx.transactionLeg.create({
            data: {
              transactionId: createdTx.id,
              vaultId: coinVault.id,
              legRole: "COIN_CHANGE",
              debitIn: changeDec,
              creditOut: toDecimal(0),
              netMutation: changeDec,
              runningVaultBalance: newCoinBalance,
              runningTotalWealth: newCoinBalance,
            },
          });
        }
      }

      // If this is a receivable loan (talangan), track debt ledger entry
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
          },
        });

        await tx.party.update({
          where: { id: party.id },
          data: { netReceivableBalance: { increment: grossDec } },
        });
      }
    } else if (nature === "INCOME" || nature === "RECEIVABLE_COLLECT") {
      // Inflow to source vault
      const newSourceBalance = addMoney(sourceVault.currentBalance, grossDec);
      await tx.vault.update({
        where: { id: sourceVault.id },
        data: { currentBalance: newSourceBalance },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: grossDec,
          creditOut: toDecimal(0),
          netMutation: grossDec,
          runningVaultBalance: newSourceBalance,
          runningTotalWealth: newSourceBalance,
        },
      });

      // If receiving repayment from a borrower, settle debt entries
      if (nature === "RECEIVABLE_COLLECT") {
        await tx.debtLedgerEntry.create({
          data: {
            transactionId: createdTx.id,
            partyId: party.id,
            entryCategory: "RECEIVABLE",
            direction: "DECREASE",
            settlementMethod: "CASH_OR_BANK",
            amount: grossDec,
            remainingOpenAmount: toDecimal(0),
            status: "SETTLED",
          },
        });

        await tx.party.update({
          where: { id: party.id },
          data: { netReceivableBalance: { decrement: grossDec } },
        });
      }
    } else if (nature === "TRANSFER") {
      // Multi-leg transfer between vaults
      if (!targetVaultId) throw new Error("Target vault is required for TRANSFER");
      const targetVault = await tx.vault.findUnique({ where: { id: targetVaultId } });
      if (!targetVault) throw new Error("Target vault not found");

      const newSourceBalance = subMoney(sourceVault.currentBalance, grossDec);
      const newTargetBalance = addMoney(targetVault.currentBalance, grossDec);

      await tx.vault.update({
        where: { id: sourceVault.id },
        data: { currentBalance: newSourceBalance },
      });
      await tx.vault.update({
        where: { id: targetVault.id },
        data: { currentBalance: newTargetBalance },
      });

      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: sourceVault.id,
          legRole: "PRIMARY",
          debitIn: toDecimal(0),
          creditOut: grossDec,
          netMutation: grossDec.negated(),
          runningVaultBalance: newSourceBalance,
          runningTotalWealth: newSourceBalance,
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
          runningVaultBalance: newTargetBalance,
          runningTotalWealth: newTargetBalance,
        },
      });
    }

    // 3. Auto-Split Tax / Admin Fee into separate row if present
    if (taxDec.greaterThan(0)) {
      const adminCategory = await tx.category.findUnique({ where: { code: "EXP_ADMIN_TAX" } });
      const newSourceBalance = subMoney(sourceVault.currentBalance, taxDec);
      await tx.vault.update({
        where: { id: sourceVault.id },
        data: { currentBalance: newSourceBalance },
      });

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
          partyId,
          parentTransactionId: createdTx.id,
          grossAmount: taxDec,
          consumeAmount: taxDec.negated(),
          incomeAmount: toDecimal(0),
          isBackdated,
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
          runningVaultBalance: newSourceBalance,
          runningTotalWealth: newSourceBalance,
        },
      });
    }

    // 4. Update Habit Stats if triggered from an Action Card
    if (actionCardId) {
      await recordCardUsage(tx, actionCardId, grossDec, sourceVault.id, txDate);
    }

    // 5. Backdated checkpoint absorption (Rule 2B)
    if (isBackdated && linkedCheckpointId) {
      const checkpoint = await tx.vaultCheckpoint.findUnique({ where: { id: linkedCheckpointId } });
      if (checkpoint) {
        const newDeduction = addMoney(checkpoint.retroactiveDeductionTotal, grossDec);
        const newAnchor = subMoney(checkpoint.originalCountedAmount, newDeduction);
        const newUnexplained = subMoney(checkpoint.unexplainedDiscrepancyAmount, grossDec);

        await tx.vaultCheckpoint.update({
          where: { id: checkpoint.id },
          data: {
            retroactiveDeductionTotal: newDeduction,
            effectiveAnchorAmount: newAnchor,
            unexplainedDiscrepancyAmount: newUnexplained,
            resolvedDiscrepancyAmount: { increment: grossDec },
          },
        });
      }
    }

    return createdTx;
  });
}

/**
 * Forgives/writes-off an unsettled debt, closing the receivable and converting it to charity/unplanned expense
 */
export async function writeOffDebt(debtEntryId, destinationCategoryCode = "EXP_SOCIAL_CHARITY") {
  return await prisma.$transaction(async (tx) => {
    const debt = await tx.debtLedgerEntry.findUnique({
      where: { id: debtEntryId },
      include: { party: true },
    });
    if (!debt || debt.status === "SETTLED") {
      throw new Error("Debt entry not found or already settled");
    }

    const openAmount = toDecimal(debt.remainingOpenAmount);
    const category = await tx.category.findUnique({ where: { code: destinationCategoryCode } });

    // Mark debt entry settled as write-off
    await tx.debtLedgerEntry.update({
      where: { id: debt.id },
      data: {
        remainingOpenAmount: toDecimal(0),
        status: "SETTLED",
        settlementMethod: "WRITEOFF_FORGIVEN",
        notes: `Written off to ${destinationCategoryCode}`,
      },
    });

    // Reduce party's net receivable
    await tx.party.update({
      where: { id: debt.partyId },
      data: { netReceivableBalance: { decrement: openAmount } },
    });

    // Create write-off expense transaction (affects consume, but does not mutate cash/bank vaults)
    const now = new Date();
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;

    const writeOffTx = await tx.transaction.create({
      data: {
        transactionDate: now,
        transactionTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        monthTag,
        title: `Ikhlaskan Piutang - ${debt.party.name}`,
        nature: "EXPENSE",
        categoryId: category ? category.id : null,
        commitmentType: "SOCIAL_CHARITY",
        priorityTier: "SEKUNDER",
        partyId: debt.partyId,
        grossAmount: openAmount,
        consumeAmount: openAmount.negated(),
        incomeAmount: toDecimal(0),
        notes: `Write-off forgiving unsettled debt #${debt.id}`,
      },
    });

    return writeOffTx;
  });
}

