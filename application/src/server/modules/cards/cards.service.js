// Smart Action Cards & Pending Reminders service
import "server-only";
import prisma from "@/server/db/prisma";
import { toDecimal } from "@/shared/money";
import { BadRequestError, NotFoundError } from "@/server/http/errors";

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function assertCardForeignKeyOwnership(tx, userId, ids) {
  const { defaultVaultId, targetVaultId, defaultCategoryId, defaultPartyId } = ids;
  if (defaultVaultId) {
    const v = await tx.vault.findFirst({ where: { id: defaultVaultId, userId } });
    if (!v) throw new BadRequestError("Selected default vault not found");
  }
  if (targetVaultId) {
    const tv = await tx.vault.findFirst({ where: { id: targetVaultId, userId } });
    if (!tv) throw new BadRequestError("Selected target vault not found");
  }
  if (defaultCategoryId) {
    const c = await tx.category.findFirst({ where: { id: defaultCategoryId, userId } });
    if (!c) throw new BadRequestError("Selected category not found");
  }
  if (defaultPartyId) {
    const p = await tx.party.findFirst({ where: { id: defaultPartyId, userId } });
    if (!p) throw new BadRequestError("Selected party not found");
  }
}

export async function listActiveActionCards(userId) {
  return await prisma.actionCard.findMany({
    where: { userId: Number(userId), isActive: true },
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
  });
}

export async function createActionCard(userId, body = {}) {
  const {
    title,
    subtitle = null,
    cardActionType = "EXPENSE",
    defaultVaultId = null,
    defaultSubContainerId = null,
    targetVaultId = null,
    targetSubContainerId = null,
    defaultCategoryId = null,
    defaultPartyId = null,
    defaultAmount = 0,
    quickAmounts = [],
    expectedCadence = "ON_DEMAND",
    oneTapSubmit = false,
    pinPriority = 5,
  } = body;

  if (!title || !String(title).trim()) {
    throw new BadRequestError("Card title is required");
  }

  const parsedDefaultVaultId = parseOptionalInt(defaultVaultId);
  const parsedTargetVaultId = parseOptionalInt(targetVaultId);
  const parsedDefaultCategoryId = parseOptionalInt(defaultCategoryId);
  const parsedDefaultPartyId = parseOptionalInt(defaultPartyId);

  return await prisma.$transaction(async (tx) => {
    await assertCardForeignKeyOwnership(tx, userId, {
      defaultVaultId: parsedDefaultVaultId,
      targetVaultId: parsedTargetVaultId,
      defaultCategoryId: parsedDefaultCategoryId,
      defaultPartyId: parsedDefaultPartyId,
    });

    const card = await tx.actionCard.create({
      data: {
        userId: Number(userId),
        title: String(title).trim(),
        subtitle: subtitle ? String(subtitle).trim() : null,
        cardActionType,
        defaultVaultId: parsedDefaultVaultId,
        defaultSubContainerId: parseOptionalInt(defaultSubContainerId),
        targetVaultId: parsedTargetVaultId,
        targetSubContainerId: parseOptionalInt(targetSubContainerId),
        defaultCategoryId: parsedDefaultCategoryId,
        defaultPartyId: parsedDefaultPartyId,
        defaultAmount: defaultAmount ? toDecimal(defaultAmount) : null,
        quickAmountsJson:
          Array.isArray(quickAmounts) && quickAmounts.length > 0
            ? JSON.stringify(quickAmounts)
            : null,
        expectedCadence,
        oneTapSubmit: Boolean(oneTapSubmit),
        pinPriority: parseInt(pinPriority, 10) || 0,
        visibilityMode: "ACTIVE",
      },
    });

    await tx.cardHabitStats.create({
      data: {
        cardId: card.id,
        totalUses: 0,
        hourCountsJson: "[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]",
        dowCountsJson: "[0,0,0,0,0,0,0]",
      },
    });

    return card;
  });
}

export async function updateActionCard(userId, body = {}) {
  const {
    id,
    visibilityMode,
    title,
    cardActionType,
    defaultAmount,
    defaultVaultId,
    defaultSubContainerId,
    targetVaultId,
    targetSubContainerId,
    defaultCategoryId,
    defaultPartyId,
    expectedCadence,
    oneTapSubmit,
    quickAmounts,
  } = body;

  if (!id) {
    throw new BadRequestError("Card id is required");
  }

  const existingCard = await prisma.actionCard.findFirst({
    where: { id: parseInt(id, 10), userId: Number(userId) },
  });
  if (!existingCard) {
    throw new NotFoundError("Action card not found");
  }

  const updateData = {};
  if (visibilityMode && ["ACTIVE", "SOFT_HIDDEN", "ARCHIVED"].includes(visibilityMode)) {
    updateData.visibilityMode = visibilityMode;
  }
  if (title !== undefined) updateData.title = String(title).trim();
  if (cardActionType !== undefined) updateData.cardActionType = cardActionType;
  if (defaultAmount !== undefined) {
    updateData.defaultAmount = defaultAmount ? toDecimal(defaultAmount) : null;
  }
  if (defaultVaultId !== undefined) updateData.defaultVaultId = parseOptionalInt(defaultVaultId);
  if (defaultSubContainerId !== undefined) {
    updateData.defaultSubContainerId = parseOptionalInt(defaultSubContainerId);
  }
  if (targetVaultId !== undefined) updateData.targetVaultId = parseOptionalInt(targetVaultId);
  if (targetSubContainerId !== undefined) {
    updateData.targetSubContainerId = parseOptionalInt(targetSubContainerId);
  }
  if (defaultCategoryId !== undefined) {
    updateData.defaultCategoryId = parseOptionalInt(defaultCategoryId);
  }
  if (defaultPartyId !== undefined) updateData.defaultPartyId = parseOptionalInt(defaultPartyId);
  if (expectedCadence !== undefined) updateData.expectedCadence = expectedCadence;
  if (oneTapSubmit !== undefined) updateData.oneTapSubmit = Boolean(oneTapSubmit);
  if (quickAmounts !== undefined) {
    updateData.quickAmountsJson =
      Array.isArray(quickAmounts) && quickAmounts.length > 0
        ? JSON.stringify(quickAmounts)
        : null;
  }

  await assertCardForeignKeyOwnership(prisma, userId, {
    defaultVaultId: updateData.defaultVaultId,
    targetVaultId: updateData.targetVaultId,
    defaultCategoryId: updateData.defaultCategoryId,
    defaultPartyId: updateData.defaultPartyId,
  });

  return await prisma.actionCard.update({
    where: { id: existingCard.id },
    data: updateData,
  });
}

export async function listPendingReminders(userId) {
  return await prisma.pendingReminder.findMany({
    where: { userId: Number(userId), status: "PENDING" },
    include: {
      suggestedVault: true,
      suggestedParty: true,
      suggestedCategory: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPendingReminder(userId, body = {}) {
  const {
    title,
    reminderType = "DRAFT_TX",
    estimatedAmount,
    dueDate,
    suggestedVaultId,
    suggestedPartyId,
    suggestedCategoryId,
  } = body;

  const vaultId = suggestedVaultId ? parseInt(suggestedVaultId, 10) : null;
  const partyId = suggestedPartyId ? parseInt(suggestedPartyId, 10) : null;
  const categoryId = suggestedCategoryId ? parseInt(suggestedCategoryId, 10) : null;

  if (vaultId) {
    const v = await prisma.vault.findFirst({ where: { id: vaultId, userId: Number(userId) } });
    if (!v) throw new NotFoundError("Suggested vault not found");
  }
  if (partyId) {
    const p = await prisma.party.findFirst({ where: { id: partyId, userId: Number(userId) } });
    if (!p) throw new NotFoundError("Suggested party not found");
  }
  if (categoryId) {
    const c = await prisma.category.findFirst({
      where: { id: categoryId, userId: Number(userId) },
    });
    if (!c) throw new NotFoundError("Suggested category not found");
  }

  return await prisma.pendingReminder.create({
    data: {
      userId: Number(userId),
      title,
      reminderType,
      estimatedAmount: estimatedAmount ? toDecimal(estimatedAmount) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      suggestedVaultId: vaultId,
      suggestedPartyId: partyId,
      suggestedCategoryId: categoryId,
      status: "PENDING",
    },
  });
}
