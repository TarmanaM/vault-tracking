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
  let cooldownPenalty = 0;
  if (stats.lastUsedDate) {
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

  // Add manual pin priority bonus (1-10 mapped to 0-20 points)
  const pinBonus = (card.pinPriority || 0) * 2;

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 80 + pinBonus)));
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

  await tx.cardHabitStats.update({
    where: { cardId },
    data: {
      totalUses: { increment: 1 },
      hourCountsJson: JSON.stringify(hourCounts),
      dowCountsJson: JSON.stringify(dowCounts),
      avgIntervalDays: newAvgInterval,
      lastUsedTimestamp: now,
      lastUsedDate: now,
      mostFrequentAmount: amount ? toDecimal(amount) : stats.mostFrequentAmount,
      mostFrequentVaultId: vaultId || stats.mostFrequentVaultId,
    },
  });
}

