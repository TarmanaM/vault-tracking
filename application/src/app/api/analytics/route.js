// API Route: GET /api/analytics
// Returns Wealth Journey (#5), Cashflow Waterfall (#4), Daily/Monthly Consumption (#1, #2),
// Top Consumptive (#3), Vault Usage Frequency (#6), MoM Comparison (#24), and Date Range Filtering (#xx)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function computeLinearRegression(points) {
  const n = points.length;
  if (n < 2) {
    return points.map((p) => p.y);
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += points[i].y;
    sumXY += i * points[i].y;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return points.map((p) => p.y);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return points.map((_, i) => Number((intercept + slope * i).toFixed(2)));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("type"); // WEALTH_JOURNEY, CARD, VAULT, LAYER, PARTY
    const targetId = searchParams.get("id");
    const preset = searchParams.get("preset") || "3M"; // 1M, 3M, 6M, YTD, ALL, CUSTOM
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!targetType) {
      return NextResponse.json({ success: false, error: "type parameter is required" }, { status: 400 });
    }

    // ====================================================================
    // 1. WEALTH JOURNEY, WATERFALL, CONSUMPTION TRENDS & VAULT FREQUENCY
    // ====================================================================
    if (targetType === "WEALTH_JOURNEY") {
      // Load full chronological transactions to build exact running net wealth & comparison baseline
      const allTxs = await prisma.transaction.findMany({
        include: {
          legs: { include: { vault: true } },
          debtLedgerEntries: true,
          category: true,
          party: true,
        },
        orderBy: [{ transactionDate: "asc" }, { transactionTime: "asc" }, { id: "asc" }],
      });

      const vaults = await prisma.vault.findMany({
        where: { isActive: true },
        orderBy: { currentBalance: "desc" },
      });

      const parties = await prisma.party.findMany({
        where: { isActive: true },
      });

      // Resolve date bounds anchored on latest transaction date (#xx)
      const latestTxDate = allTxs.length > 0 ? new Date(allTxs[allTxs.length - 1].transactionDate) : new Date();
      let filterStart = null;
      let filterEnd = null;

      if (preset === "CUSTOM") {
        if (startDateParam) filterStart = new Date(`${startDateParam}T00:00:00`);
        if (endDateParam) filterEnd = new Date(`${endDateParam}T23:59:59.999`);
      } else if (preset !== "ALL") {
        filterEnd = new Date(latestTxDate);
        filterEnd.setHours(23, 59, 59, 999);
        filterStart = new Date(latestTxDate);
        if (preset === "1M") filterStart.setMonth(filterStart.getMonth() - 1);
        else if (preset === "3M") filterStart.setMonth(filterStart.getMonth() - 3);
        else if (preset === "6M") filterStart.setMonth(filterStart.getMonth() - 6);
        else if (preset === "YTD") filterStart = new Date(latestTxDate.getFullYear(), 0, 1);
        filterStart.setHours(0, 0, 0, 0);
      }

      // Compute full chronological Net Wealth curve (including non-vault debts & write-offs)
      const vaultState = {};
      for (const v of vaults) vaultState[v.id] = toDecimal(0);
      let runningNetRec = toDecimal(0);
      let runningNetPay = toDecimal(0);

      const dailyWealthAll = new Map(); // date -> netWealth
      const monthEndWealth = new Map(); // YYYY-MM -> netWealth
      let initialAnchorTotalWealth = null;

      for (const tx of allTxs) {
        const txDateStr = tx.transactionDate.toISOString().split("T")[0];
        const ym = txDateStr.slice(0, 7);

        for (const leg of tx.legs) {
          vaultState[leg.vaultId] = addMoney(vaultState[leg.vaultId] || 0, leg.netMutation);
        }

        for (const de of tx.debtLedgerEntries) {
          const amt = toDecimal(de.amount);
          if (de.entryCategory === "RECEIVABLE") {
            runningNetRec = de.direction === "INCREASE" ? addMoney(runningNetRec, amt) : subMoney(runningNetRec, amt);
          } else if (de.entryCategory === "PAYABLE") {
            runningNetPay = de.direction === "INCREASE" ? addMoney(runningNetPay, amt) : subMoney(runningNetPay, amt);
          }
        }

        let liquidSum = toDecimal(0);
        for (const vBal of Object.values(vaultState)) {
          liquidSum = addMoney(liquidSum, vBal);
        }
        const netWealthSnapshot = subMoney(addMoney(liquidSum, runningNetRec), runningNetPay).toNumber();

        dailyWealthAll.set(txDateStr, netWealthSnapshot);
        monthEndWealth.set(ym, netWealthSnapshot);

        if (tx.nature === "INITIAL_FUND") {
          initialAnchorTotalWealth = netWealthSnapshot;
        }
      }

      // Live aggregate totals from database tables
      let liquidTotal = toDecimal(0);
      let heldPoolTotal = toDecimal(0);
      let liabilityVaultPayable = toDecimal(0);
      const wealthDistributionPie = [];
      let paletteIdx = 0;
      const colors = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#4F46E5", "#EA580C", "#10B981"];

      for (const v of vaults) {
        const balDec = toDecimal(v.currentBalance);
        const balNum = balDec.toNumber();
        if (v.vaultType === "LIABILITY_CREDIT_LINE") {
          if (balDec.lessThan(0)) liabilityVaultPayable = addMoney(liabilityVaultPayable, balDec.abs());
        } else if (v.vaultType === "HELD_POOL") {
          heldPoolTotal = addMoney(heldPoolTotal, balDec);
        } else {
          liquidTotal = addMoney(liquidTotal, balDec);
        }

        if (balNum > 0) {
          wealthDistributionPie.push({
            id: paletteIdx,
            label: v.name,
            value: balNum,
            color: v.colorHex || colors[paletteIdx % colors.length],
          });
          paletteIdx++;
        }
      }

      let totalReceivables = toDecimal(0);
      let totalPartyPayables = toDecimal(0);
      for (const p of parties) {
        totalReceivables = addMoney(totalReceivables, p.receivableBalance);
        totalPartyPayables = addMoney(totalPartyPayables, p.payableBalance);
      }

      const totalPayables = addMoney(liabilityVaultPayable, totalPartyPayables);
      const recNum = totalReceivables.toNumber();
      if (recNum > 0) {
        wealthDistributionPie.push({
          id: paletteIdx,
          label: "Piutang Teman / Pihak Ketiga",
          value: recNum,
          color: "#38BDF8",
        });
      }

      const netTotalWealthDec = subMoney(
        addMoney(addMoney(liquidTotal, heldPoolTotal), totalReceivables),
        totalPayables
      );
      const netTotalWealthNum = roundMoney(netTotalWealthDec).toNumber();

      // #24 Month-over-Month Net Wealth comparison (with Initial Baseline fallback)
      const monthKeys = Array.from(monthEndWealth.keys()).sort();
      let baselineWealth = null;
      let comparisonLabel = "vs Last Month";

      if (monthKeys.length >= 2) {
        const prevMonthKey = monthKeys[monthKeys.length - 2];
        baselineWealth = monthEndWealth.get(prevMonthKey);
        comparisonLabel = `vs ${prevMonthKey}`;
      } else if (initialAnchorTotalWealth !== null && initialAnchorTotalWealth > 0) {
        baselineWealth = initialAnchorTotalWealth;
        comparisonLabel = "vs Initial Baseline";
      }

      let wealthComparison = {
        deltaAmount: 0,
        deltaPercent: 0,
        direction: "FLAT",
        comparisonLabel: "First Baseline",
      };

      if (baselineWealth !== null && baselineWealth !== 0) {
        const delta = netTotalWealthNum - baselineWealth;
        const pct = (delta / Math.abs(baselineWealth)) * 100;
        wealthComparison = {
          deltaAmount: Number(delta.toFixed(2)),
          deltaPercent: Number(pct.toFixed(2)),
          direction: delta > 0.01 ? "UP" : delta < -0.01 ? "DOWN" : "FLAT",
          comparisonLabel,
        };
      }

      // Filter transactions within selected date range for range-sensitive charts
      const inRangeTxs = allTxs.filter((tx) => {
        if (filterStart && tx.transactionDate < filterStart) return false;
        if (filterEnd && tx.transactionDate > filterEnd) return false;
        return true;
      });

      // #5 Wealth Trajectory Timeline (filtered by date range)
      let wealthTimeline = Array.from(dailyWealthAll.entries())
        .filter(([dateStr]) => {
          const d = new Date(`${dateStr}T12:00:00`);
          if (filterStart && d < filterStart) return false;
          if (filterEnd && d > filterEnd) return false;
          return true;
        })
        .map(([date, wealth]) => ({ date, wealth }));

      if (wealthTimeline.length === 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        wealthTimeline = [{ date: todayStr, wealth: netTotalWealthNum }];
      }

      // #4 (4.png) Cashflow Waterfall Chart: daily net (Debit - Kredit) excluding INITIAL_FUND & TRANSFER
      const dailyCashflowMap = new Map();
      for (const tx of inRangeTxs) {
        if (tx.nature === "INITIAL_FUND" || tx.nature === "TRANSFER" || tx.nature === "DEBT_OFFSET") {
          continue;
        }
        const dateStr = tx.transactionDate.toISOString().split("T")[0];
        if (!dailyCashflowMap.has(dateStr)) {
          dailyCashflowMap.set(dateStr, { inflow: toDecimal(0), outflow: toDecimal(0) });
        }
        const bucket = dailyCashflowMap.get(dateStr);
        for (const leg of tx.legs) {
          bucket.inflow = addMoney(bucket.inflow, leg.debitIn);
          bucket.outflow = addMoney(bucket.outflow, leg.creditOut);
        }
      }

      const waterfallData = [];
      let wfRunning = 0;
      for (const [date, flow] of Array.from(dailyCashflowMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const delta = subMoney(flow.inflow, flow.outflow).toNumber();
        if (delta === 0) continue;

        const prev = wfRunning;
        const curr = Number((prev + delta).toFixed(2));
        wfRunning = curr;

        const low = Math.min(prev, curr);
        const high = Math.max(prev, curr);
        const isPositive = delta >= 0;

        // Stacked interval segments supporting positive, negative, and zero-crossing bars cleanly
        let posBase = 0;
        let negBase = 0;
        let inflowPos = 0;
        let inflowNeg = 0;
        let outflowPos = 0;
        let outflowNeg = 0;

        if (low >= 0) {
          posBase = low;
          if (isPositive) inflowPos = high - low;
          else outflowPos = high - low;
        } else if (high <= 0) {
          negBase = high;
          if (isPositive) inflowNeg = -(high - low);
          else outflowNeg = -(high - low);
        } else {
          // Crosses zero
          if (isPositive) {
            inflowNeg = low;
            inflowPos = high;
          } else {
            outflowNeg = low;
            outflowPos = high;
          }
        }

        waterfallData.push({
          date,
          delta: Number(delta.toFixed(2)),
          prev,
          runningSubtotal: curr,
          isPositive,
          inflow: flow.inflow.toNumber(),
          outflow: flow.outflow.toNumber(),
          posBase,
          negBase,
          inflowPos,
          inflowNeg,
          outflowPos,
          outflowNeg,
        });
      }

      // #1 (1..png) Daily Consumption (negative values <= 0, skipping 0-consume days) + Trendline
      const dailyConsumeMap = new Map();
      // #2 (2.png) Monthly Consumption (negative values <= 0)
      const monthlyConsumeMap = new Map();
      // #3 (3.png) Consumptive transactions list
      const consumptiveTxList = [];
      // #6 Vault usage count (excluding INITIAL_FUND)
      const vaultCountMap = new Map();

      for (const tx of inRangeTxs) {
        const cDec = toDecimal(tx.consumeAmount);
        if (cDec.lessThan(0)) {
          const dateStr = tx.transactionDate.toISOString().split("T")[0];
          dailyConsumeMap.set(dateStr, (dailyConsumeMap.get(dateStr) || 0) + cDec.toNumber());
          monthlyConsumeMap.set(tx.monthTag, (monthlyConsumeMap.get(tx.monthTag) || 0) + cDec.toNumber());

          consumptiveTxList.push({
            id: tx.id,
            title: tx.title,
            date: dateStr,
            time: tx.transactionTime,
            amount: cDec.toNumber(),
            categoryName: tx.category?.name || "Uncategorized",
            vaultName: tx.legs?.[0]?.vault?.name || "External / Loan",
          });
        }

        if (tx.nature !== "INITIAL_FUND") {
          for (const leg of tx.legs) {
            const vName = leg.vault?.name || `Vault #${leg.vaultId}`;
            const cur = vaultCountMap.get(leg.vaultId) || { vaultId: leg.vaultId, name: vName, color: leg.vault?.colorHex || "#2563EB", count: 0 };
            cur.count += 1;
            vaultCountMap.set(leg.vaultId, cur);
          }
        }
      }

      const dailySorted = Array.from(dailyConsumeMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const trendValues = computeLinearRegression(dailySorted.map(([, y], i) => ({ x: i, y })));
      const dailyConsumption = dailySorted.map(([date, consume], idx) => ({
        date,
        consume: Number(consume.toFixed(2)),
        trend: trendValues[idx],
      }));

      const monthlyConsumption = Array.from(monthlyConsumeMap.entries()).map(([month, consume]) => ({
        month,
        consume: Number(consume.toFixed(2)),
      }));

      // Sort consumptive transactions from largest negative spend (e.g. -80000 before -10000)
      consumptiveTxList.sort((a, b) => a.amount - b.amount);
      const topConsumptiveTransactions = consumptiveTxList.slice(0, 15);

      // Vault usage frequency sorted descending
      const vaultFreqList = Array.from(vaultCountMap.values()).sort((a, b) => b.count - a.count);
      const totalVaultUses = vaultFreqList.reduce((acc, item) => acc + item.count, 0);
      const vaultFrequency = vaultFreqList.map((item) => ({
        ...item,
        percent: totalVaultUses > 0 ? Number(((item.count / totalVaultUses) * 100).toFixed(1)) : 0,
      }));

      return NextResponse.json({
        success: true,
        data: {
          wealthTimeline,
          waterfallData,
          dailyConsumption,
          monthlyConsumption,
          topConsumptiveTransactions,
          vaultFrequency,
          wealthComparison,
          wealthDistributionPie,
          totalLiquid: roundMoney(addMoney(liquidTotal, heldPoolTotal)),
          totalReceivables: roundMoney(totalReceivables),
          totalPayables: roundMoney(totalPayables),
          netTotalWealth: roundMoney(netTotalWealthDec),
          dateRangeApplied: {
            preset,
            startDate: filterStart ? filterStart.toISOString().split("T")[0] : null,
            endDate: filterEnd ? filterEnd.toISOString().split("T")[0] : null,
            latestTxDate: latestTxDate.toISOString().split("T")[0],
          },
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
        where:
          commitmentType === "RECONCILIATION_LOST"
            ? { nature: "RECONCILIATION_LOST" }
            : { commitmentType },
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
          title: `Layer ${commitmentType.replace(/_/g, " ")}`,
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
          receivableBalance: roundMoney(party.receivableBalance),
          payableBalance: roundMoney(party.payableBalance),
          netReceivableBalance: roundMoney(party.netReceivableBalance),
          debtHistory,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Error in GET /api/analytics:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
