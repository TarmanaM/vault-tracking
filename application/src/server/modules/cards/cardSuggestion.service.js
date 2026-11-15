// Server Module: Card Suggestion & Title Autocomplete Service
// Evaluates post-save card recommendations, dismissed keys, and title autocomplete suggestions

import prisma from "@/server/db/prisma";
import { resolveTransactionTimestamp } from "@/lib/habitEngine";
import {
  ELIGIBLE_PROMOTE_NATURES,
  extractCardDraftFromTransaction,
  makeSuggestionKey,
  normalizeCardTitle,
} from "@/shared/cardPromotionUtils";
import {
  PromotionError,
  parseOptionalInt,
  findMatchingActiveCard,
  findMatchingHistoricalTransactions,
} from "./cardPromote.service";

function parseDismissedKeys(rawJson) {
  try {
    const parsed = JSON.parse(rawJson || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
  } catch {
    return [];
  }
}

function pickTopMapEntry(freqMap) {
  let bestKey = null;
  let bestCount = -1;
  for (const [k, entry] of freqMap.entries()) {
    const count = typeof entry === "number" ? entry : entry.count;
    if (count > bestCount) {
      bestCount = count;
      bestKey = k;
    }
  }
  return bestKey;
}

function summarizeMatchingTransactionPattern(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const sortedAsc = [...rows].sort(
    (a, b) => resolveTransactionTimestamp(a).getTime() - resolveTransactionTimestamp(b).getTime()
  );
  const latestTx = sortedAsc[sortedAsc.length - 1];

  const amountFreq = new Map();
  const vaultFreq = new Map();
  const subFreq = new Map();
  const targetVaultFreq = new Map();
  const targetSubFreq = new Map();
  const categoryFreq = new Map();
  const partyFreq = new Map();
  const hourFreq = new Map();
  const timestamps = [];
  const vaultNamesById = new Map();

  for (const txRow of sortedAsc) {
    const ts = resolveTransactionTimestamp(txRow);
    timestamps.push(ts);
    const h = ts.getHours();
    hourFreq.set(h, (hourFreq.get(h) || 0) + 1);

    const draft = extractCardDraftFromTransaction(txRow);
    if (!draft) continue;

    for (const leg of txRow.legs || []) {
      if (leg.vaultId != null && leg.vault?.name) {
        vaultNamesById.set(leg.vaultId, leg.vault.name);
      }
    }

    if (draft.defaultAmount > 0) {
      const amtKey = `${draft.currency || "IDR"}::${draft.defaultAmount}`;
      const prev = amountFreq.get(amtKey) || { count: 0, amount: draft.defaultAmount, currency: draft.currency || "IDR" };
      amountFreq.set(amtKey, { ...prev, count: prev.count + 1 });
    }
    if (draft.defaultVaultId != null) {
      vaultFreq.set(draft.defaultVaultId, (vaultFreq.get(draft.defaultVaultId) || 0) + 1);
    }
    if (draft.defaultSubContainerId != null) {
      subFreq.set(draft.defaultSubContainerId, (subFreq.get(draft.defaultSubContainerId) || 0) + 1);
    }
    if (draft.targetVaultId != null) {
      targetVaultFreq.set(draft.targetVaultId, (targetVaultFreq.get(draft.targetVaultId) || 0) + 1);
    }
    if (draft.targetSubContainerId != null) {
      targetSubFreq.set(draft.targetSubContainerId, (targetSubFreq.get(draft.targetSubContainerId) || 0) + 1);
    }
    if (draft.defaultCategoryId != null) {
      categoryFreq.set(draft.defaultCategoryId, (categoryFreq.get(draft.defaultCategoryId) || 0) + 1);
    }
    if (draft.defaultPartyId != null) {
      partyFreq.set(draft.defaultPartyId, (partyFreq.get(draft.defaultPartyId) || 0) + 1);
    }
  }

  let avgIntervalDays = null;
  if (timestamps.length >= 2) {
    let totalDiffDays = 0;
    for (let i = 1; i < timestamps.length; i += 1) {
      totalDiffDays += Math.max(
        0,
        (timestamps[i].getTime() - timestamps[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    avgIntervalDays = totalDiffDays / (timestamps.length - 1);
  }

  const topAmountKey = pickTopMapEntry(amountFreq);
  const topAmountObj = topAmountKey ? amountFreq.get(topAmountKey) : null;
  const topVaultId = pickTopMapEntry(vaultFreq);
  const topHour = pickTopMapEntry(hourFreq);

  return {
    occurrenceCount: sortedAsc.length,
    latestTransaction: latestTx,
    latestTimestamp: timestamps[timestamps.length - 1],
    mostFrequentAmount: topAmountObj ? topAmountObj.amount : Number(latestTx.originalGrossAmount ?? latestTx.grossAmount ?? 0),
    currency: topAmountObj?.currency || latestTx.currency || "IDR",
    mostFrequentVaultId: topVaultId,
    mostFrequentVaultName: topVaultId != null ? vaultNamesById.get(topVaultId) || null : null,
    mostFrequentSubContainerId: pickTopMapEntry(subFreq),
    mostFrequentTargetVaultId: pickTopMapEntry(targetVaultFreq),
    mostFrequentTargetSubContainerId: pickTopMapEntry(targetSubFreq),
    mostFrequentCategoryId: pickTopMapEntry(categoryFreq),
    mostFrequentPartyId: pickTopMapEntry(partyFreq),
    typicalHour: topHour,
    typicalHourLabel: topHour != null ? `${String(topHour).padStart(2, "0")}:00` : null,
    avgIntervalDays,
  };
}

/**
 * Retrieve dismissed suggestion keys stored in per-user AppSetting.
 */
export async function getDismissedCardSuggestionKeys(userId) {
  const uid = parseOptionalInt(userId);
  if (!uid) return [];
  const setting = await prisma.appSetting.upsert({
    where: { userId: uid },
    update: {},
    create: { userId: uid, baseCurrency: "IDR", fxSyncIntervalDays: 3 },
  });
  return parseDismissedKeys(setting.dismissedCardSuggestionsJson);
}

/**
 * Permanently mute save-time card suggestions for a (nature, title) pair for this user.
 */
export async function dismissCardSuggestionKey(userId, nature, title) {
  const uid = parseOptionalInt(userId);
  if (!uid) throw new PromotionError("Authenticated userId is required", 401, "UNAUTHORIZED");

  const key = makeSuggestionKey(nature, title);
  const setting = await prisma.appSetting.upsert({
    where: { userId: uid },
    update: {},
    create: { userId: uid, baseCurrency: "IDR", fxSyncIntervalDays: 3 },
  });
  const existing = parseDismissedKeys(setting.dismissedCardSuggestionsJson);
  if (!normalizeCardTitle(title) || existing.includes(key)) {
    return existing;
  }

  const updatedKeys = [...existing, key];
  await prisma.appSetting.update({
    where: { userId: uid },
    data: { dismissedCardSuggestionsJson: JSON.stringify(updatedKeys) },
  });
  return updatedKeys;
}

/**
 * Fetch combined autocomplete suggestions scoped to userId (ActionCards + grouped past Transactions).
 */
export async function getTransactionTitleSuggestions(userId, limit = 40) {
  const uid = parseOptionalInt(userId);
  if (!uid) {
    return { cards: [], historySuggestions: [] };
  }

  const [cards, recentTxs, setting] = await Promise.all([
    prisma.actionCard.findMany({
      where: {
        userId: uid,
        isActive: true,
        visibilityMode: { not: "ARCHIVED" },
      },
      include: {
        defaultVault: true,
        defaultSubContainer: true,
        targetVault: true,
        targetSubContainer: true,
        defaultCategory: true,
        defaultParty: true,
        habitStats: true,
      },
      orderBy: [{ pinPriority: "desc" }, { id: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        userId: uid,
        parentTransactionId: null,
        nature: { in: ELIGIBLE_PROMOTE_NATURES },
      },
      include: {
        legs: {
          include: {
            vault: true,
            subContainer: true,
          },
        },
        category: true,
        party: true,
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: 400,
    }),
    prisma.appSetting.findUnique({ where: { userId: uid } }),
  ]);

  const baseCcy = String(setting?.baseCurrency || "IDR").toUpperCase();
  const cardKeys = new Set(cards.map((c) => makeSuggestionKey(c.cardActionType, c.title)));

  const cardOptions = cards.map((card) => ({
    kind: "CARD",
    suggestionKey: makeSuggestionKey(card.cardActionType, card.title),
    cardId: card.id,
    title: card.title,
    nature: card.cardActionType || "EXPENSE",
    defaultAmount: card.defaultAmount != null ? Number(card.defaultAmount) : 0,
    currency: card.defaultSubContainer?.currency || baseCcy,
    sourceVaultId: card.defaultVaultId || null,
    sourceVaultName: card.defaultVault?.name || null,
    sourceSubContainerId: card.defaultSubContainerId || null,
    sourceSubContainerName: card.defaultSubContainer?.name || null,
    targetVaultId: card.targetVaultId || null,
    targetVaultName: card.targetVault?.name || null,
    targetSubContainerId: card.targetSubContainerId || null,
    targetSubContainerName: card.targetSubContainer?.name || null,
    categoryId: card.defaultCategoryId || null,
    categoryName: card.defaultCategory?.name || null,
    partyId: card.defaultPartyId || null,
    partyName: card.defaultParty?.name || null,
    totalUses: card.habitStats?.totalUses || 0,
  }));

  const grouped = new Map();
  for (const row of recentTxs) {
    const key = makeSuggestionKey(row.nature, row.title);
    if (!normalizeCardTitle(row.title) || cardKeys.has(key)) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const historyOptions = [];
  for (const [key, rows] of grouped.entries()) {
    const pattern = summarizeMatchingTransactionPattern(rows);
    if (!pattern) continue;
    historyOptions.push({
      kind: "HISTORY",
      suggestionKey: key,
      cardId: null,
      title: String(pattern.latestTransaction.title || "").trim(),
      nature: pattern.latestTransaction.nature,
      defaultAmount: pattern.mostFrequentAmount || 0,
      currency: pattern.currency || "IDR",
      sourceVaultId: pattern.mostFrequentVaultId || null,
      sourceVaultName: pattern.mostFrequentVaultName || null,
      sourceSubContainerId: pattern.mostFrequentSubContainerId || null,
      targetVaultId: pattern.mostFrequentTargetVaultId || null,
      targetSubContainerId: pattern.mostFrequentTargetSubContainerId || null,
      categoryId: pattern.mostFrequentCategoryId || null,
      partyId: pattern.mostFrequentPartyId || null,
      totalUses: pattern.occurrenceCount,
      latestTimestampMs: pattern.latestTimestamp.getTime(),
    });
  }

  historyOptions.sort((a, b) => {
    if (b.totalUses !== a.totalUses) return b.totalUses - a.totalUses;
    return b.latestTimestampMs - a.latestTimestampMs;
  });

  return {
    cards: cardOptions,
    historySuggestions: historyOptions.slice(0, limit),
  };
}

/**
 * Evaluate after saving a transaction whether the system should display
 * a persistent card suggestion dialog (LINK_EXISTING vs CREATE_CARD).
 */
export async function evaluatePostSaveCardSuggestion(userId, transactionId) {
  const uid = parseOptionalInt(userId);
  const txId = parseOptionalInt(transactionId);
  if (!uid || !txId || txId <= 0) return null;

  const sourceTx = await prisma.transaction.findFirst({
    where: { id: txId, userId: uid },
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

  if (
    !sourceTx ||
    sourceTx.parentTransactionId != null ||
    sourceTx.actionCardId != null ||
    !ELIGIBLE_PROMOTE_NATURES.includes(sourceTx.nature)
  ) {
    return null;
  }

  const suggestionKey = makeSuggestionKey(sourceTx.nature, sourceTx.title);
  const dismissedKeys = await getDismissedCardSuggestionKeys(uid);
  if (dismissedKeys.includes(suggestionKey)) {
    return null;
  }

  const existingCard = await findMatchingActiveCard(prisma, uid, sourceTx.title, sourceTx.nature);
  if (existingCard) {
    const bullets = [
      `Existing card "${existingCard.title}" (${existingCard.cardActionType}) is already saved.`,
      existingCard.defaultVault?.name
        ? `Default vault on card: ${existingCard.defaultVault.name}.`
        : null,
      `Linking attaches this entry to that card's habit stats without creating a duplicate.`,
    ].filter(Boolean);

    return {
      suggestionType: "LINK_EXISTING",
      suggestionKey,
      existingCard,
      transaction: sourceTx,
      reasonTitle: "Matching Action Card Found",
      reasonSummary: `You already have an active Action Card named "${existingCard.title}". Link this transaction to it so its habit stats stay accurate?`,
      reasonBullets: bullets,
    };
  }

  const matchingTransactions = await findMatchingHistoricalTransactions(
    prisma,
    uid,
    sourceTx.nature,
    new Set([normalizeCardTitle(sourceTx.title)]),
    sourceTx
  );

  if (matchingTransactions.length < 2) {
    return null;
  }

  const hydratedMatches = await prisma.transaction.findMany({
    where: { id: { in: matchingTransactions.map((m) => m.id) } },
    include: {
      legs: {
        include: {
          vault: true,
          subContainer: true,
        },
      },
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
  });

  const stats = summarizeMatchingTransactionPattern(hydratedMatches);
  if (!stats) return null;

  const bullets = [
    `Recorded ${stats.occurrenceCount} times with matching title and type (${sourceTx.nature}).`,
    stats.typicalHourLabel ? `Usually logged around ${stats.typicalHourLabel}.` : null,
    stats.mostFrequentVaultName
      ? `Most common vault: ${stats.mostFrequentVaultName}.`
      : null,
    stats.avgIntervalDays != null && stats.avgIntervalDays >= 0.5
      ? `Average repeat interval: every ~${stats.avgIntervalDays.toFixed(1)} days.`
      : null,
  ].filter(Boolean);

  return {
    suggestionType: "CREATE_CARD",
    suggestionKey,
    matchingCount: stats.occurrenceCount,
    detectedStats: {
      occurrenceCount: stats.occurrenceCount,
      mostFrequentAmount: stats.mostFrequentAmount,
      currency: stats.currency,
      mostFrequentVaultName: stats.mostFrequentVaultName,
      typicalHourLabel: stats.typicalHourLabel,
      avgIntervalDays: stats.avgIntervalDays,
    },
    transaction: sourceTx,
    reasonTitle: "Do You Want to Make a Card?",
    reasonSummary: `You've recorded "${sourceTx.title}" ${stats.occurrenceCount} times${
      stats.mostFrequentVaultName ? ` using ${stats.mostFrequentVaultName}` : ""
    }${stats.typicalHourLabel ? ` around ${stats.typicalHourLabel}` : ""}. Saving it as a Smart Action Card speeds up future entries.`,
    reasonBullets: bullets,
  };
}
