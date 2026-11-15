// Vault reconciliation & denomination checkpoint service
import "server-only";
import prisma from "@/server/db/prisma";
import { toDecimal, addMoney, subMoney, mulMoney, roundMoney } from "@/shared/money";
import { recalculateLedgerRunningBalances } from "@/lib/ledgerService";
import { getOrCreateAppSettings, getCachedRateMap, resolveFxRate } from "@/lib/fxService";
import {
  ensureDefaultSubContainer,
  evaluateBasePartitionState,
  computeVaultPartitionSummary,
} from "@/lib/subVaultService";
import { BadRequestError, NotFoundError } from "@/server/http/errors";

export async function listReconcileHistoryAndVaults(userId) {
  const settings = await getOrCreateAppSettings(userId);
  const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
  const rateMap = await getCachedRateMap(baseCurrency);

  const [checkpoints, rawVaults] = await Promise.all([
    prisma.vaultCheckpoint.findMany({
      where: { userId: Number(userId) },
      include: {
        vault: true,
        denominations: true,
        linkedTransactions: true,
      },
      orderBy: { checkpointTimestamp: "desc" },
      take: 30,
    }),
    prisma.vault.findMany({
      where: { userId: Number(userId), isActive: true },
      include: {
        subContainers: {
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const vaults = rawVaults.map((v) => {
    const partitionSummary = computeVaultPartitionSummary(v, baseCurrency, rateMap);
    return {
      ...v,
      subContainers: partitionSummary.subContainers,
      partitionSummary,
      totalEstimatedBase: partitionSummary.totalEstimatedBase,
    };
  });

  return {
    checkpoints,
    vaults,
    baseCurrency,
    rateMap,
  };
}

/**
 * Record the ledger adjustment transaction for a positive or negative reconciliation discrepancy.
 */
async function recordReconciliationAdjustmentTx(
  tx,
  {
    userId,
    vault,
    subContainerId,
    checkpoint,
    diffDec,
    baseDiffDec = diffDec,
    legCurrency = "IDR",
    fxRateApplied = toDecimal(1),
    isForeign = false,
    checkpointType,
    now,
    monthTag,
    timeStr,
    selfParty,
    runningVaultBalance,
    labelSuffix,
  }
) {
  if (diffDec.isZero()) return;

  if (diffDec.lessThan(0)) {
    const lostCategory = await tx.category.findUnique({
      where: { userId_code: { userId, code: "EXP_CASH_LOST" } },
    });
    const absBaseDiff = baseDiffDec.abs();
    const absOrigDiff = diffDec.abs();

    const reconTx = await tx.transaction.create({
      data: {
        userId,
        transactionDate: now,
        transactionTime: timeStr,
        monthTag,
        title: `Unrecorded Shortage - ${labelSuffix}`,
        nature: "RECONCILIATION_LOST",
        categoryId: lostCategory ? lostCategory.id : null,
        commitmentType: "NONE",
        priorityTier: "NONE",
        partyId: selfParty.id,
        linkedCheckpointId: checkpoint.id,
        currency: legCurrency,
        fxRateApplied,
        originalGrossAmount: isForeign ? absOrigDiff : null,
        grossAmount: absBaseDiff,
        consumeAmount: toDecimal(0),
        incomeAmount: toDecimal(0),
        notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
      },
    });

    await tx.transactionLeg.create({
      data: {
        userId,
        transactionId: reconTx.id,
        vaultId: vault.id,
        subContainerId: subContainerId || null,
        legRole: "PRIMARY",
        currency: legCurrency,
        fxRateApplied,
        originalMutation: roundMoney(diffDec),
        debitIn: toDecimal(0),
        creditOut: isForeign ? toDecimal(0) : absBaseDiff,
        netMutation: isForeign ? toDecimal(0) : diffDec,
        runningVaultBalance,
        runningTotalWealth: runningVaultBalance,
      },
    });
    return;
  }

  const isInitialFund = String(checkpointType || "").toUpperCase() === "INITIAL_FUND";
  const categoryCode = isInitialFund ? "SYS_INITIAL_FUND" : "INC_RECON_SURPLUS";
  const matchedCategory = await tx.category.findUnique({
    where: { userId_code: { userId, code: categoryCode } },
  });

  const reconTx = await tx.transaction.create({
    data: {
      userId,
      transactionDate: now,
      transactionTime: timeStr,
      monthTag,
      title: isInitialFund
        ? `Initial Fund - ${labelSuffix}`
        : `Reconciliation Surplus / Interest - ${labelSuffix}`,
      nature: isInitialFund ? "INITIAL_FUND" : "RECONCILIATION_FOUND",
      categoryId: matchedCategory ? matchedCategory.id : null,
      commitmentType: "NONE",
      priorityTier: "NONE",
      partyId: selfParty.id,
      linkedCheckpointId: checkpoint.id,
      currency: legCurrency,
      fxRateApplied,
      originalGrossAmount: isForeign ? diffDec.abs() : null,
      grossAmount: baseDiffDec,
      consumeAmount: toDecimal(0),
      incomeAmount: isInitialFund ? toDecimal(0) : baseDiffDec,
      notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
    },
  });

  await tx.transactionLeg.create({
    data: {
      userId,
      transactionId: reconTx.id,
      vaultId: vault.id,
      subContainerId: subContainerId || null,
      legRole: "PRIMARY",
      currency: legCurrency,
      fxRateApplied,
      originalMutation: roundMoney(diffDec),
      debitIn: isForeign ? toDecimal(0) : baseDiffDec,
      creditOut: toDecimal(0),
      netMutation: isForeign ? toDecimal(0) : baseDiffDec,
      runningVaultBalance,
      runningTotalWealth: runningVaultBalance,
    },
  });
}

export async function recordVaultReconciliation(user, body = {}) {
  const {
    vaultId,
    checkpointType = "AUDIT_SYNC",
    periodLabel = null,
    actualCountedAmount = 0,
    denominations = [],
    subContainers = [],
    pocketAudits = [],
    notes = null,
  } = body;

  return await prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findFirst({
      where: { id: parseInt(vaultId, 10), userId: user.id },
      include: { subContainers: true },
    });
    if (!vault) throw new NotFoundError("Vault not found");

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

    const settings = await getOrCreateAppSettings(user.id, tx);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
    const bookDec = roundMoney(vault.currentBalance);
    const hasPocketAudits = Array.isArray(pocketAudits) && pocketAudits.length > 0;

    if (hasPocketAudits) {
      const subMap = new Map((vault.subContainers || []).map((s) => [s.id, s]));
      const auditedLabels = [];
      let totalBaseDiffDec = toDecimal(0);
      let runningBaseVault = bookDec;

      for (const audit of pocketAudits) {
        const subId = parseInt(audit.subContainerId, 10);
        const sub = subMap.get(subId);
        if (!sub) {
          throw new BadRequestError("Audited pocket does not belong to this vault");
        }
        const subCountedDec = roundMoney(audit.actualCountedAmount);
        const subBookDec = roundMoney(sub.currentBalance);
        const subDiffDec = subMoney(subCountedDec, subBookDec);
        const subCurrency = String(sub.currency || baseCurrency).toUpperCase();

        await tx.vaultSubContainer.update({
          where: { id: sub.id },
          data: {
            currentBalance: subCountedDec,
            lastCountedBalance: subCountedDec,
            isSynced: true,
          },
        });

        auditedLabels.push(`${sub.name} (${subCurrency}: ${subCountedDec.toFixed(0)})`);

        if (subCurrency === baseCurrency) {
          totalBaseDiffDec = addMoney(totalBaseDiffDec, subDiffDec);
        }
      }

      const nextVaultBaseDec = roundMoney(addMoney(bookDec, totalBaseDiffDec));
      const checkpoint = await tx.vaultCheckpoint.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          checkpointTimestamp: now,
          checkpointDate: now,
          periodLabel: periodLabel || `Pocket Audit ${monthTag}`,
          checkpointType,
          originalCountedAmount: nextVaultBaseDec,
          effectiveAnchorAmount: nextVaultBaseDec,
          systemBookBalanceBefore: bookDec,
          rawDiscrepancyAmount: totalBaseDiffDec,
          unexplainedDiscrepancyAmount: totalBaseDiffDec,
          notes: notes || `Audited pockets: ${auditedLabels.join(", ")}`,
        },
      });

      for (const audit of pocketAudits) {
        const sub = subMap.get(parseInt(audit.subContainerId, 10));
        const subCurrency = String(sub.currency || baseCurrency).toUpperCase();
        const isForeign = subCurrency !== baseCurrency;

        const subCountedDec = roundMoney(audit.actualCountedAmount);
        const subBookDec = roundMoney(sub.currentBalance);
        const subDiffDec = subMoney(subCountedDec, subBookDec);
        if (subDiffDec.isZero()) continue;

        let fxRateApplied = toDecimal(1);
        let baseDiffDec = subDiffDec;
        if (isForeign) {
          try {
            const fxInfo = await resolveFxRate({
              fromCurrency: subCurrency,
              baseCurrency,
              tx,
            });
            fxRateApplied = fxInfo.rateDec;
            baseDiffDec = roundMoney(mulMoney(subDiffDec, fxRateApplied));
          } catch {
            fxRateApplied = toDecimal(1);
            baseDiffDec = toDecimal(0);
          }
        } else {
          runningBaseVault = roundMoney(addMoney(runningBaseVault, subDiffDec));
        }

        await recordReconciliationAdjustmentTx(tx, {
          userId: user.id,
          vault,
          subContainerId: sub.id,
          checkpoint,
          diffDec: subDiffDec,
          baseDiffDec,
          legCurrency: subCurrency,
          fxRateApplied,
          isForeign,
          checkpointType,
          now,
          monthTag,
          timeStr,
          selfParty,
          runningVaultBalance: runningBaseVault,
          labelSuffix: `${vault.name} (${sub.name})`,
        });
      }

      await tx.vault.update({
        where: { id: vault.id },
        data: { currentBalance: nextVaultBaseDec },
      });

      await evaluateBasePartitionState(tx, vault.id, baseCurrency);
      await recalculateLedgerRunningBalances(tx, user.id);

      return checkpoint;
    }

    const countedDec = roundMoney(actualCountedAmount);
    const discrepancyDec = subMoney(countedDec, bookDec);

    const checkpoint = await tx.vaultCheckpoint.create({
      data: {
        userId: user.id,
        vaultId: vault.id,
        checkpointTimestamp: now,
        checkpointDate: now,
        periodLabel: periodLabel || `Audit ${monthTag}`,
        checkpointType,
        originalCountedAmount: countedDec,
        effectiveAnchorAmount: countedDec,
        systemBookBalanceBefore: bookDec,
        rawDiscrepancyAmount: discrepancyDec,
        unexplainedDiscrepancyAmount: discrepancyDec,
        notes,
      },
    });

    if (denominations && denominations.length > 0) {
      for (const d of denominations) {
        const uVal = toDecimal(d.unitValue);
        const qty = parseInt(d.quantity, 10) || 0;
        const sub = uVal.times(qty);

        await tx.checkpointDenomination.create({
          data: {
            checkpointId: checkpoint.id,
            itemType: d.itemType || "COIN_PIECE",
            label: d.label || `Unit ${d.unitValue}`,
            unitValue: uVal,
            quantity: qty,
            subtotal: sub,
          },
        });
      }
    }

    if (subContainers && subContainers.length > 0) {
      for (const sc of subContainers) {
        const balDec = roundMoney(sc.balance);
        await tx.vaultSubContainer.upsert({
          where: { vaultId_code: { vaultId: vault.id, code: sc.code } },
          update: {
            currentBalance: balDec,
            lastCountedBalance: balDec,
            isSynced: true,
            ...(sc.currency ? { currency: String(sc.currency).toUpperCase() } : {}),
          },
          create: {
            vaultId: vault.id,
            code: sc.code,
            name: sc.name || `Pocket ${sc.code}`,
            currency: sc.currency ? String(sc.currency).toUpperCase() : baseCurrency,
            currentBalance: balDec,
            lastCountedBalance: balDec,
            isSynced: true,
          },
        });
      }
      await tx.vault.update({
        where: { id: vault.id },
        data: { hasSubContainers: true },
      });
    }

    const defaultSub = await ensureDefaultSubContainer(tx, vault.id, baseCurrency);

    await recordReconciliationAdjustmentTx(tx, {
      userId: user.id,
      vault,
      subContainerId: defaultSub ? defaultSub.id : null,
      checkpoint,
      diffDec: discrepancyDec,
      baseDiffDec: discrepancyDec,
      legCurrency: baseCurrency,
      fxRateApplied: toDecimal(1),
      isForeign: false,
      checkpointType,
      now,
      monthTag,
      timeStr,
      selfParty,
      runningVaultBalance: countedDec,
      labelSuffix: vault.name,
    });

    await tx.vault.update({
      where: { id: vault.id },
      data: { currentBalance: countedDec },
    });

    await evaluateBasePartitionState(tx, vault.id, baseCurrency);
    await recalculateLedgerRunningBalances(tx, user.id);

    return checkpoint;
  });
}
