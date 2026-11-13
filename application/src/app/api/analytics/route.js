// API Route: GET /api/analytics
// Returns time-series data, stock-like wealth journey, and category breakdowns for instant chart drawer

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("type"); // WEALTH_JOURNEY, CARD, VAULT, LAYER, PARTY
    const targetId = searchParams.get("id");

    if (!targetType) {
      return NextResponse.json({ success: false, error: "type parameter is required" }, { status: 400 });
    }

    // ==========================================
    // 1. STOCK-LIKE WEALTH JOURNEY & PORTFOLIO PIE
    // ==========================================
    if (targetType === "WEALTH_JOURNEY") {
      // 1. Wealth Timeline (Stock-like Area/Line chart of total net wealth over time)
      const legs = await prisma.transactionLeg.findMany({
        where: { legRole: "PRIMARY" },
        include: { transaction: true },
        orderBy: [{ transaction: { transactionDate: "asc" } }, { id: "asc" }],
      });

      // Group by date to generate daily net wealth curve
      const dateMap = new Map();
      for (const leg of legs) {
        const dateStr = leg.transaction.transactionDate.toISOString().split("T")[0];
        dateMap.set(dateStr, toDecimal(leg.runningTotalWealth).toNumber());
      }

      let wealthTimeline = Array.from(dateMap.entries()).map(([date, wealth]) => ({
        date,
        wealth,
      }));

      // Current Vaults & Distribution Pie
      const vaults = await prisma.vault.findMany({
        where: { isActive: true },
        orderBy: { currentBalance: "desc" },
      });

      const parties = await prisma.party.findMany({
        where: { isActive: true },
      });

      let totalReceivables = toDecimal(0);
      for (const p of parties) {
        const bal = toDecimal(p.netReceivableBalance);
        if (bal.greaterThan(0)) totalReceivables = addMoney(totalReceivables, bal);
      }

      let liquidTotal = toDecimal(0);
      const wealthDistributionPie = [];
      let paletteIdx = 0;
      const colors = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#4F46E5", "#EA580C", "#10B981"];

      for (const v of vaults) {
        const balNum = toDecimal(v.currentBalance).toNumber();
        if (balNum > 0) {
          liquidTotal = addMoney(liquidTotal, toDecimal(v.currentBalance));
          wealthDistributionPie.push({
            id: paletteIdx,
            label: v.name,
            value: balNum,
            color: v.colorHex || colors[paletteIdx % colors.length],
          });
          paletteIdx++;
        }
      }

      // Add Third-Party Receivables slice if any
      const recNum = totalReceivables.toNumber();
      if (recNum > 0) {
        wealthDistributionPie.push({
          id: paletteIdx,
          label: "Piutang Teman / Pihak Ketiga",
          value: recNum,
          color: "#38BDF8",
        });
      }

      // If no transactions yet, show starting baseline from current vaults
      if (wealthTimeline.length === 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        wealthTimeline = [{ date: todayStr, wealth: liquidTotal.toNumber() }];
      }

      return NextResponse.json({
        success: true,
        data: {
          wealthTimeline,
          wealthDistributionPie,
          totalLiquid: roundMoney(liquidTotal),
          totalReceivables: roundMoney(totalReceivables),
          netTotalWealth: roundMoney(addMoney(liquidTotal, totalReceivables)),
        },
      });
    }

    // ==========================================
    // 2. ACTION CARD HISTORY
    // ==========================================
    if (targetType === "CARD") {
      const cardId = parseInt(targetId, 10);
      const card = await prisma.actionCard.findUnique({
        where: { id: cardId },
        include: { habitStats: true, defaultVault: true, defaultCategory: true },
      });
      if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });

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

    // ==========================================
    // 3. VAULT HISTORY
    // ==========================================
    if (targetType === "VAULT") {
      const vaultId = parseInt(targetId, 10);
      const vault = await prisma.vault.findUnique({
        where: { id: vaultId },
      });
      if (!vault) return NextResponse.json({ success: false, error: "Vault not found" }, { status: 404 });

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

    // ==========================================
    // 4. LAYER CONSUMPTION BREAKDOWN
    // ==========================================
    if (targetType === "LAYER") {
      const commitmentType = targetId;

      const txs = await prisma.transaction.findMany({
        where: { commitmentType },
        include: { category: true },
        orderBy: { transactionDate: "asc" },
      });

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

    // ==========================================
    // 5. PARTY DEBT HISTORY
    // ==========================================
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
