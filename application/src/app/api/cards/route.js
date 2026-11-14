// API Route: GET, POST & PATCH /api/cards
// Manages Smart Action Cards creation, editing, and 2-tier visibility hiding (#11, #23)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await prisma.actionCard.findMany({
      where: { isActive: true },
      include: {
        defaultVault: true,
        targetVault: true,
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
  try {
    const body = await request.json();
    const {
      title,
      subtitle = null,
      cardActionType = "EXPENSE",
      defaultVaultId = null,
      targetVaultId = null,
      defaultCategoryId = null,
      defaultPartyId = null,
      defaultAmount = 0,
      quickAmounts = [],
      expectedCadence = "ON_DEMAND",
      pinPriority = 5,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Card title is required" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const card = await tx.actionCard.create({
        data: {
          title: title.trim(),
          subtitle: subtitle?.trim() || null,
          cardActionType,
          defaultVaultId: defaultVaultId ? parseInt(defaultVaultId, 10) : null,
          targetVaultId: targetVaultId ? parseInt(targetVaultId, 10) : null,
          defaultCategoryId: defaultCategoryId ? parseInt(defaultCategoryId, 10) : null,
          defaultPartyId: defaultPartyId ? parseInt(defaultPartyId, 10) : null,
          defaultAmount: defaultAmount ? toDecimal(defaultAmount) : null,
          quickAmountsJson: Array.isArray(quickAmounts) && quickAmounts.length > 0 ? JSON.stringify(quickAmounts) : null,
          expectedCadence,
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
  try {
    const body = await request.json();
    const {
      id,
      visibilityMode, // ACTIVE | SOFT_HIDDEN | ARCHIVED
      title,
      defaultAmount,
      defaultVaultId,
      defaultCategoryId,
      defaultPartyId,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Card id is required" }, { status: 400 });
    }

    const updateData = {};
    if (visibilityMode && ["ACTIVE", "SOFT_HIDDEN", "ARCHIVED"].includes(visibilityMode)) {
      updateData.visibilityMode = visibilityMode;
    }
    if (title !== undefined) updateData.title = title.trim();
    if (defaultAmount !== undefined) updateData.defaultAmount = defaultAmount ? toDecimal(defaultAmount) : null;
    if (defaultVaultId !== undefined) updateData.defaultVaultId = defaultVaultId ? parseInt(defaultVaultId, 10) : null;
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = defaultCategoryId ? parseInt(defaultCategoryId, 10) : null;
    if (defaultPartyId !== undefined) updateData.defaultPartyId = defaultPartyId ? parseInt(defaultPartyId, 10) : null;

    const updated = await prisma.actionCard.update({
      where: { id: parseInt(id, 10) },
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

