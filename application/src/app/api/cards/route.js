// API Route: GET, POST & PATCH /api/cards
// Manages Smart Action Cards creation, editing, and 2-tier visibility hiding (#11, #23)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function assertCardForeignKeyOwnership(tx, userId, ids) {
  const { defaultVaultId, targetVaultId, defaultCategoryId, defaultPartyId } = ids;
  if (defaultVaultId) {
    const v = await tx.vault.findFirst({ where: { id: defaultVaultId, userId } });
    if (!v) throw new Error("Selected default vault not found");
  }
  if (targetVaultId) {
    const tv = await tx.vault.findFirst({ where: { id: targetVaultId, userId } });
    if (!tv) throw new Error("Selected target vault not found");
  }
  if (defaultCategoryId) {
    const c = await tx.category.findFirst({ where: { id: defaultCategoryId, userId } });
    if (!c) throw new Error("Selected category not found");
  }
  if (defaultPartyId) {
    const p = await tx.party.findFirst({ where: { id: defaultPartyId, userId } });
    if (!p) throw new Error("Selected party not found");
  }
}

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const cards = await prisma.actionCard.findMany({
      where: { userId: user.id, isActive: true },
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
    return NextResponse.json({ success: true, data: cards });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch action cards" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
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

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Card title is required" }, { status: 400 });
    }

    const parsedDefaultVaultId = parseOptionalInt(defaultVaultId);
    const parsedTargetVaultId = parseOptionalInt(targetVaultId);
    const parsedDefaultCategoryId = parseOptionalInt(defaultCategoryId);
    const parsedDefaultPartyId = parseOptionalInt(defaultPartyId);

    const created = await prisma.$transaction(async (tx) => {
      await assertCardForeignKeyOwnership(tx, user.id, {
        defaultVaultId: parsedDefaultVaultId,
        targetVaultId: parsedTargetVaultId,
        defaultCategoryId: parsedDefaultCategoryId,
        defaultPartyId: parsedDefaultPartyId,
      });

      const card = await tx.actionCard.create({
        data: {
          userId: user.id,
          title: title.trim(),
          subtitle: subtitle?.trim() || null,
          cardActionType,
          defaultVaultId: parsedDefaultVaultId,
          defaultSubContainerId: parseOptionalInt(defaultSubContainerId),
          targetVaultId: parsedTargetVaultId,
          targetSubContainerId: parseOptionalInt(targetSubContainerId),
          defaultCategoryId: parsedDefaultCategoryId,
          defaultPartyId: parsedDefaultPartyId,
          defaultAmount: defaultAmount ? toDecimal(defaultAmount) : null,
          quickAmountsJson: Array.isArray(quickAmounts) && quickAmounts.length > 0 ? JSON.stringify(quickAmounts) : null,
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

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("Error in POST /api/cards:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create action card" },
      { status: 400 }
    );
  }
}

export async function PATCH(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const {
      id,
      visibilityMode, // ACTIVE | SOFT_HIDDEN | ARCHIVED
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
      return NextResponse.json({ success: false, error: "Card id is required" }, { status: 400 });
    }

    const existingCard = await prisma.actionCard.findFirst({
      where: { id: parseInt(id, 10), userId: user.id },
    });
    if (!existingCard) {
      return NextResponse.json({ success: false, error: "Action card not found" }, { status: 404 });
    }

    const updateData = {};
    if (visibilityMode && ["ACTIVE", "SOFT_HIDDEN", "ARCHIVED"].includes(visibilityMode)) {
      updateData.visibilityMode = visibilityMode;
    }
    if (title !== undefined) updateData.title = title.trim();
    if (cardActionType !== undefined) updateData.cardActionType = cardActionType;
    if (defaultAmount !== undefined) updateData.defaultAmount = defaultAmount ? toDecimal(defaultAmount) : null;
    if (defaultVaultId !== undefined) updateData.defaultVaultId = parseOptionalInt(defaultVaultId);
    if (defaultSubContainerId !== undefined) updateData.defaultSubContainerId = parseOptionalInt(defaultSubContainerId);
    if (targetVaultId !== undefined) updateData.targetVaultId = parseOptionalInt(targetVaultId);
    if (targetSubContainerId !== undefined) updateData.targetSubContainerId = parseOptionalInt(targetSubContainerId);
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = parseOptionalInt(defaultCategoryId);
    if (defaultPartyId !== undefined) updateData.defaultPartyId = parseOptionalInt(defaultPartyId);
    if (expectedCadence !== undefined) updateData.expectedCadence = expectedCadence;
    if (oneTapSubmit !== undefined) updateData.oneTapSubmit = Boolean(oneTapSubmit);
    if (quickAmounts !== undefined) {
      updateData.quickAmountsJson =
        Array.isArray(quickAmounts) && quickAmounts.length > 0 ? JSON.stringify(quickAmounts) : null;
    }

    await assertCardForeignKeyOwnership(prisma, user.id, {
      defaultVaultId: updateData.defaultVaultId,
      targetVaultId: updateData.targetVaultId,
      defaultCategoryId: updateData.defaultCategoryId,
      defaultPartyId: updateData.defaultPartyId,
    });

    const updated = await prisma.actionCard.update({
      where: { id: existingCard.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in PATCH /api/cards:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update action card" },
      { status: 400 }
    );
  }
}

