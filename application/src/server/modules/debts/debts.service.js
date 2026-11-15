// Debt Sub-Ledger service: receivables/payables summary, per-party details, write-offs, and two-way offsets
import "server-only";
import prisma from "@/server/db/prisma";
import { toDecimal, addMoney, roundMoney } from "@/shared/money";
import { writeOffDebt, offsetPartyDebts } from "@/lib/ledgerService";
import { BadRequestError, NotFoundError } from "@/server/http/errors";

export async function getUserDebtOverview(userId) {
  const [parties, liabilityVaults] = await Promise.all([
    prisma.party.findMany({
      where: { userId: Number(userId), isActive: true },
      include: {
        debtLedgerEntries: {
          include: {
            transaction: {
              include: { category: true, legs: { include: { vault: true } } },
            },
          },
          orderBy: { id: "desc" },
        },
      },
      orderBy: [{ receivableBalance: "desc" }, { payableBalance: "desc" }, { name: "asc" }],
    }),
    prisma.vault.findMany({
      where: {
        userId: Number(userId),
        isActive: true,
        vaultType: "LIABILITY_CREDIT_LINE",
      },
    }),
  ]);

  let totalReceivables = toDecimal(0);
  let totalPayables = toDecimal(0);

  for (const v of liabilityVaults) {
    const bal = toDecimal(v.currentBalance);
    if (bal.lessThan(0)) {
      totalPayables = addMoney(totalPayables, bal.abs());
    }
  }

  const enrichedParties = [];
  for (const p of parties) {
    const rec = toDecimal(p.receivableBalance);
    const pay = toDecimal(p.payableBalance);

    totalReceivables = addMoney(totalReceivables, rec);
    totalPayables = addMoney(totalPayables, pay);

    const isSelf = p.code === "SELF" || p.partyType === "SELF";
    const hasDebtRelevance =
      Boolean(p.isDebtContact) ||
      rec.greaterThan(0) ||
      pay.greaterThan(0) ||
      (p.debtLedgerEntries && p.debtLedgerEntries.length > 0);

    if (isSelf || !hasDebtRelevance) {
      continue;
    }

    let externalAccounts = [];
    try {
      externalAccounts = p.externalAccountsJson ? JSON.parse(p.externalAccountsJson) : [];
    } catch {
      externalAccounts = [];
    }

    enrichedParties.push({
      ...p,
      receivableBalance: roundMoney(rec),
      payableBalance: roundMoney(pay),
      externalAccounts,
    });
  }

  return {
    summary: {
      totalReceivables: roundMoney(totalReceivables),
      totalPayables: roundMoney(totalPayables),
    },
    parties: enrichedParties,
  };
}

export async function getPartyDebtDetail(userId, rawPartyId) {
  const partyId = parseInt(rawPartyId, 10);
  if (!partyId || Number.isNaN(partyId)) {
    throw new BadRequestError("Invalid party ID");
  }

  const [party, partyTransactions, vaults, categories] = await Promise.all([
    prisma.party.findFirst({
      where: { id: partyId, userId: Number(userId) },
      include: {
        debtLedgerEntries: {
          include: {
            transaction: {
              include: {
                category: true,
                legs: { include: { vault: true } },
              },
            },
            referenceDebt: {
              include: { transaction: true },
            },
          },
          orderBy: [{ transaction: { transactionDate: "desc" } }, { id: "desc" }],
        },
      },
    }),
    prisma.transaction.findMany({
      where: { partyId, userId: Number(userId) },
      include: {
        category: true,
        legs: { include: { vault: true } },
        debtLedgerEntries: true,
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    }),
    prisma.vault.findMany({
      where: { userId: Number(userId), isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      where: { userId: Number(userId), isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!party) {
    throw new NotFoundError("Party not found");
  }

  let externalAccounts = [];
  try {
    externalAccounts = party.externalAccountsJson
      ? JSON.parse(party.externalAccountsJson)
      : [];
  } catch {
    externalAccounts = [];
  }

  const openReceivables = party.debtLedgerEntries.filter(
    (e) =>
      e.entryCategory === "RECEIVABLE" &&
      e.direction === "INCREASE" &&
      toDecimal(e.remainingOpenAmount).greaterThan(0)
  );

  const openPayables = party.debtLedgerEntries.filter(
    (e) =>
      e.entryCategory === "PAYABLE" &&
      e.direction === "INCREASE" &&
      toDecimal(e.remainingOpenAmount).greaterThan(0)
  );

  return {
    party: {
      ...party,
      receivableBalance: roundMoney(party.receivableBalance),
      payableBalance: roundMoney(party.payableBalance),
      externalAccounts,
    },
    openReceivables,
    openPayables,
    transactions: partyTransactions,
    vaults,
    categories,
  };
}

export async function executeDebtWriteOff(userId, body = {}) {
  const {
    debtEntryId = null,
    partyId = null,
    amount = null,
    destinationCategoryCode = "EXP_SOCIAL_CHARITY",
    notes = null,
  } = body;

  if (!debtEntryId && !partyId) {
    throw new BadRequestError("Either debtEntryId or partyId is required");
  }

  return await writeOffDebt({
    userId,
    debtEntryId,
    partyId,
    amount,
    destinationCategoryCode,
    notes,
  });
}

export async function executePartyDebtOffset(userId, body = {}) {
  const {
    partyId,
    receivableIds = [],
    payableIds = [],
    offsetAmount = null,
    notes = null,
  } = body;

  if (!partyId) {
    throw new BadRequestError("partyId is required");
  }

  return await offsetPartyDebts({
    userId,
    partyId,
    receivableIds,
    payableIds,
    offsetAmount,
    notes,
  });
}
