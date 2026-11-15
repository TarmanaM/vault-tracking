// Server Module: Card Promotion Service
// Handles promoting an existing ledger Transaction into a Smart Action Card or linking to an existing card

import prisma from "@/server/db/prisma";
import { toDecimal } from "@/shared/money";
import {
  recordCardUsage,
  resolvePrimaryVaultId,
  resolveTransactionTimestamp,
  seedCardHabitStatsFromTransactions,
} from "@/lib/habitEngine";
import {
  ELIGIBLE_PROMOTE_NATURES,
  extractCardDraftFromTransaction,
  normalizeCardTitle,
} from "@/shared/cardPromotionUtils";

export class PromotionError extends Error {
  constructor(message, statusCode = 400, code = "PROMOTION_ERROR", details = null) {
    super(message);
    this.name = "PromotionError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const CARD_FULL_INCLUDE = {
  defaultVault: true,
  defaultSubContainer: true,
  targetVault: true,
  targetSubContainer: true,
  defaultCategory: true,
  defaultParty: true,
  habitStats: true,
};

export function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Find an existing active (non-archived) ActionCard belonging to userId with the same normalized title & cardActionType.
 */
export async function findMatchingActiveCard(txClient, userId, title, cardActionType) {
  const uid = parseOptionalInt(userId);
  const normalizedTarget = normalizeCardTitle(title);
  if (!uid || !normalizedTarget) return null;

  const candidates = await txClient.actionCard.findMany({
    where: {
      userId: uid,
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
 * Find user-owned non-child historical transactions matching the source nature and normalized title(s).
 */
export async function findMatchingHistoricalTransactions(txClient, userId, nature, matchTitlesSet, sourceTx) {
  const uid = parseOptionalInt(userId);
  if (!uid) return [];

  const rows = await txClient.transaction.findMany({
    where: {
      userId: uid,
      nature,
      parentTransactionId: null,
    },
    include: {
      legs: true,
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
  });

  const matched = rows.filter((row) => matchTitlesSet.has(normalizeCardTitle(row.title)));
  if (sourceTx && sourceTx.userId === uid && !matched.some((row) => row.id === sourceTx.id)) {
    matched.push(sourceTx);
  }
  return matched;
}

/**
 * Promote an existing transaction into a new ActionCard (or link it to an existing card),
 * atomically seeding CardHabitStats and updating ONLY the source transaction's actionCardId.
 */
export async function promoteTransactionToCard(input = {}) {
  const userId = parseOptionalInt(input.userId);
  if (!userId || userId <= 0) {
    throw new PromotionError("Authenticated userId is required", 401, "UNAUTHORIZED");
  }

  const sourceTransactionId = parseOptionalInt(input.sourceTransactionId);
  if (!sourceTransactionId || sourceTransactionId <= 0) {
    throw new PromotionError("Valid sourceTransactionId is required", 400, "INVALID_SOURCE_TX");
  }

  const mode = input.mode === "LINK_EXISTING" ? "LINK_EXISTING" : "CREATE";

  const sourceTx = await prisma.transaction.findFirst({
    where: { id: sourceTransactionId, userId },
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
      const existingCard = await tx.actionCard.findFirst({
        where: { id: existingCardId, userId },
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
    const duplicate = await findMatchingActiveCard(prisma, userId, title, cardActionType);
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
    if (defaultVaultId) {
      const v = await tx.vault.findFirst({ where: { id: defaultVaultId, userId } });
      if (!v) throw new PromotionError("Selected vault does not belong to you", 403, "FORBIDDEN_VAULT");
    }
    if (targetVaultId) {
      const tv = await tx.vault.findFirst({ where: { id: targetVaultId, userId } });
      if (!tv) throw new PromotionError("Selected target vault does not belong to you", 403, "FORBIDDEN_VAULT");
    }
    if (defaultCategoryId) {
      const c = await tx.category.findFirst({ where: { id: defaultCategoryId, userId } });
      if (!c) throw new PromotionError("Selected category does not belong to you", 403, "FORBIDDEN_CATEGORY");
    }
    if (defaultPartyId) {
      const p = await tx.party.findFirst({ where: { id: defaultPartyId, userId } });
      if (!p) throw new PromotionError("Selected party does not belong to you", 403, "FORBIDDEN_PARTY");
    }

    const createdCard = await tx.actionCard.create({
      data: {
        userId,
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
      userId,
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


export async function previewPromotionFromTransaction(userId, searchParams) {
  const sourceTransactionId = parseInt(searchParams.get("sourceTransactionId") || "", 10);
  if (!Number.isInteger(sourceTransactionId) || sourceTransactionId <= 0) {
    throw new PromotionError("Valid sourceTransactionId is required", 400, "INVALID_SOURCE_TX");
  }

  const sourceTx = await prisma.transaction.findFirst({
    where: { id: sourceTransactionId, userId },
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

  if (!sourceTx) {
    throw new PromotionError("Transaction not found", 404, "SOURCE_TX_NOT_FOUND");
  }

  const titleToCheck = searchParams.get("title") || sourceTx.title;
  const typeToCheck = searchParams.get("cardActionType") || sourceTx.nature;

  const duplicateCard = await findMatchingActiveCard(
    prisma,
    userId,
    titleToCheck,
    typeToCheck
  );
  const matchTitles = new Set([
    normalizeCardTitle(sourceTx.title),
    normalizeCardTitle(titleToCheck),
  ]);
  const matchingHistory = await findMatchingHistoricalTransactions(
    prisma,
    userId,
    sourceTx.nature,
    matchTitles,
    sourceTx
  );

  return {
    transaction: sourceTx,
    duplicateCard,
    matchingHistoryCount: matchingHistory.length,
  };
}
