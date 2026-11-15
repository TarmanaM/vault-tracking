// Server Module: Analytics Drilldown Service
// Computes entity-level drilldown analytics for CARD, VAULT, LAYER, and PARTY

import prisma from "@/server/db/prisma";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import { getSpendingLayerMeta } from "@/lib/masterCatalog";
import { toDecimal, roundMoney } from "@/shared/money";
import { getOrCreateAppSettings, getCachedRateMap } from "@/lib/fxService";
import { computeVaultPartitionSummary } from "@/lib/subVaultService";

export async function getDrilldownAnalytics(userId, targetType, targetId) {
  if (targetType === "CARD") {
    const cardId = parseInt(targetId, 10);
    const card = await prisma.actionCard.findFirst({
      where: { id: cardId, userId },
      include: { habitStats: true, defaultVault: true, defaultCategory: true },
    });
    if (!card) throw new NotFoundError("Card not found");

    const txs = await prisma.transaction.findMany({
      where: { userId, actionCardId: card.id },
      orderBy: { transactionDate: "asc" },
      take: 50,
    });

    const timeSeries = txs.map((t) => ({
      date: t.transactionDate.toISOString().split("T")[0],
      amount: toDecimal(t.grossAmount).toNumber(),
      title: t.title,
    }));

    let hourlyData = [];
    try {
      const counts = JSON.parse(card.habitStats?.hourCountsJson || "[]");
      hourlyData = counts.map((count, hour) => ({ hour: `${hour}:00`, count }));
    } catch {
      hourlyData = [];
    }

    return {
      title: card.title,
      subtitle: card.subtitle,
      timeSeries,
      hourlyData,
      totalUses: card.habitStats?.totalUses || 0,
    };
  }

  if (targetType === "VAULT") {
    const vaultId = parseInt(targetId, 10);
    const settings = await getOrCreateAppSettings(userId);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
    const rateMap = await getCachedRateMap(baseCurrency);
    const vault = await prisma.vault.findFirst({
      where: { id: vaultId, userId },
      include: {
        subContainers: {
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!vault) throw new NotFoundError("Vault not found");

    const partitionSummary = computeVaultPartitionSummary(vault, baseCurrency, rateMap);

    const legs = await prisma.transactionLeg.findMany({
      where: { vaultId: vault.id, transaction: { userId } },
      include: { transaction: true },
      orderBy: [{ transaction: { transactionDate: "asc" } }, { id: "asc" }],
      take: 30,
    });

    const balanceTimeline = legs.map((leg) => ({
      date: leg.transaction.transactionDate.toISOString().split("T")[0],
      runningBalance: toDecimal(leg.runningVaultBalance).toNumber(),
      mutation: toDecimal(leg.netMutation).toNumber(),
      title: leg.transaction.title,
    }));

    return {
      title: vault.name,
      currentBalance: roundMoney(vault.currentBalance),
      totalEstimatedBase: partitionSummary.totalEstimatedBase,
      baseCurrency,
      partitionSummary,
      balanceTimeline,
    };
  }

  if (targetType === "LAYER") {
    const commitmentType = targetId;

    const txs = await prisma.transaction.findMany({
      where:
        commitmentType === "RECONCILIATION_LOST"
          ? { userId, nature: "RECONCILIATION_LOST" }
          : { userId, commitmentType },
      include: { category: true },
      orderBy: { transactionDate: "asc" },
    });

    const categoryMap = {};
    for (const t of txs) {
      const catName = t.category?.name || "Other";
      const amt = toDecimal(t.grossAmount).toNumber();
      categoryMap[catName] = (categoryMap[catName] || 0) + amt;
    }

    const pieData = Object.entries(categoryMap).map(([label, value], idx) => ({
      id: idx,
      label,
      value,
    }));

    const timeSeries = txs.slice(-30).map((t) => ({
      date: t.transactionDate.toISOString().split("T")[0],
      amount: toDecimal(t.grossAmount).toNumber(),
      title: t.title,
    }));

    const layerMeta = getSpendingLayerMeta(commitmentType);
    const layerTitle =
      commitmentType === "RECONCILIATION_LOST"
        ? "Unrecorded Cash Shortage"
        : `${layerMeta.label} Breakdown`;

    return {
      title: layerTitle,
      pieData,
      timeSeries,
    };
  }

  if (targetType === "PARTY") {
    const partyId = parseInt(targetId, 10);
    const party = await prisma.party.findFirst({
      where: { id: partyId, userId },
      include: {
        debtLedgerEntries: {
          include: { transaction: true },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!party) throw new NotFoundError("Party not found");

    const debtHistory = party.debtLedgerEntries.map((e) => ({
      date: e.transaction.transactionDate.toISOString().split("T")[0],
      category: e.entryCategory,
      direction: e.direction,
      amount: toDecimal(e.amount).toNumber(),
      status: e.status,
      title: e.transaction.title,
    }));

    return {
      title: party.name,
      receivableBalance: roundMoney(party.receivableBalance),
      payableBalance: roundMoney(party.payableBalance),
      netReceivableBalance: roundMoney(party.netReceivableBalance),
      debtHistory,
    };
  }

  throw new BadRequestError("Invalid type parameter");
}
