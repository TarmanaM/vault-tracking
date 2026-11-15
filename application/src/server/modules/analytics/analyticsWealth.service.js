// Server Module: Analytics Wealth Journey Service
// Computes Wealth Journey, Cashflow Waterfall, Daily/Monthly Consumption, Top Consumptive, and Vault Frequency

import prisma from "@/server/db/prisma";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/shared/money";
import {
  ensureFxRatesSyncedIfDue,
  getOrCreateAppSettings,
  getCachedRateMap,
} from "@/lib/fxService";
import { computeVaultPartitionSummary } from "@/lib/subVaultService";

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

export async function getWealthJourneyAnalytics(userId, { preset = "3M", startDateParam, endDateParam }) {
  await ensureFxRatesSyncedIfDue(userId);
  const appSettings = await getOrCreateAppSettings(userId);
  const baseCurrency = String(appSettings.baseCurrency || "IDR").toUpperCase();
  const rateMap = await getCachedRateMap(baseCurrency);

  const allTxs = await prisma.transaction.findMany({
    where: { userId },
    include: {
      legs: { include: { vault: true } },
      debtLedgerEntries: true,
      category: true,
      party: true,
    },
    orderBy: [{ transactionDate: "asc" }, { transactionTime: "asc" }, { id: "asc" }],
  });

  const rawVaults = await prisma.vault.findMany({
    where: { userId, isActive: true },
    include: {
      subContainers: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { currentBalance: "desc" },
  });

  const vaults = rawVaults.map((v) => {
    const partitionSummary = computeVaultPartitionSummary(v, baseCurrency, rateMap);
    return {
      ...v,
      partitionSummary,
      totalEstimatedBase: partitionSummary.totalEstimatedBase,
    };
  });

  const parties = await prisma.party.findMany({
    where: { userId, isActive: true },
  });

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

  const vaultState = {};
  for (const v of vaults) vaultState[v.id] = toDecimal(0);
  let runningNetRec = toDecimal(0);
  let runningNetPay = toDecimal(0);

  const dailyWealthAll = new Map();
  const monthEndWealth = new Map();
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

  let liquidTotal = toDecimal(0);
  let liabilityVaultPayable = toDecimal(0);
  const wealthDistributionPie = [];
  let paletteIdx = 0;
  const colors = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#4F46E5", "#EA580C", "#10B981"];

  for (const v of vaults) {
    const balDec = toDecimal(v.totalEstimatedBase ?? v.currentBalance);
    const balNum = balDec.toNumber();
    if (v.vaultType === "LIABILITY_CREDIT_LINE") {
      if (balDec.lessThan(0)) liabilityVaultPayable = addMoney(liabilityVaultPayable, balDec.abs());
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
      label: "Third-Party Receivables",
      value: recNum,
      color: "#38BDF8",
    });
  }

  const netTotalWealthDec = subMoney(
    addMoney(liquidTotal, totalReceivables),
    totalPayables
  );
  const netTotalWealthNum = roundMoney(netTotalWealthDec).toNumber();

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

  const inRangeTxs = allTxs.filter((tx) => {
    if (filterStart && tx.transactionDate < filterStart) return false;
    if (filterEnd && tx.transactionDate > filterEnd) return false;
    return true;
  });

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

  const dailyConsumeMap = new Map();
  const monthlyConsumeMap = new Map();
  const consumptiveTxList = [];
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
        const cur = vaultCountMap.get(leg.vaultId) || {
          vaultId: leg.vaultId,
          name: vName,
          color: leg.vault?.colorHex || "#2563EB",
          count: 0,
        };
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

  consumptiveTxList.sort((a, b) => a.amount - b.amount);
  const topConsumptiveTransactions = consumptiveTxList.slice(0, 15);

  let totalVaultUses = 0;
  for (const cnt of vaultCountMap.values()) {
    totalVaultUses += cnt.count;
  }

  const vaultFrequency = vaults
    .map((v) => {
      const hit = vaultCountMap.get(v.id);
      const count = hit ? hit.count : 0;
      const balNum = toDecimal(v.totalEstimatedBase ?? v.currentBalance).toNumber();
      return {
        vaultId: v.id,
        name: v.name,
        color: v.colorHex || "#2563EB",
        vaultType: v.vaultType,
        currentBalance: Number(balNum.toFixed(2)),
        count,
        percent: totalVaultUses > 0 ? Number(((count / totalVaultUses) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => {
      if (b.currentBalance !== a.currentBalance) return b.currentBalance - a.currentBalance;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

  return {
    baseCurrency,
    exchangeRates: rateMap,
    wealthTimeline,
    waterfallData,
    dailyConsumption,
    monthlyConsumption,
    topConsumptiveTransactions,
    vaultFrequency,
    wealthComparison,
    wealthDistributionPie,
    totalLiquid: roundMoney(liquidTotal),
    totalReceivables: roundMoney(totalReceivables),
    totalPayables: roundMoney(totalPayables),
    netTotalWealth: roundMoney(netTotalWealthDec),
    dateRangeApplied: {
      preset,
      startDate: filterStart ? filterStart.toISOString().split("T")[0] : null,
      endDate: filterEnd ? filterEnd.toISOString().split("T")[0] : null,
      latestTxDate: latestTxDate.toISOString().split("T")[0],
    },
  };
}
