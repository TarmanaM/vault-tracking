// Server-side transactional workflow for promoting a ledger Transaction into a Smart Action Card

import prisma from "./prisma.js";
import { toDecimal } from "./money.js";
import {
  recordCardUsage,
  resolvePrimaryVaultId,
  resolveTransactionTimestamp,
  seedCardHabitStatsFromTransactions,
} from "./habitEngine.js";
import {
  ELIGIBLE_PROMOTE_NATURES,
  extractCardDraftFromTransaction,
  makeSuggestionKey,
  normalizeCardTitle,
} from "./cardPromotionUtils.js";

export class PromotionError extends Error {
  constructor(message, statusCode = 400, code = "PROMOTION_ERROR", details = null) {
    super(message);
    this.name = "PromotionError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const CARD_FULL_INCLUDE = {
  defaultVault: true,
  defaultSubContainer: true,
  targetVault: true,
  targetSubContainer: true,
  defaultCategory: true,
  defaultParty: true,
  habitStats: true,
};

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Find an existing active (non-archived) ActionCard with the same normalized title & cardActionType.
 */
export async function findMatchingActiveCard(txClient, title, cardActionType) {
  const normalizedTarget = normalizeCardTitle(title);
  if (!normalizedTarget) return null;

  const candidates = await txClient.actionCard.findMany({
    where: {
      isActive: true,
      visibilityMode: { not: "ARCHIVED" },
      cardActionType,
    },
    include: CARD_FULL_INCLUDE,
    orderBy: [{ pinPriority: "desc" }, { id: "asc" }],
  });

  return candidates.find((c) => normalizeCardTitle(c.title) === normalizedTarget) || null;
}

/**
 * Find non-child historical transactions matching the source nature and normalized title(s).
 */
export async function findMatchingHistoricalTransactions(txClient, nature, matchTitlesSet, sourceTx) {
  const rows = await txClient.transaction.findMany({
    where: {
      nature,
      parentTransactionId: null,
    },
    include: {
      legs: true,
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
  });

  const matched = rows.filter((row) => matchTitlesSet.has(normalizeCardTitle(row.title)));
  if (sourceTx && !matched.some((row) => row.id === sourceTx.id)) {
    matched.push(sourceTx);
  }
  return matched;
}

/**
 * Promote an existing transaction into a new ActionCard (or link it to an existing card),
 * atomically seeding CardHabitStats and updating ONLY the source transaction's actionCardId.
 */
export async function promoteTransactionToCard(input = {}) {
  const sourceTransactionId = parseOptionalInt(input.sourceTransactionId);
  if (!sourceTransactionId || sourceTransactionId <= 0) {
    throw new PromotionError("Valid sourceTransactionId is required", 400, "INVALID_SOURCE_TX");
  }

  const mode = input.mode === "LINK_EXISTING" ? "LINK_EXISTING" : "CREATE";

  const sourceTx = await prisma.transaction.findUnique({
    where: { id: sourceTransactionId },
    include: {
      legs: {
        include: {
          subContainer: true,
        },
      },
      actionCard: true,
    },
  });

  if (!sourceTx) {
    throw new PromotionError("Source transaction not found", 404, "SOURCE_TX_NOT_FOUND");
  }
  if (sourceTx.parentTransactionId != null) {
    throw new PromotionError(
      "Child tax/admin split transactions cannot be promoted directly",
      400,
      "CHILD_SPLIT_FORBIDDEN"
    );
  }
  if (!ELIGIBLE_PROMOTE_NATURES.includes(sourceTx.nature)) {
    throw new PromotionError(
      `Transactions of nature "${sourceTx.nature}" cannot be promoted to Action Cards`,
      400,
      "INELIGIBLE_NATURE"
    );
  }

  if (mode === "LINK_EXISTING") {
    const existingCardId = parseOptionalInt(input.existingCardId);
    if (!existingCardId || existingCardId <= 0) {
      throw new PromotionError("existingCardId is required for LINK_EXISTING mode", 400, "INVALID_CARD_ID");
    }
    if (sourceTx.actionCardId != null && sourceTx.actionCardId !== existingCardId) {
      throw new PromotionError(
        `Transaction is already linked to Action Card "${sourceTx.actionCard?.title || sourceTx.actionCardId}"`,
        409,
        "ALREADY_LINKED"
      );
    }

    return prisma.$transaction(async (tx) => {
      const existingCard = await tx.actionCard.findUnique({
        where: { id: existingCardId },
      });
      if (!existingCard || !existingCard.isActive) {
        throw new PromotionError("Target Action Card not found or inactive", 404, "CARD_NOT_FOUND");
      }

      if (sourceTx.actionCardId !== existingCard.id) {
        await tx.transaction.update({
          where: { id: sourceTx.id },
          data: { actionCardId: existingCard.id },
        });

        const primaryVaultId = resolvePrimaryVaultId(sourceTx) ?? existingCard.defaultVaultId;
        const rawAmount = sourceTx.originalGrossAmount ?? sourceTx.grossAmount;
        await recordCardUsage(
          tx,
          existingCard.id,
          rawAmount,
          primaryVaultId,
          resolveTransactionTimestamp(sourceTx)
        );
      }

      if (existingCard.visibilityMode !== "ACTIVE") {
        await tx.actionCard.update({
          where: { id: existingCard.id },
          data: { visibilityMode: "ACTIVE" },
        });
      }

      const fullCard = await tx.actionCard.findUnique({
        where: { id: existingCard.id },
        include: CARD_FULL_INCLUDE,
      });

      return {
        mode: "LINK_EXISTING",
        card: fullCard,
        linkedTransactionId: sourceTx.id,
        seededFromCount: fullCard?.habitStats?.totalUses ?? 0,
      };
    });
  }

  // CREATE mode
  if (sourceTx.actionCardId != null) {
    throw new PromotionError(
      `Transaction is already linked to Action Card "${sourceTx.actionCard?.title || sourceTx.actionCardId}"`,
      409,
      "ALREADY_LINKED"
    );
  }

  const draft = extractCardDraftFromTransaction(sourceTx);
  const title = (input.title !== undefined ? String(input.title) : draft.title).trim();
  if (!title) {
    throw new PromotionError("Card title is required", 400, "INVALID_TITLE");
  }

  const cardActionType = input.cardActionType || draft.cardActionType;
  if (!ELIGIBLE_PROMOTE_NATURES.includes(cardActionType)) {
    throw new PromotionError(`Unsupported cardActionType "${cardActionType}"`, 400, "INVALID_ACTION_TYPE");
  }

  const allowDuplicate = Boolean(input.allowDuplicate);
  if (!allowDuplicate) {
    const duplicate = await findMatchingActiveCard(prisma, title, cardActionType);
    if (duplicate) {
      throw new PromotionError(
        `An active card named "${duplicate.title}" (${duplicate.cardActionType}) already exists`,
        409,
        "DUPLICATE_CARD",
        { existingCard: duplicate }
      );
    }
  }

  const defaultVaultId =
    input.defaultVaultId !== undefined ? parseOptionalInt(input.defaultVaultId) : draft.defaultVaultId;
  const defaultSubContainerId =
    input.defaultSubContainerId !== undefined
      ? parseOptionalInt(input.defaultSubContainerId)
      : draft.defaultSubContainerId;
  const targetVaultId =
    cardActionType === "TRANSFER"
      ? input.targetVaultId !== undefined
        ? parseOptionalInt(input.targetVaultId)
        : draft.targetVaultId
      : null;
  const targetSubContainerId =
    cardActionType === "TRANSFER"
      ? input.targetSubContainerId !== undefined
        ? parseOptionalInt(input.targetSubContainerId)
        : draft.targetSubContainerId
      : null;
  const defaultCategoryId =
    input.defaultCategoryId !== undefined ? parseOptionalInt(input.defaultCategoryId) : draft.defaultCategoryId;
  const defaultPartyId =
    input.defaultPartyId !== undefined ? parseOptionalInt(input.defaultPartyId) : draft.defaultPartyId;

  const rawDefaultAmount =
    input.defaultAmount !== undefined ? input.defaultAmount : draft.defaultAmount;
  const defaultAmountDecimal =
    rawDefaultAmount !== null && rawDefaultAmount !== undefined && Number(rawDefaultAmount) > 0
      ? toDecimal(rawDefaultAmount)
      : null;

  const cleanQuickAmounts = Array.isArray(input.quickAmounts)
    ? input.quickAmounts.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const expectedCadence = input.expectedCadence || "ON_DEMAND";
  const oneTapSubmit = Boolean(input.oneTapSubmit);
  const pinPriority =
    input.pinPriority !== undefined && input.pinPriority !== null
      ? Math.max(0, Math.min(10, parseInt(input.pinPriority, 10) || 0))
      : 8;

  return prisma.$transaction(async (tx) => {
    const createdCard = await tx.actionCard.create({
      data: {
        title,
        subtitle: input.subtitle ? String(input.subtitle).trim() : null,
        cardActionType,
        defaultVaultId,
        defaultSubContainerId,
        targetVaultId,
        targetSubContainerId,
        defaultCategoryId,
        defaultPartyId,
        defaultAmount: defaultAmountDecimal,
        quickAmountsJson: cleanQuickAmounts.length > 0 ? JSON.stringify(cleanQuickAmounts) : null,
        expectedCadence,
        oneTapSubmit,
        pinPriority,
        visibilityMode: "ACTIVE",
        isActive: true,
      },
    });

    const matchTitles = new Set([normalizeCardTitle(sourceTx.title), normalizeCardTitle(title)]);
    const matchingTransactions = await findMatchingHistoricalTransactions(
      tx,
      sourceTx.nature,
      matchTitles,
      sourceTx
    );

    await seedCardHabitStatsFromTransactions(
      tx,
      createdCard.id,
      matchingTransactions,
      defaultVaultId,
      defaultAmountDecimal
    );

    // Link ONLY the source transaction so historical rows remain read-only
    await tx.transaction.update({
      where: { id: sourceTx.id },
      data: { actionCardId: createdCard.id },
    });

    const fullCard = await tx.actionCard.findUnique({
      where: { id: createdCard.id },
      include: CARD_FULL_INCLUDE,
    });

    return {
      mode: "CREATE",
      card: fullCard,
      linkedTransactionId: sourceTx.id,
      seededFromCount: matchingTransactions.length,
    };
  });
}

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

/**
 * Summarize recurring transaction traits (vault, amount, category, typical hour, interval)
 * cleanly without mutating historical records.
 */
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
 * Retrieve dismissed suggestion keys stored in singleton AppSetting.
 */
export async function getDismissedCardSuggestionKeys() {
  const setting = await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, baseCurrency: "IDR", fxSyncIntervalDays: 3 },
  });
  return parseDismissedKeys(setting.dismissedCardSuggestionsJson);
}

/**
 * Permanently mute save-time card suggestions for a (nature, title) pair across devices.
 */
export async function dismissCardSuggestionKey(nature, title) {
  const key = makeSuggestionKey(nature, title);
  const setting = await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, baseCurrency: "IDR", fxSyncIntervalDays: 3 },
  });
  const existing = parseDismissedKeys(setting.dismissedCardSuggestionsJson);
  if (!normalizeCardTitle(title) || existing.includes(key)) {
    return existing;
  }

  const updatedKeys = [...existing, key];
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { dismissedCardSuggestionsJson: JSON.stringify(updatedKeys) },
  });
  return updatedKeys;
}

/**
 * Fetch combined autocomplete suggestions (Active/Soft-Hidden ActionCards + grouped past Transactions).
 */
export async function getTransactionTitleSuggestions(limit = 40) {
  const [cards, recentTxs, setting] = await Promise.all([
    prisma.actionCard.findMany({
      where: {
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
    prisma.appSetting.findUnique({ where: { id: 1 } }),
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
export async function evaluatePostSaveCardSuggestion(transactionId) {
  const txId = parseOptionalInt(transactionId);
  if (!txId || txId <= 0) return null;

  const sourceTx = await prisma.transaction.findUnique({
    where: { id: txId },
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
  const dismissedKeys = await getDismissedCardSuggestionKeys();
  if (dismissedKeys.includes(suggestionKey)) {
    return null;
  }

  // Case 1: Active Action Card already exists with matching normalized title & nature
  const existingCard = await findMatchingActiveCard(prisma, sourceTx.title, sourceTx.nature);
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

  // Case 2: Repeated ad-hoc transaction (>= 1 prior match => >= 2 total entries)
  const matchingTransactions = await findMatchingHistoricalTransactions(
    prisma,
    sourceTx.nature,
    new Set([normalizeCardTitle(sourceTx.title)]),
    sourceTx
  );

  // Also include legs.vault + subContainer for pattern summary
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
