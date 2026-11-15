// Server Module: Ledger Balance & FIFO Debt Settlement Helpers
// Enforces Rule 13 (Atomic prisma.$transaction) and Rule 14 (Decimal precision)

import { toDecimal, addMoney, subMoney, roundMoney } from "@/shared/money";

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
export async function rememberPartyExternalAccount(tx, party, accountNote) {
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
export async function settleDebtEntries({
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
