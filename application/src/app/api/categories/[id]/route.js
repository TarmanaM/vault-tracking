// API Route: PATCH /api/categories/[id], DELETE /api/categories/[id]
// Updates, archives, or safely deletes user-owned Categories

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deriveSilentAccountingFields, getSpendingLayerMeta } from "@/lib/masterCatalog";

export const dynamic = "force-dynamic";

const ALLOWED_EXPENSE_LAYERS = new Set([
  "FIXED_MANDATORY",
  "VARIABLE_ESSENTIAL",
  "DISCRETIONARY_JAJAN",
  "SOCIAL_CHARITY",
]);

export async function PATCH(request, { params }) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const resolved = await params;
    const categoryId = parseInt(resolved?.id, 10);
    if (!categoryId || Number.isNaN(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData = {};

    if (body.name !== undefined) {
      const nextName = String(body.name || "").trim();
      if (nextName.length < 2) {
        return NextResponse.json(
          { success: false, error: "Category name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updateData.name = nextName;
    }

    if (body.iconName !== undefined) {
      updateData.iconName = body.iconName ? String(body.iconName).trim() : null;
    }

    if (body.colorHex !== undefined) {
      updateData.colorHex = body.colorHex ? String(body.colorHex).trim() : null;
    }

    if (body.commitmentType !== undefined && existing.defaultNature === "EXPENSE" && !existing.isSystemLocked) {
      const nextLayer = String(body.commitmentType).toUpperCase();
      if (!ALLOWED_EXPENSE_LAYERS.has(nextLayer)) {
        return NextResponse.json(
          { success: false, error: "Invalid Spending Layer" },
          { status: 400 }
        );
      }
      const derived = deriveSilentAccountingFields("EXPENSE", nextLayer);
      updateData.commitmentType = derived.commitmentType;
      updateData.priorityTier = derived.priorityTier;
      // Preserve custom COA if already customized/template-mapped, otherwise update silent fallback
      if (!existing.templateCode) {
        updateData.coaCode = derived.coaCode;
      }
    }

    if (body.isActive !== undefined) {
      if (existing.isSystemLocked && body.isActive === false) {
        return NextResponse.json(
          { success: false, error: "Core system categories cannot be disabled" },
          { status: 400 }
        );
      }
      updateData.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        spendingLayerMeta: getSpendingLayerMeta(updated.commitmentType),
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/categories/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const resolved = await params;
    const categoryId = parseInt(resolved?.id, 10);
    if (!categoryId || Number.isNaN(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: user.id },
      include: {
        _count: { select: { transactions: true, actionCards: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
    }
    if (existing.isSystemLocked) {
      return NextResponse.json(
        { success: false, error: "Core system categories cannot be deleted" },
        { status: 400 }
      );
    }

    const refCount = (existing._count?.transactions || 0) + (existing._count?.actionCards || 0);
    if (refCount > 0) {
      const archived = await prisma.category.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        archivedOnly: true,
        message: "Category is linked to existing records and was archived instead.",
        data: archived,
      });
    }

    await prisma.category.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true, archivedOnly: false });
  } catch (error) {
    console.error("Error in DELETE /api/categories/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
