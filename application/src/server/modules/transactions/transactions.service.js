// Server Module: Transactions & Accounting Export Service
// Handles transaction listing, single-transaction lookup, post-save card suggestion, and CSV exports

import prisma from "@/server/db/prisma";
import { logger } from "@/server/logger";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import { createTransaction, deleteAndReverseTransaction } from "@/lib/ledgerService";
import { evaluatePostSaveCardSuggestion, getTransactionTitleSuggestions } from "@/lib/cardPromotionService";
import { getOrCreateAppSettings } from "@/lib/fxService";
import { toDecimal } from "@/shared/money";

export async function listUserTransactions(userId, searchParams) {
  const vaultId = searchParams.get("vaultId");
  const categoryId = searchParams.get("categoryId");
  const partyId = searchParams.get("partyId");
  const nature = searchParams.get("nature");
  const monthTag = searchParams.get("monthTag");
  const preset = searchParams.get("preset"); // 1M, 3M, 6M, YTD, ALL, CUSTOM
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const latestTx = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    select: { transactionDate: true },
  });
  const anchorDate = latestTx ? new Date(latestTx.transactionDate) : new Date();

  let resolvedStart = null;
  let resolvedEnd = null;

  if (preset && preset !== "ALL") {
    if (preset === "CUSTOM") {
      if (startDateParam) resolvedStart = new Date(`${startDateParam}T00:00:00`);
      if (endDateParam) resolvedEnd = new Date(`${endDateParam}T23:59:59.999`);
    } else {
      resolvedEnd = new Date(anchorDate);
      resolvedEnd.setHours(23, 59, 59, 999);
      resolvedStart = new Date(anchorDate);
      if (preset === "1M") resolvedStart.setMonth(resolvedStart.getMonth() - 1);
      else if (preset === "3M") resolvedStart.setMonth(resolvedStart.getMonth() - 3);
      else if (preset === "6M") resolvedStart.setMonth(resolvedStart.getMonth() - 6);
      else if (preset === "YTD") resolvedStart = new Date(anchorDate.getFullYear(), 0, 1);
      resolvedStart.setHours(0, 0, 0, 0);
    }
  } else if (startDateParam || endDateParam) {
    if (startDateParam) resolvedStart = new Date(`${startDateParam}T00:00:00`);
    if (endDateParam) resolvedEnd = new Date(`${endDateParam}T23:59:59.999`);
  }

  const where = { userId };
  if (categoryId) where.categoryId = parseInt(categoryId, 10);
  if (partyId) where.partyId = parseInt(partyId, 10);
  if (nature) where.nature = nature;
  if (monthTag) where.monthTag = monthTag;
  if (vaultId) {
    where.legs = {
      some: { vaultId: parseInt(vaultId, 10) },
    };
  }
  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search.trim() } },
      { notes: { contains: search.trim() } },
      { counterpartyAccountNote: { contains: search.trim() } },
    ];
  }
  if (resolvedStart || resolvedEnd) {
    where.transactionDate = {
      ...(resolvedStart ? { gte: resolvedStart } : {}),
      ...(resolvedEnd ? { lte: resolvedEnd } : {}),
    };
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        party: true,
        actionCard: true,
        legs: {
          include: { vault: true, subContainer: true },
        },
        debtLedgerEntries: true,
        childTransactions: true,
      },
      orderBy: [{ transactionDate: "desc" }, { transactionTime: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    total,
    limit,
    offset,
    appliedRange: {
      preset: preset || "ALL",
      startDate: resolvedStart ? resolvedStart.toISOString().split("T")[0] : null,
      endDate: resolvedEnd ? resolvedEnd.toISOString().split("T")[0] : null,
      anchorDate: anchorDate.toISOString().split("T")[0],
    },
    transactions,
  };
}

export async function createUserTransactionWithSuggestion(userId, body, requestId) {
  let result;
  try {
    result = await createTransaction({ ...body, userId });
  } catch (err) {
    throw new BadRequestError(err.message || "Failed to create transaction");
  }

  let cardSuggestion = null;
  if (!body?.actionCardId && result?.id) {
    try {
      cardSuggestion = await evaluatePostSaveCardSuggestion(userId, result.id);
    } catch (suggestErr) {
      logger.warn("Post-save card suggestion evaluation warning", {
        requestId,
        userId,
        transactionId: result.id,
        error: suggestErr.message,
      });
    }
  }

  return { result, cardSuggestion };
}

export async function getUserTransactionById(userId, rawId) {
  const txId = parseInt(rawId, 10);
  if (!Number.isInteger(txId) || txId <= 0) {
    throw new BadRequestError("Invalid transaction id");
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: txId, userId },
    include: {
      category: true,
      party: true,
      actionCard: true,
      legs: {
        include: {
          vault: true,
          subContainer: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!tx) {
    throw new NotFoundError("Transaction not found");
  }
  return tx;
}

export async function reverseUserTransactionById(userId, rawId) {
  try {
    return await deleteAndReverseTransaction(rawId, userId);
  } catch (err) {
    throw new BadRequestError(err.message || "Failed to reverse transaction");
  }
}

export async function listTitleSuggestions(userId, rawLimit) {
  const limitParam = parseInt(rawLimit || "40", 10);
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(100, limitParam) : 40;
  return getTransactionTitleSuggestions(userId, limit);
}

export async function buildAccountingCsvExport(userId, searchParams) {
  const format = searchParams.get("format") || "journal_csv";
  const monthTag = searchParams.get("monthTag");

  const where = { userId };
  if (monthTag) where.monthTag = monthTag;

  const [settings, transactions] = await Promise.all([
    getOrCreateAppSettings(userId, prisma),
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        party: true,
        legs: { include: { vault: true } },
      },
      orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const baseCcy = String(settings?.baseCurrency || "IDR").toUpperCase();

  if (format === "journal_csv") {
    let csv = `Journal No,Date,Time,COA Code,Account Name,Party/Sub-Ledger,Debit (${baseCcy}),Credit (${baseCcy}),Description\n`;

    for (const t of transactions) {
      const jNo = `JRN-${t.id}`;
      const dateStr = t.transactionDate.toISOString().split("T")[0];
      const gross = toDecimal(t.grossAmount).toNumber();
      const primaryLeg = t.legs.find((l) => l.legRole === "PRIMARY") || t.legs[0];
      const vault = primaryLeg?.vault;

      if (t.nature === "EXPENSE") {
        const expCoa = t.category?.coaCode || "5000";
        const expName = t.category?.name || "Operating Expense";
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","${expCoa}","${expName}","${t.party.name}",${gross},0,"${t.title}"\n`;

        const vCoa = vault?.vaultType === "BANK" ? "1110" : "1100";
        const vName = vault?.name || "Cash / Bank";
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","${vCoa}","${vName}","${t.party.name}",0,${gross},"${t.title} [Outflow from ${vName}]"\n`;
      } else if (t.nature === "INCOME") {
        const vCoa = vault?.vaultType === "BANK" ? "1110" : "1100";
        const vName = vault?.name || "Cash / Bank";
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","${vCoa}","${vName}","${t.party.name}",${gross},0,"${t.title} [Inflow to ${vName}]"\n`;

        const revCoa = t.category?.coaCode || "4000";
        const revName = t.category?.name || "Income";
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","${revCoa}","${revName}","${t.party.name}",0,${gross},"${t.title}"\n`;
      } else if (t.nature === "TRANSFER") {
        const targetLeg = t.legs.find((l) => l.legRole === "TRANSFER_TARGET");
        const targetVault = targetLeg?.vault;

        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${targetVault?.name || "Cash / Bank"}","${t.party.name}",${gross},0,"Transfer from ${vault?.name || "Source"}"\n`;
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Cash / Bank"}","${t.party.name}",0,${gross},"Transfer to ${targetVault?.name || "Target"}"\n`;
      } else if (t.nature === "RECEIVABLE_LEND") {
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1201","Accounts Receivable","${t.party.name}",${gross},0,"Receivable / Lend: ${t.title}"\n`;
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Cash / Bank"}","${t.party.name}",0,${gross},"Outflow from ${vault?.name || "Source"}"\n`;
      } else if (t.nature === "RECEIVABLE_COLLECT") {
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Cash / Bank"}","${t.party.name}",${gross},0,"Receivable Collected: ${t.title}"\n`;
        csv += `"${jNo}","${dateStr}","${t.transactionTime}","1201","Accounts Receivable","${t.party.name}",0,${gross},"Repayment from ${t.party.name}"\n`;
      }
    }

    return {
      csv,
      fileName: `accounting_journal_${monthTag || "all"}.csv`,
    };
  }

  let flatCsv = "ID,Date,Time,Month,Title,Nature,Category,Party,Amount (Base),Consume (Base),Entry Currency,Original Amount,FX Rate,Vaults Affected,Notes\n";
  for (const t of transactions) {
    const dateStr = t.transactionDate.toISOString().split("T")[0];
    const vaultsAffected = t.legs.map((l) => `${l.vault.name} (${toDecimal(l.netMutation).toNumber()})`).join("; ");
    const origAmt = t.originalGrossAmount !== null && t.originalGrossAmount !== undefined ? toDecimal(t.originalGrossAmount).toNumber() : "";
    const fxApplied = t.fxRateApplied ? toDecimal(t.fxRateApplied).toNumber() : 1;
    flatCsv += `${t.id},"${dateStr}","${t.transactionTime}","${t.monthTag}","${t.title}","${t.nature}","${t.category?.name || ""}","${t.party.name}",${toDecimal(t.grossAmount).toNumber()},${toDecimal(t.consumeAmount).toNumber()},"${t.currency || "IDR"}",${origAmt},${fxApplied},"${vaultsAffected}","${t.notes || ""}"\n`;
  }

  return {
    csv: flatCsv,
    fileName: `ledger_flat_${monthTag || "all"}.csv`,
  };
}
