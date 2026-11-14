// Dynamic Sub-Vault Partition, Auto-Fill & Out-of-Sync Spillover Detection Service (#3, #4)

import prisma from "./prisma.js";
import { toDecimal, addMoney, subMoney, roundMoney, mulMoney } from "./money.js";
import { getCurrencySymbol } from "./currencyHelpers.js";

/**
 * Ensure any Vault with sub-containers has one mandatory Default Sub-Vault and migrated balances
 */
export async function ensureDefaultSubContainer(tx, vaultId) {
  const subs = await tx.vaultSubContainer.findMany({
    where: { vaultId },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  if (subs.length === 0) return null;

  // One-time lazy backfill for legacy D1/D2 rows created before live sub-vault tracking
  for (const sc of subs) {
    const cur = toDecimal(sc.currentBalance);
    const last = toDecimal(sc.lastCountedBalance);
    if (cur.isZero() && !sc.isSynced && !last.isZero()) {
      await tx.vaultSubContainer.update({
        where: { id: sc.id },
        data: {
          currentBalance: roundMoney(last),
          isSynced: true,
        },
      });
      sc.currentBalance = roundMoney(last);
      sc.isSynced = true;
    }
  }

  let defaultSub = subs.find((s) => s.isDefault);
  if (!defaultSub) {
    defaultSub = subs[0];
    await tx.vaultSubContainer.update({
      where: { id: defaultSub.id },
      data: { isDefault: true },
    });
    defaultSub.isDefault = true;
  }

  return defaultSub;
}

/**
 * Evaluate whether same-currency (baseCurrency) sub-vault partitions conflict with Main Vault balance
 * Triggers subVaultOutOfSync warning without blocking user transactions (#3 bypass support)
 */
export async function evaluateBasePartitionState(
  tx,
  vaultId,
  baseCurrency = "IDR",
  contextNote = null
) {
  const vault = await tx.vault.findUnique({
    where: { id: vaultId },
    include: {
      subContainers: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!vault) return { isOutOfSync: false, warningNote: null };

  const baseUpper = String(baseCurrency || "IDR").toUpperCase();
  const baseSubs = (vault.subContainers || []).filter(
    (sc) => String(sc.currency || baseUpper).toUpperCase() === baseUpper
  );

  if (baseSubs.length === 0) {
    if (vault.subVaultOutOfSync) {
      await tx.vault.update({
        where: { id: vault.id },
        data: { subVaultOutOfSync: false, subVaultSyncNote: null },
      });
    }
    return { isOutOfSync: false, warningNote: null };
  }

  const syncedSubs = baseSubs.filter((sc) => sc.isSynced);
  const parentBal = roundMoney(vault.currentBalance);
  const syncedSum = syncedSubs.reduce(
    (acc, sc) => addMoney(acc, sc.currentBalance),
    toDecimal(0)
  );
  const unallocated = subMoney(parentBal, syncedSum);

  let warningNote = null;
  if (syncedSubs.length > 0 && unallocated.lessThan(0)) {
    const drift = unallocated.abs().toFixed(0);
    warningNote =
      contextNote ||
      `Sub-vault partitions (${syncedSum.toFixed(0)}) exceed main vault balance (${parentBal.toFixed(0)}) by ${drift}. Re-sync sub-vault splits.`;
  } else {
    const negativeSynced = syncedSubs.find((sc) => toDecimal(sc.currentBalance).lessThan(0));
    if (negativeSynced) {
      warningNote =
        contextNote ||
        `Synced sub-vault "${negativeSynced.name}" dipped negative (${roundMoney(negativeSynced.currentBalance).toFixed(0)}), spilling into sibling partitions.`;
    }
  }

  const isOutOfSync = Boolean(warningNote);

  await tx.vault.update({
    where: { id: vault.id },
    data: {
      subVaultOutOfSync: isOutOfSync,
      subVaultSyncNote: warningNote,
    },
  });

  return { isOutOfSync, warningNote };
}

/**
 * Decorate a Vault object with UI-ready Sub-Vault partition states and Mark-to-Market Valas totals
 */
export function computeVaultPartitionSummary(vault, baseCurrency = "IDR", rateMap = {}) {
  const baseUpper = String(baseCurrency || "IDR").toUpperCase();
  const rawSubs = vault?.subContainers || [];
  const baseSubs = [];
  const foreignSubs = [];

  for (const sc of rawSubs) {
    const ccy = String(sc.currency || baseUpper).toUpperCase();
    if (ccy === baseUpper) {
      baseSubs.push(sc);
    } else {
      foreignSubs.push(sc);
    }
  }

  const parentBaseDec = roundMoney(vault?.currentBalance || 0);
  const syncedBaseSubs = baseSubs.filter((sc) => sc.isSynced);
  const unsyncedBaseSubs = baseSubs.filter((sc) => !sc.isSynced);
  const syncedBaseSum = syncedBaseSubs.reduce(
    (acc, sc) => addMoney(acc, sc.currentBalance),
    toDecimal(0)
  );
  const unallocatedBasePool = roundMoney(subMoney(parentBaseDec, syncedBaseSum));

  // If 2 base pockets exist and exactly 1 stays unsynced while the other is synced, project remainder
  const singleUnsyncedRemainderEligible =
    syncedBaseSubs.length > 0 && unsyncedBaseSubs.length === 1;

  let estimatedForeignBaseDec = toDecimal(0);

  const decoratedSubs = rawSubs.map((sc) => {
    const ccy = String(sc.currency || baseUpper).toUpperCase();
    const isBase = ccy === baseUpper;

    if (isBase) {
      let displayBal = roundMoney(sc.currentBalance).toNumber();
      let partitionState = sc.isSynced ? "SYNCED" : "UNSYNCED_POOL";

      if (!sc.isSynced && singleUnsyncedRemainderEligible) {
        displayBal = unallocatedBasePool.toNumber();
        partitionState = "AUTO_DERIVED";
      }

      return {
        ...sc,
        currency: ccy,
        currencySymbol: getCurrencySymbol(ccy),
        isForeign: false,
        fxRate: 1,
        missingRate: false,
        effectiveBalance: displayBal,
        estimatedBaseValue: displayBal,
        partitionState,
      };
    }

    const nativeBal = roundMoney(sc.currentBalance).toNumber();
    const rateEntry = rateMap[ccy];
    const hasRate = Boolean(rateEntry && Number(rateEntry.rate) > 0);
    const fxRate = hasRate ? Number(rateEntry.rate) : 0;
    const estBaseDec = hasRate
      ? roundMoney(mulMoney(toDecimal(nativeBal), toDecimal(fxRate)))
      : toDecimal(0);

    estimatedForeignBaseDec = addMoney(estimatedForeignBaseDec, estBaseDec);

    return {
      ...sc,
      currency: ccy,
      currencySymbol: getCurrencySymbol(ccy),
      isForeign: true,
      fxRate,
      rateDate: rateEntry?.rateDate || null,
      missingRate: !hasRate,
      effectiveBalance: nativeBal,
      estimatedBaseValue: estBaseDec.toNumber(),
      partitionState: "FOREIGN_NATIVE",
    };
  });

  const totalEstimatedBaseDec = roundMoney(addMoney(parentBaseDec, estimatedForeignBaseDec));
  const defaultSub = rawSubs.find((s) => s.isDefault) || rawSubs[0] || null;
  const computedOutOfSync =
    Boolean(vault?.subVaultOutOfSync) ||
    (syncedBaseSubs.length > 0 && unallocatedBasePool.lessThan(0));

  return {
    baseCurrency: baseUpper,
    baseBookBalance: parentBaseDec.toNumber(),
    estimatedForeignBase: roundMoney(estimatedForeignBaseDec).toNumber(),
    totalEstimatedBase: totalEstimatedBaseDec.toNumber(),
    unallocatedBasePool: unallocatedBasePool.toNumber(),
    hasBaseSubVaults: baseSubs.length > 0,
    hasForeignSubVaults: foreignSubs.length > 0,
    unsyncedBaseCount: unsyncedBaseSubs.length,
    isOutOfSync: computedOutOfSync,
    syncWarningMessage: vault?.subVaultSyncNote || null,
    defaultSubContainerId: defaultSub ? defaultSub.id : null,
    subContainers: decoratedSubs,
  };
}

/**
 * Mutate target Sub-Vault during a ledger transaction without blocking user flow
 */
export async function applySubVaultMutationInTx(
  tx,
  {
    vaultId,
    subContainerId = null,
    mutationAmount = 0,
    baseCurrency = "IDR",
    contextLabel = null,
  }
) {
  const vault = await tx.vault.findUnique({
    where: { id: vaultId },
    include: { subContainers: true },
  });
  if (!vault || !vault.subContainers || vault.subContainers.length === 0) {
    return { subContainer: null, triggeredWarning: false };
  }

  let targetSub = null;
  if (subContainerId) {
    targetSub = vault.subContainers.find((s) => s.id === parseInt(subContainerId, 10));
    if (!targetSub) {
      throw new Error("Selected sub-vault does not belong to this vault");
    }
  } else {
    targetSub = await ensureDefaultSubContainer(tx, vault.id);
  }

  if (!targetSub) return { subContainer: null, triggeredWarning: false };

  const mutDec = toDecimal(mutationAmount);
  const subCurrency = String(targetSub.currency || baseCurrency).toUpperCase();
  const baseUpper = String(baseCurrency || "IDR").toUpperCase();

  const updatedSub = await tx.vaultSubContainer.update({
    where: { id: targetSub.id },
    data: {
      currentBalance: roundMoney(addMoney(targetSub.currentBalance, mutDec)),
    },
  });

  let triggeredWarning = false;
  if (subCurrency === baseUpper) {
    const partitionState = await evaluateBasePartitionState(
      tx,
      vault.id,
      baseUpper,
      mutDec.lessThan(0) && !targetSub.isSynced
        ? contextLabel
          ? `Transaction "${contextLabel}" on "${targetSub.name}" crossed into synced sub-vault partitions.`
          : null
        : null
    );
    triggeredWarning = partitionState.isOutOfSync;
  }

  return { subContainer: updatedSub, triggeredWarning };
}

/**
 * Sync Sub-Vault Split Partitions WITHOUT altering Main Vault balance (#3)
 * - Auto-fills 2nd pocket when only 1 unsynced base-currency sub-vault remains
 * - Leaves 2+ unsynced pockets as Unallocated Pool
 */
export async function syncVaultPartitions(
  vaultId,
  { allocations = [], defaultSubContainerId = null, baseCurrency = "IDR" }
) {
  const vId = parseInt(vaultId, 10);
  const baseUpper = String(baseCurrency || "IDR").toUpperCase();

  return await prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findUnique({
      where: { id: vId },
      include: {
        subContainers: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!vault) throw new Error("Vault not found");

    if (defaultSubContainerId) {
      const dId = parseInt(defaultSubContainerId, 10);
      const validDefault = vault.subContainers.find((s) => s.id === dId);
      if (!validDefault) throw new Error("Default sub-vault does not belong to this vault");
      await tx.vaultSubContainer.updateMany({
        where: { vaultId: vId },
        data: { isDefault: false },
      });
      await tx.vaultSubContainer.update({
        where: { id: dId },
        data: { isDefault: true },
      });
    }

    const allocMap = new Map();
    for (const item of allocations) {
      if (item && item.id) {
        allocMap.set(parseInt(item.id, 10), item);
      }
    }

    // Apply explicit sync values first
    const baseSubStates = [];
    for (const sc of vault.subContainers) {
      const ccy = String(sc.currency || baseUpper).toUpperCase();
      const spec = allocMap.get(sc.id);
      const wantsSynced = spec
        ? spec.isSynced !== undefined
          ? Boolean(spec.isSynced)
          : spec.balance !== "" && spec.balance !== null && spec.balance !== undefined
        : sc.isSynced;

      if (spec) {
        const nextBal = wantsSynced ? roundMoney(spec.balance || 0) : toDecimal(0);
        await tx.vaultSubContainer.update({
          where: { id: sc.id },
          data: {
            ...(spec.name ? { name: spec.name.trim() } : {}),
            ...(spec.colorHex !== undefined ? { colorHex: spec.colorHex || null } : {}),
            isSynced: wantsSynced,
            currentBalance: nextBal,
            lastCountedBalance: nextBal,
          },
        });
        if (ccy === baseUpper) {
          baseSubStates.push({ id: sc.id, isSynced: wantsSynced, balance: nextBal });
        }
      } else if (ccy === baseUpper) {
        baseSubStates.push({
          id: sc.id,
          isSynced: sc.isSynced,
          balance: roundMoney(sc.currentBalance),
        });
      }
    }

    // #3 Auto-fill rule: only fill automatically when EXACTLY 1 other same-currency pocket is unsynced
    const syncedBase = baseSubStates.filter((s) => s.isSynced);
    const unsyncedBase = baseSubStates.filter((s) => !s.isSynced);

    if (syncedBase.length > 0 && unsyncedBase.length === 1) {
      const syncedSum = syncedBase.reduce((acc, s) => addMoney(acc, s.balance), toDecimal(0));
      const remainder = roundMoney(subMoney(vault.currentBalance, syncedSum));
      const targetUnsynced = unsyncedBase[0];

      await tx.vaultSubContainer.update({
        where: { id: targetUnsynced.id },
        data: {
          currentBalance: remainder,
          lastCountedBalance: remainder,
          isSynced: true,
        },
      });
    }

    await ensureDefaultSubContainer(tx, vId);
    const state = await evaluateBasePartitionState(tx, vId, baseUpper);

    const refreshed = await tx.vault.findUnique({
      where: { id: vId },
      include: {
        subContainers: {
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    return {
      vault: refreshed,
      partitionState: state,
    };
  });
}
