// Server Module: Ledger Debt Write-Off & Offset Service
// Handles non-cash debt forgiveness and receivable/payable offset merges

import prisma from "@/server/db/prisma";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/shared/money";
import {
  recomputePartyBalances,
  recalculateLedgerRunningBalances,
  settleDebtEntries,
} from "./ledgerBalance.service";

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
