// 100% In-House Habit Scoring Algorithm (Non-AI, Non-OCR)
// Ranks action cards dynamically based on time-of-day, day-of-week, and cadence intervals

import { toDecimal } from "./money.js";

/**
 * Calculate relevance score (0 - 100) for an Action Card at a specific datetime
 * @param {Object} card ActionCard model with habitStats relation
 * @param {Date} now Current reference Date object
 * @returns {number} Score from 0 to 100
 */
export function calculateCardScore(card, now = new Date()) {
  const stats = card.habitStats;
  if (!stats) return card.pinPriority * 10;

  const currentHour = now.getHours(); // 0 - 23
  // getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday -> map to Mon=0..Sun=6
  const jsDay = now.getDay();
  const currentDow = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 1=Tue, ..., 6=Sun

  // 1. Time-of-Day Score (Weight: 35%)
  // Window of currentHour - 1, currentHour, currentHour + 1
  let hourCounts = [];
  try {
    hourCounts = JSON.parse(stats.hourCountsJson || "[]");
  } catch {
    hourCounts = new Array(24).fill(0);
  }

  const prevHour = (currentHour + 23) % 24;
  const nextHour = (currentHour + 1) % 24;
  const hourHits = (hourCounts[prevHour] || 0) * 0.5 + (hourCounts[currentHour] || 0) + (hourCounts[nextHour] || 0) * 0.5;
  const totalHourUses = hourCounts.reduce((sum, c) => sum + c, 0) || 1;
  const hourScore = Math.min(1.0, (hourHits / totalHourUses) * 3); // Normalized

  // 2. Day-of-Week Score (Weight: 20%)
  let dowCounts = [];
  try {
    dowCounts = JSON.parse(stats.dowCountsJson || "[]");
  } catch {
    dowCounts = new Array(7).fill(0);
  }
  const dowHits = dowCounts[currentDow] || 0;
  const totalDowUses = dowCounts.reduce((sum, c) => sum + c, 0) || 1;
  const dowScore = Math.min(1.0, (dowHits / totalDowUses) * 2.5);

  // 3. Cadence / Interval Due Score (Weight: 30%)
  let intervalScore = 0.5;
  if (stats.lastUsedDate && stats.avgIntervalDays && stats.avgIntervalDays > 0) {
    const lastDate = new Date(stats.lastUsedDate);
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    // Gaussian bell curve centered on avgIntervalDays
    const sigma = Math.max(1.0, stats.stdIntervalDays || (stats.avgIntervalDays * 0.3));
    const dist = diffDays - stats.avgIntervalDays;
    intervalScore = Math.exp(-(dist * dist) / (2 * sigma * sigma));
  } else if (card.expectedCadence === "DAILY_WORKDAY" && currentDow <= 4) {
    intervalScore = 0.9;
  } else if (card.expectedCadence === "DAILY_ANY") {
    intervalScore = 0.8;
  }

  // 4. Overall Frequency Score (Weight: 15%)
  const freqScore = Math.min(1.0, (stats.totalUses || 0) / 20);

  // 5. Cooldown Penalty (Anti-spam for single-use daily items)
  // Temporarily grant a 24h New Card Spotlight when pinPriority >= 8 so promoted cards surface immediately
  const createdAtDate = card.createdAt ? new Date(card.createdAt) : null;
  const ageMs =
    createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? now.getTime() - createdAtDate.getTime()
      : Infinity;
  const isNewSpotlight =
    ageMs >= -60000 && ageMs < 24 * 60 * 60 * 1000 && (card.pinPriority || 0) >= 8;

  let cooldownPenalty = 0;
  if (!isNewSpotlight && stats.lastUsedDate) {
    const lastDate = new Date(stats.lastUsedDate);
    const isSameDay =
      lastDate.getFullYear() === now.getFullYear() &&
      lastDate.getMonth() === now.getMonth() &&
      lastDate.getDate() === now.getDate();

    if (isSameDay && (card.expectedCadence === "DAILY_WORKDAY" || card.cardActionType === "EXPENSE")) {
      // If used today, reduce score so next cards surface
      cooldownPenalty = 0.4;
    }
  }

  const rawScore =
    0.35 * hourScore +
    0.20 * dowScore +
    0.30 * intervalScore +
    0.15 * freqScore -
    cooldownPenalty;

  // Add manual pin priority bonus (1-10 mapped to 0-20 points) and temporary 24h spotlight boost
  const pinBonus = (card.pinPriority || 0) * 2;
  const spotlightBonus = isNewSpotlight ? 25 : 0;

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 80 + pinBonus + spotlightBonus)));
  return finalScore;
}

/**
 * Increment habit histogram statistics when an action card is submitted
 */
export async function recordCardUsage(tx, cardId, amount, vaultId, now = new Date()) {
  const stats = await tx.cardHabitStats.findUnique({ where: { cardId } });
  if (!stats) return;

  const currentHour = now.getHours();
  const jsDay = now.getDay();
  const currentDow = jsDay === 0 ? 6 : jsDay - 1;

  let hourCounts = JSON.parse(stats.hourCountsJson || "[]");
  if (hourCounts.length !== 24) hourCounts = new Array(24).fill(0);
  hourCounts[currentHour] = (hourCounts[currentHour] || 0) + 1;

  let dowCounts = JSON.parse(stats.dowCountsJson || "[]");
  if (dowCounts.length !== 7) dowCounts = new Array(7).fill(0);
  dowCounts[currentDow] = (dowCounts[currentDow] || 0) + 1;

  // Calculate new average interval
  let newAvgInterval = stats.avgIntervalDays;
  if (stats.lastUsedDate) {
    const lastDate = new Date(stats.lastUsedDate);
    const diffDays = Math.max(0, (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (!newAvgInterval) {
      newAvgInterval = diffDays;
    } else {
      newAvgInterval = newAvgInterval * 0.7 + diffDays * 0.3; // Exponential moving average
    }
  }

  const existingLastDate = stats.lastUsedDate ? new Date(stats.lastUsedDate) : null;
  const effectiveLastDate =
    existingLastDate && existingLastDate.getTime() > now.getTime() ? existingLastDate : now;

  await tx.cardHabitStats.update({
    where: { cardId },
    data: {
      totalUses: { increment: 1 },
      hourCountsJson: JSON.stringify(hourCounts),
      dowCountsJson: JSON.stringify(dowCounts),
      avgIntervalDays: newAvgInterval,
      lastUsedTimestamp: effectiveLastDate,
      lastUsedDate: effectiveLastDate,
      mostFrequentAmount: amount ? toDecimal(amount) : stats.mostFrequentAmount,
      mostFrequentVaultId: vaultId || stats.mostFrequentVaultId,
    },
  });
}

/**
 * Resolve a Transaction's full local timestamp by combining transactionDate and "HH:mm" transactionTime.
 * @param {Object} txRow Transaction record
 * @returns {Date}
 */
export function resolveTransactionTimestamp(txRow) {
  const base = txRow?.transactionDate ? new Date(txRow.transactionDate) : new Date(txRow?.createdAt || Date.now());
  if (Number.isNaN(base.getTime())) return new Date();

  if (typeof txRow?.transactionTime === "string") {
    const match = txRow.transactionTime.trim().match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = Math.min(23, Math.max(0, Number(match[1])));
      const mins = Math.min(59, Math.max(0, Number(match[2])));
      base.setHours(hours, mins, 0, 0);
    }
  }
  return base;
}

/**
 * Determine the primary vault ID associated with a transaction's legs.
 * Prefers the PRIMARY leg role or outflow (negative netMutation) leg.
 * @param {Object} txRow Transaction record with optional legs array
 * @returns {number|null}
 */
export function resolvePrimaryVaultId(txRow) {
  const legs = Array.isArray(txRow?.legs) ? txRow.legs : [];
  if (legs.length === 0) return null;

  const primaryLeg = legs.find((leg) => leg.vaultId != null && leg.legRole === "PRIMARY");
  if (primaryLeg) return primaryLeg.vaultId;

  const outLeg = legs.find(
    (leg) => leg.vaultId != null && Number(leg.netMutation ?? leg.amount ?? 0) < 0
  );
  if (outLeg) return outLeg.vaultId;

  const anyVaultLeg = legs.find((leg) => leg.vaultId != null);
  return anyVaultLeg ? anyVaultLeg.vaultId : null;
}

/**
 * Seed or rebuild CardHabitStats chronologically from an array of Transaction records (with legs).
 * @param {Object} tx Prisma transaction client
 * @param {number} cardId ActionCard ID
 * @param {Array<Object>} transactions Matching Transaction records
 * @param {number|null} preferredVaultId Fallback vault ID if no leg contains a vault
 * @param {number|null} preferredAmount Fallback default amount
 */
export async function seedCardHabitStatsFromTransactions(
  tx,
  cardId,
  transactions = [],
  preferredVaultId = null,
  preferredAmount = null
) {
  const hourCounts = new Array(24).fill(0);
  const dowCounts = new Array(7).fill(0);
  const timestamps = [];
  const amountFreq = new Map();
  const vaultFreq = new Map();

  const sorted = [...transactions].sort(
    (a, b) => resolveTransactionTimestamp(a).getTime() - resolveTransactionTimestamp(b).getTime()
  );

  for (const row of sorted) {
    const ts = resolveTransactionTimestamp(row);
    timestamps.push(ts);

    const h = ts.getHours();
    const jsDay = ts.getDay();
    const dow = jsDay === 0 ? 6 : jsDay - 1;
    hourCounts[h] = (hourCounts[h] || 0) + 1;
    dowCounts[dow] = (dowCounts[dow] || 0) + 1;

    const amtVal = row.originalGrossAmount ?? row.grossAmount;
    if (amtVal != null) {
      const amtKey = toDecimal(amtVal).toFixed(2);
      amountFreq.set(amtKey, (amountFreq.get(amtKey) || 0) + 1);
    }

    const vId = resolvePrimaryVaultId(row);
    if (vId != null) {
      vaultFreq.set(vId, (vaultFreq.get(vId) || 0) + 1);
    }
  }

  let avgIntervalDays = null;
  let stdIntervalDays = null;
  if (timestamps.length >= 2) {
    const diffs = [];
    for (let i = 1; i < timestamps.length; i += 1) {
      const diff = Math.max(0, (timestamps[i].getTime() - timestamps[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      diffs.push(diff);
    }
    const mean = diffs.reduce((acc, d) => acc + d, 0) / diffs.length;
    avgIntervalDays = mean;
    if (diffs.length >= 2) {
      const variance = diffs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / diffs.length;
      stdIntervalDays = Math.sqrt(variance);
    }
  }

  let topAmount = preferredAmount != null ? toDecimal(preferredAmount) : null;
  let topAmountCount = -1;
  for (const [amtKey, count] of amountFreq.entries()) {
    if (count > topAmountCount) {
      topAmountCount = count;
      topAmount = toDecimal(amtKey);
    }
  }

  let topVaultId = preferredVaultId ?? null;
  let topVaultCount = -1;
  for (const [vId, count] of vaultFreq.entries()) {
    if (count > topVaultCount) {
      topVaultCount = count;
      topVaultId = vId;
    }
  }

  const lastTs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
  const statsData = {
    totalUses: sorted.length,
    hourCountsJson: JSON.stringify(hourCounts),
    dowCountsJson: JSON.stringify(dowCounts),
    avgIntervalDays,
    stdIntervalDays,
    lastUsedTimestamp: lastTs,
    lastUsedDate: lastTs,
    mostFrequentAmount: topAmount,
    mostFrequentVaultId: topVaultId,
  };

  return tx.cardHabitStats.upsert({
    where: { cardId },
    update: statsData,
    create: {
      cardId,
      ...statsData,
    },
  });
}

