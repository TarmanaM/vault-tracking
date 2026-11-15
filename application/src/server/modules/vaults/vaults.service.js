// Vaults & Sub-Vaults management service
import "server-only";
import prisma from "@/server/db/prisma";
import { toDecimal, roundMoney } from "@/shared/money";
import { sortVaultsByBalanceDesc } from "@/shared/vaultHelpers";
import { getOrCreateAppSettings, getCachedRateMap } from "@/lib/fxService";
import {
  computeVaultPartitionSummary,
  ensureDefaultSubContainer,
  evaluateBasePartitionState,
  syncVaultPartitions,
} from "@/lib/subVaultService";
import { recalculateLedgerRunningBalances } from "@/lib/ledgerService";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import {
  findActiveUserVaultsWithSubContainers,
  findUserVaultById,
  countActiveUserVaults,
  updateVaultById,
} from "./vaults.repository.js";

const ALLOWED_VAULT_TYPES = new Set([
  "BANK",
  "EWALLET",
  "PHYSICAL_CASH",
  "PHYSICAL_COIN",
  "LIABILITY_CREDIT_LINE",
]);

function slugCode(text, fallback = "VAULT") {
  const clean = String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return clean || fallback;
}

export async function listEnrichedUserVaults(userId) {
  const settings = await getOrCreateAppSettings(userId);
  const [rateMap, rawVaults] = await Promise.all([
    getCachedRateMap(settings.baseCurrency),
    findActiveUserVaultsWithSubContainers(userId),
  ]);

  const enriched = rawVaults.map((v) => {
    const partitionSummary = computeVaultPartitionSummary(v, settings.baseCurrency, rateMap);
    return {
      ...v,
      partitionSummary,
      totalEstimatedBase: partitionSummary.totalEstimatedBase,
    };
  });

  return {
    vaults: sortVaultsByBalanceDesc(enriched),
    baseCurrency: settings.baseCurrency,
    rateMap,
  };
}

export async function createVaultWithSubVaults(user, body = {}) {
  const {
    name,
    vaultType = "BANK",
    symbolMode = "INITIALS",
    iconName = null,
    profileImageUrl = null,
    colorHex = "#2563EB",
    hasDenominations = false,
    initialBalance = 0,
    subVaults = [],
  } = body;

  if (!name || !String(name).trim()) {
    throw new BadRequestError("Vault name is required");
  }
  if (!ALLOWED_VAULT_TYPES.has(vaultType)) {
    throw new BadRequestError("Invalid vault type");
  }

  return await prisma.$transaction(async (tx) => {
    const settings = await getOrCreateAppSettings(user.id, tx);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

    const baseSlug = slugCode(name, "VAULT");
    let uniqueCode = baseSlug;
    let suffix = 2;
    while (
      await tx.vault.findUnique({
        where: { userId_code: { userId: user.id, code: uniqueCode } },
      })
    ) {
      uniqueCode = `${baseSlug}_${suffix++}`;
    }

    const maxSort = await tx.vault.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder || 0) + 10;

    const validSubsInput = Array.isArray(subVaults)
      ? subVaults.filter((s) => s && s.name && String(s.name).trim())
      : [];

    const initialDec = roundMoney(initialBalance || 0);
    const createdVault = await tx.vault.create({
      data: {
        userId: user.id,
        code: uniqueCode,
        name: String(name).trim(),
        vaultType,
        currentBalance: toDecimal(0),
        hasSubContainers: validSubsInput.length > 0,
        hasDenominations: Boolean(hasDenominations) || vaultType === "PHYSICAL_COIN",
        symbolMode: ["INITIALS", "ICON", "IMAGE"].includes(symbolMode)
          ? symbolMode
          : "INITIALS",
        iconName: iconName || null,
        profileImageUrl: profileImageUrl || null,
        colorHex: colorHex || "#2563EB",
        sortOrder: nextSort,
        isActive: true,
      },
    });

    let defaultBaseSubId = null;

    if (validSubsInput.length > 0) {
      const explicitDefaultIdx = validSubsInput.findIndex((s) => s.isDefault);
      const targetDefaultIdx = explicitDefaultIdx >= 0 ? explicitDefaultIdx : 0;

      for (let i = 0; i < validSubsInput.length; i++) {
        const item = validSubsInput[i];
        const ccy = String(item.currency || baseCurrency).toUpperCase();
        const subCodeBase = slugCode(item.name, `SUB_${i + 1}`);
        let subCode = subCodeBase;
        let sfx = 2;
        while (
          await tx.vaultSubContainer.findUnique({
            where: { vaultId_code: { vaultId: createdVault.id, code: subCode } },
          })
        ) {
          subCode = `${subCodeBase}_${sfx++}`;
        }

        const initSubBal = roundMoney(item.initialBalance || 0);
        const isForeign = ccy !== baseCurrency;
        const isSynced = isForeign
          ? !initSubBal.isZero() || Boolean(item.isSynced)
          : Boolean(item.isSynced);

        const sc = await tx.vaultSubContainer.create({
          data: {
            vaultId: createdVault.id,
            code: subCode,
            name: String(item.name).trim(),
            currency: ccy,
            isDefault: i === targetDefaultIdx,
            currentBalance: initSubBal,
            lastCountedBalance: initSubBal,
            isSynced,
            colorHex: item.colorHex || null,
            sortOrder: (i + 1) * 10,
          },
        });

        if (i === targetDefaultIdx && ccy === baseCurrency) {
          defaultBaseSubId = sc.id;
        }
      }
      await ensureDefaultSubContainer(tx, createdVault.id, baseCurrency);
    }

    if (!initialDec.isZero()) {
      const now = new Date();
      const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      let selfParty = await tx.party.findFirst({
        where: { userId: user.id, partyType: "SELF" },
      });
      if (!selfParty) {
        selfParty = await tx.party.create({
          data: {
            userId: user.id,
            code: "SELF",
            name: user.fullName || user.username || "Me",
            partyType: "SELF",
            isActive: true,
          },
        });
      }
      const initCategory = await tx.category.findUnique({
        where: { userId_code: { userId: user.id, code: "SYS_INITIAL_FUND" } },
      });

      const cp = await tx.vaultCheckpoint.create({
        data: {
          userId: user.id,
          vaultId: createdVault.id,
          checkpointTimestamp: now,
          checkpointDate: now,
          periodLabel: `Initial Balance - ${createdVault.name}`,
          checkpointType: "INITIAL_FUND",
          originalCountedAmount: initialDec,
          effectiveAnchorAmount: initialDec,
          systemBookBalanceBefore: toDecimal(0),
          rawDiscrepancyAmount: toDecimal(0),
          unexplainedDiscrepancyAmount: toDecimal(0),
          notes: "Created via New Vault profile",
        },
      });

      const initTx = await tx.transaction.create({
        data: {
          userId: user.id,
          transactionDate: now,
          transactionTime: timeStr,
          monthTag,
          title: `Initial Balance - ${createdVault.name}`,
          nature: "INITIAL_FUND",
          categoryId: initCategory ? initCategory.id : null,
          commitmentType: "NONE",
          priorityTier: "NONE",
          partyId: selfParty.id,
          linkedCheckpointId: cp.id,
          currency: baseCurrency,
          fxRateApplied: toDecimal(1),
          grossAmount: initialDec.abs(),
          consumeAmount: toDecimal(0),
          incomeAmount: toDecimal(0),
          notes: "Opening balance for new vault",
        },
      });

      const isPositive = initialDec.greaterThanOrEqualTo(0);
      await tx.transactionLeg.create({
        data: {
          userId: user.id,
          transactionId: initTx.id,
          vaultId: createdVault.id,
          subContainerId: defaultBaseSubId,
          legRole: "PRIMARY",
          currency: baseCurrency,
          fxRateApplied: toDecimal(1),
          originalMutation: initialDec,
          debitIn: isPositive ? initialDec : toDecimal(0),
          creditOut: isPositive ? toDecimal(0) : initialDec.abs(),
          netMutation: initialDec,
          runningVaultBalance: initialDec,
          runningTotalWealth: initialDec,
        },
      });

      await tx.vault.update({
        where: { id: createdVault.id },
        data: { currentBalance: initialDec },
      });

      if (defaultBaseSubId) {
        const targetSub = await tx.vaultSubContainer.findUnique({
          where: { id: defaultBaseSubId },
        });
        if (
          targetSub &&
          toDecimal(targetSub.currentBalance).isZero() &&
          !targetSub.isSynced
        ) {
          await evaluateBasePartitionState(tx, createdVault.id, baseCurrency);
        }
      }

      await recalculateLedgerRunningBalances(tx, user.id);
    }

    return await findUserVaultById(createdVault.id, user.id, tx);
  });
}

export async function updateUserVaultProfile(userId, rawVaultId, body = {}) {
  const vaultId = parseInt(rawVaultId, 10);
  if (!vaultId) throw new BadRequestError("Invalid vault ID");

  const existing = await findUserVaultById(vaultId, userId);
  if (!existing) throw new NotFoundError("Vault not found");

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

  if (vaultType !== undefined && !ALLOWED_VAULT_TYPES.has(vaultType)) {
    throw new BadRequestError("Invalid vault type");
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

  return await updateVaultById(vaultId, updateData);
}

export async function archiveUserVault(userId, rawVaultId) {
  const vaultId = parseInt(rawVaultId, 10);
  if (!vaultId) throw new BadRequestError("Invalid vault ID");

  const existing = await findUserVaultById(vaultId, userId);
  if (!existing) throw new NotFoundError("Vault not found");

  const activeCount = await countActiveUserVaults(userId);
  if (activeCount <= 1) {
    throw new BadRequestError("Cannot archive the last remaining active vault");
  }

  return await updateVaultById(vaultId, { isActive: false });
}

export async function createSubVaultPocket(userId, rawVaultId, body = {}) {
  const vaultId = parseInt(rawVaultId, 10);
  if (!vaultId) throw new BadRequestError("Invalid vault ID");

  const {
    name,
    currency,
    isDefault = false,
    colorHex = null,
    initialBalance = null,
    isSynced = null,
  } = body;

  if (!name || !String(name).trim()) {
    throw new BadRequestError("Sub-vault name is required");
  }

  return await prisma.$transaction(async (tx) => {
    const vault = await findUserVaultById(vaultId, userId, tx);
    if (!vault) throw new NotFoundError("Vault not found");

    const settings = await getOrCreateAppSettings(userId, tx);
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

    const baseSlug = slugCode(name, `SUB_${existingCount + 1}`);
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
        name: String(name).trim(),
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
}

export async function updateOrSyncSubVaults(userId, rawVaultId, body = {}) {
  const vaultId = parseInt(rawVaultId, 10);
  if (!vaultId) throw new BadRequestError("Invalid vault ID");

  const ownedVault = await findUserVaultById(vaultId, userId);
  if (!ownedVault) throw new NotFoundError("Vault not found");

  const settings = await getOrCreateAppSettings(userId);
  const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

  if (Array.isArray(body.allocations) || body.defaultSubContainerId !== undefined) {
    const result = await syncVaultPartitions(vaultId, {
      allocations: body.allocations || [],
      defaultSubContainerId: body.defaultSubContainerId || null,
      baseCurrency,
      userId,
    });
    const rateMap = await getCachedRateMap(baseCurrency);
    return {
      ...result,
      partitionSummary: computeVaultPartitionSummary(result.vault, baseCurrency, rateMap),
    };
  }

  const { subContainerId, name, colorHex, currency, isDefault } = body;
  if (!subContainerId) {
    throw new BadRequestError("subContainerId is required");
  }

  return await prisma.$transaction(async (tx) => {
    const subId = parseInt(subContainerId, 10);
    const sub = await tx.vaultSubContainer.findUnique({ where: { id: subId } });
    if (!sub || sub.vaultId !== vaultId) {
      throw new NotFoundError("Sub-vault not found for this vault");
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
    const vault = await findUserVaultById(vaultId, userId, tx);
    return { vault, partitionState };
  });
}

export async function deleteSubVaultPocket(userId, rawVaultId, rawSubId) {
  const vaultId = parseInt(rawVaultId, 10);
  const subId = parseInt(rawSubId, 10);
  if (!vaultId || !subId) {
    throw new BadRequestError("vaultId and subId are required");
  }

  return await prisma.$transaction(async (tx) => {
    const ownedVault = await findUserVaultById(vaultId, userId, tx);
    if (!ownedVault) throw new NotFoundError("Vault not found");

    const settings = await getOrCreateAppSettings(userId, tx);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

    const sub = await tx.vaultSubContainer.findUnique({ where: { id: subId } });
    if (!sub || sub.vaultId !== vaultId) {
      throw new NotFoundError("Sub-vault not found for this vault");
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
}
