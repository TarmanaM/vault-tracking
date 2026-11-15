// API Route: PATCH & DELETE /api/vaults/[id]
// Updates Vault profile (name, type, symbol mode, cropped image, color, sub-vault flag) or soft-archives Vault (#5, #7)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_VAULT_TYPES = new Set([
  "BANK",
  "EWALLET",
  "PHYSICAL_CASH",
  "PHYSICAL_COIN",
  "LIABILITY_CREDIT_LINE",
]);

export async function PATCH(request, { params }) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const resolved = await params;
    const vaultId = parseInt(resolved?.id, 10);
    if (!vaultId) {
      return NextResponse.json({ success: false, error: "Invalid vault ID" }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      vaultType,
      symbolMode,
      iconName,
      profileImageUrl,
      colorHex,
      hasDenominations,
      hasSubContainers,
      sortOrder,
    } = body;

    const existing = await prisma.vault.findFirst({
      where: { id: vaultId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Vault not found" }, { status: 404 });
    }

    if (vaultType !== undefined && !ALLOWED_VAULT_TYPES.has(vaultType)) {
      return NextResponse.json({ success: false, error: "Invalid vault type" }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined && String(name).trim()) updateData.name = String(name).trim();
    if (vaultType !== undefined) updateData.vaultType = vaultType;
    if (symbolMode !== undefined && ["INITIALS", "ICON", "IMAGE"].includes(symbolMode)) {
      updateData.symbolMode = symbolMode;
    }
    if (iconName !== undefined) updateData.iconName = iconName || null;
    if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl || null;
    if (colorHex !== undefined) updateData.colorHex = colorHex || "#2563EB";
    if (hasDenominations !== undefined) updateData.hasDenominations = Boolean(hasDenominations);
    if (hasSubContainers !== undefined) updateData.hasSubContainers = Boolean(hasSubContainers);
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10) || 0;

    const updated = await prisma.vault.update({
      where: { id: vaultId },
      data: updateData,
      include: {
        subContainers: {
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in PATCH /api/vaults/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update vault" },
      { status: 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const resolved = await params;
    const vaultId = parseInt(resolved?.id, 10);
    if (!vaultId) {
      return NextResponse.json({ success: false, error: "Invalid vault ID" }, { status: 400 });
    }

    const existing = await prisma.vault.findFirst({
      where: { id: vaultId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Vault not found" }, { status: 404 });
    }

    const activeCount = await prisma.vault.count({
      where: { userId: user.id, isActive: true },
    });
    if (activeCount <= 1) {
      return NextResponse.json(
        { success: false, error: "Cannot archive the last remaining active vault" },
        { status: 400 }
      );
    }

    const archived = await prisma.vault.update({
      where: { id: vaultId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: archived });
  } catch (error) {
    console.error("Error in DELETE /api/vaults/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to archive vault" },
      { status: 400 }
    );
  }
}
