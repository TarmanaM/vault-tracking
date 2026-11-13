// API Route: GET /api/analytics
// Returns time-series data and category breakdowns for instant chart drawer

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("type"); // CARD, VAULT, LAYER, PARTY
    const targetId = searchParams.get("id");

    if (!targetType) {
      return NextResponse.json({ success: false, error: "type parameter is required" }, { status: 400 });
    }

    if (targetType === "CARD") {
      const cardId = parseInt(targetId, 10);
      const card = await prisma.actionCard.findUnique({
        where: { id: cardId },
        include: { habitStats: true, defaultVault: true, defaultCategory: true },
      });
      if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });

      // Transactions created by this card
      const txs = await prisma.transaction.findMany({
        where: { actionCardId: card.id },
        orderBy: { transactionDate: "asc" },
        take: 50,
      });

      const timeSeries = txs.map((t) => ({
        date: t.transactionDate.toISOString().split("T")[0],
        amount: toDecimal(t.grossAmount).toNumber(),
        title: t.title,
      }));

      // Hourly histogram
      let hourlyData = [];
      try {
        const counts = JSON.parse(card.habitStats?.hourCountsJson || "[]");
        hourlyData = counts.map((count, hour) => ({ hour: `${hour}:00`, count }));
      } catch {
        hourlyData = [];
      }

      return NextResponse.json({
        success: true,
        data: {
          title: card.title,
          subtitle: card.subtitle,
          timeSeries,
          hourlyData,
          totalUses: card.habitStats?.totalUses || 0,
        },
      });
    }

    if (targetType === "VAULT") {
      const vaultId = parseInt(targetId, 10);
      const vault = await prisma.vault.findUnique({
        where: { id: vaultId },
      });
      if (!vault) return NextResponse.json({ success: false, error: "Vault not found" }, { status: 404 });

      // Last 30 mutations on this vault
      const legs = await prisma.transactionLeg.findMany({
        where: { vaultId: vault.id },
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

      return NextResponse.json({
        success: true,
        data: {
          title: vault.name,
          currentBalance: roundMoney(vault.currentBalance),
          balanceTimeline,
        },
      });
    }

    if (targetType === "LAYER") {
      const commitmentType = targetId; // FIXED_MANDATORY, VARIABLE_ESSENTIAL, DISCRETIONARY_JAJAN, SOCIAL_CHARITY

      const txs = await prisma.transaction.findMany({
        where: { commitmentType },
        include: { category: true },
        orderBy: { transactionDate: "asc" },
      });

      // Group by category
      const categoryMap = {};
      for (const t of txs) {
        const catName = t.category?.name || "Lainnya";
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

      return NextResponse.json({
        success: true,
        data: {
          title: `Layer ${commitmentType.replace("_", " ")}`,
          pieData,
          timeSeries,
        },
      });
    }

    if (targetType === "PARTY") {
      const partyId = parseInt(targetId, 10);
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          debtLedgerEntries: {
            include: { transaction: true },
            orderBy: { id: "asc" },
          },
        },
      });
      if (!party) return NextResponse.json({ success: false, error: "Party not found" }, { status: 404 });

      const debtHistory = party.debtLedgerEntries.map((e) => ({
        date: e.transaction.transactionDate.toISOString().split("T")[0],
        category: e.entryCategory,
        direction: e.direction,
        amount: toDecimal(e.amount).toNumber(),
        status: e.status,
        title: e.transaction.title,
      }));

      return NextResponse.json({
        success: true,
        data: {
          title: party.name,
          netReceivableBalance: roundMoney(party.netReceivableBalance),
          debtHistory,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Unknown target type" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/analytics:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load analytics" },
      { status: 500 }
    );
  }
}

