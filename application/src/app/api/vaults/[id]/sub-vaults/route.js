// API Route: POST, PATCH & DELETE /api/vaults/[id]/sub-vaults
// Manages dynamic sub-vault pockets, default routing, foreign currencies, and non-mutating Sync Split (#3, #4)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDecimal, roundMoney } from "@/lib/money";
import { getOrCreateAppSettings, getCachedRateMap } from "@/lib/fxService";
import {
  ensureDefaultSubContainer,
  evaluateBasePartitionState,
  syncVaultPartitions,
  computeVaultPartitionSummary,
} from "@/lib/subVaultService";

export const dynamic = "force-dynamic";

function slugSubCode(name, fallback = "POCKET") {
  const clean = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return clean || fallback;
}

export async function POST(request, { params }) {
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
      currency,
      isDefault = false,
      colorHex = null,
      initialBalance = null,
      isSynced = null,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Sub-vault name is required" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const vault = await tx.vault.findFirst({
        where: { id: vaultId, userId: user.id },
        include: { subContainers: true },
      });
      if (!vault) throw new Error("Vault not found");

      const settings = await getOrCreateAppSettings(user.id, tx);
      const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
      const targetCurrency = String(currency || baseCurrency).trim().toUpperCase();

      const existingCount = vault.subContainers.length;
      const shouldBeDefault = Boolean(isDefault) || existingCount === 0;

      if (shouldBeDefault && existingCount > 0) {
        await tx.vaultSubContainer.updateMany({
          where: { vaultId },
          data: { isDefault: false },
        });
      }

      const baseSlug = slugSubCode(name, `SUB_${existingCount + 1}`);
      let uniqueCode = baseSlug;
      let suffix = 2;
      while (
        await tx.vaultSubContainer.findUnique({
          where: { vaultId_code: { vaultId, code: uniqueCode } },
        })
      ) {
        uniqueCode = `${baseSlug}_${suffix++}`;
      }

      const hasExplicitBal =
        initialBalance !== null && initialBalance !== undefined && initialBalance !== "";
      const initBalDec = hasExplicitBal ? roundMoney(initialBalance) : toDecimal(0);
      const isForeign = targetCurrency !== baseCurrency;
      const resolvedSynced =
        isSynced !== null && isSynced !== undefined
          ? Boolean(isSynced)
          : hasExplicitBal && (!isForeign || !initBalDec.isZero());

      const maxSort = vault.subContainers.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0);

      const newSub = await tx.vaultSubContainer.create({
        data: {
          vaultId,
          code: uniqueCode,
          name: name.trim(),
          currency: targetCurrency,
          isDefault: shouldBeDefault,
          currentBalance: resolvedSynced ? initBalDec : toDecimal(0),
          lastCountedBalance: resolvedSynced ? initBalDec : toDecimal(0),
          isSynced: resolvedSynced,
          colorHex: colorHex || null,
          sortOrder: maxSort + 10,
        },
      });

      if (!vault.hasSubContainers) {
        await tx.vault.update({
          where: { id: vaultId },
          data: { hasSubContainers: true },
        });
      }

      await ensureDefaultSubContainer(tx, vaultId, baseCurrency);
      const partitionState = await evaluateBasePartitionState(tx, vaultId, baseCurrency);

      return { subContainer: newSub, partitionState };
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("Error in POST /api/vaults/[id]/sub-vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add sub-vault" },
      { status: 400 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const resolved = await params;
    const vaultId = parseInt(resolved?.id, 10);
    if (!vaultId) {
      return NextResponse.json({ success: false, error: "Invalid vault ID" }, { status: 400 });
    }

    const ownedVault = await prisma.vault.findFirst({
      where: { id: vaultId, userId: user.id },
      select: { id: true },
    });
    if (!ownedVault) {
      return NextResponse.json({ success: false, error: "Vault not found" }, { status: 404 });
    }

    const body = await request.json();
    const settings = await getOrCreateAppSettings(user.id);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

    // Mode A: Full Sync Sub-Vault Split batch (does NOT alter Main Vault balance)
    if (Array.isArray(body.allocations) || body.defaultSubContainerId !== undefined) {
      const result = await syncVaultPartitions(vaultId, {
        allocations: body.allocations || [],
        defaultSubContainerId: body.defaultSubContainerId || null,
        baseCurrency,
        userId: user.id,
      });
      const rateMap = await getCachedRateMap(baseCurrency);
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          partitionSummary: computeVaultPartitionSummary(result.vault, baseCurrency, rateMap),
        },
      });
    }

    // Mode B: Single sub-vault metadata edit
    const { subContainerId, name, colorHex, currency, isDefault } = body;
    if (!subContainerId) {
      return NextResponse.json({ success: false, error: "subContainerId is required" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const subId = parseInt(subContainerId, 10);
      const sub = await tx.vaultSubContainer.findUnique({ where: { id: subId } });
      if (!sub || sub.vaultId !== vaultId) {
        throw new Error("Sub-vault not found for this vault");
      }

      if (isDefault) {
        await tx.vaultSubContainer.updateMany({
          where: { vaultId },
          data: { isDefault: false },
        });
      }

      await tx.vaultSubContainer.update({
        where: { id: subId },
        data: {
          ...(name !== undefined && String(name).trim() ? { name: String(name).trim() } : {}),
          ...(colorHex !== undefined ? { colorHex: colorHex || null } : {}),
          ...(currency !== undefined ? { currency: String(currency).toUpperCase() } : {}),
          ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
        },
      });

      await ensureDefaultSubContainer(tx, vaultId, baseCurrency);
      const partitionState = await evaluateBasePartitionState(tx, vaultId, baseCurrency);
      const vault = await tx.vault.findUnique({
        where: { id: vaultId },
        include: {
          subContainers: {
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          },
        },
      });
      return { vault, partitionState };
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in PATCH /api/vaults/[id]/sub-vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update sub-vaults" },
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
    const { searchParams } = new URL(request.url);
    const subId = parseInt(searchParams.get("subId"), 10);

    if (!vaultId || !subId) {
      return NextResponse.json({ success: false, error: "vaultId and subId are required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const ownedVault = await tx.vault.findFirst({
        where: { id: vaultId, userId: user.id },
        select: { id: true },
      });
      if (!ownedVault) {
        throw new Error("Vault not found");
      }

      const settings = await getOrCreateAppSettings(user.id, tx);
      const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

      const sub = await tx.vaultSubContainer.findUnique({ where: { id: subId } });
      if (!sub || sub.vaultId !== vaultId) {
        throw new Error("Sub-vault not found for this vault");
      }

      await tx.vaultSubContainer.delete({ where: { id: subId } });

      const remaining = await tx.vaultSubContainer.findMany({
        where: { vaultId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      if (remaining.length === 0) {
        await tx.vault.update({
          where: { id: vaultId },
          data: {
            hasSubContainers: false,
            subVaultOutOfSync: false,
            subVaultSyncNote: null,
          },
        });
      } else {
        await ensureDefaultSubContainer(tx, vaultId, baseCurrency);
        await evaluateBasePartitionState(tx, vaultId, baseCurrency);
      }

      return { deletedId: subId, remainingCount: remaining.length };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in DELETE /api/vaults/[id]/sub-vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete sub-vault" },
      { status: 400 }
    );
  }
}
