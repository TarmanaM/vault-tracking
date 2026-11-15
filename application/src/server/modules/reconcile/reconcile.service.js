// Vault reconciliation & denomination checkpoint service
import "server-only";
import prisma from "@/server/db/prisma";
import { toDecimal, subMoney, roundMoney } from "@/shared/money";
import { recalculateLedgerRunningBalances } from "@/lib/ledgerService";
import { getOrCreateAppSettings, getCachedRateMap } from "@/lib/fxService";
import {
  ensureDefaultSubContainer,
  evaluateBasePartitionState,
  computeVaultPartitionSummary,
} from "@/lib/subVaultService";
import { NotFoundError } from "@/server/http/errors";

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

export async function recordVaultReconciliation(user, body = {}) {
  const {
    vaultId,
    checkpointType = "AUDIT_SYNC",
    periodLabel = null,
    actualCountedAmount,
    denominations = [],
    subContainers = [],
    notes = null,
  } = body;

  return await prisma.$transaction(async (tx) => {
    const vault = await tx.vault.findFirst({
      where: { id: parseInt(vaultId, 10), userId: user.id },
      include: { subContainers: true },
    });
    if (!vault) throw new NotFoundError("Vault not found");

    const countedDec = roundMoney(actualCountedAmount);
    const bookDec = roundMoney(vault.currentBalance);
    const discrepancyDec = subMoney(countedDec, bookDec);

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

    const settings = await getOrCreateAppSettings(user.id, tx);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();

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

    if (discrepancyDec.lessThan(0)) {
      const lostCategory = await tx.category.findUnique({
        where: { userId_code: { userId: user.id, code: "EXP_CASH_LOST" } },
      });
      const absDiff = discrepancyDec.abs();

      const reconTx = await tx.transaction.create({
        data: {
          userId: user.id,
          transactionDate: now,
          transactionTime: timeStr,
          monthTag,
          title: `Unrecorded Shortage - ${vault.name}`,
          nature: "RECONCILIATION_LOST",
          categoryId: lostCategory ? lostCategory.id : null,
          commitmentType: "NONE",
          priorityTier: "NONE",
          partyId: selfParty.id,
          linkedCheckpointId: checkpoint.id,
          currency: baseCurrency,
          fxRateApplied: 1,
          grossAmount: absDiff,
          consumeAmount: toDecimal(0),
          incomeAmount: toDecimal(0),
          notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
        },
      });

      await tx.transactionLeg.create({
        data: {
          userId: user.id,
          transactionId: reconTx.id,
          vaultId: vault.id,
          subContainerId: defaultSub ? defaultSub.id : null,
          legRole: "PRIMARY",
          currency: baseCurrency,
          fxRateApplied: 1,
          originalMutation: absDiff.negated(),
          debitIn: toDecimal(0),
          creditOut: absDiff,
          netMutation: absDiff.negated(),
          runningVaultBalance: countedDec,
          runningTotalWealth: countedDec,
        },
      });
    } else if (discrepancyDec.greaterThan(0)) {
      const surplusCategory = await tx.category.findUnique({
        where: { userId_code: { userId: user.id, code: "INC_RECON_SURPLUS" } },
      });

      const reconTx = await tx.transaction.create({
        data: {
          userId: user.id,
          transactionDate: now,
          transactionTime: timeStr,
          monthTag,
          title: `Reconciliation Surplus / Interest - ${vault.name}`,
          nature: "RECONCILIATION_FOUND",
          categoryId: surplusCategory ? surplusCategory.id : null,
          commitmentType: "NONE",
          priorityTier: "NONE",
          partyId: selfParty.id,
          linkedCheckpointId: checkpoint.id,
          currency: baseCurrency,
          fxRateApplied: 1,
          grossAmount: discrepancyDec,
          consumeAmount: toDecimal(0),
          incomeAmount: discrepancyDec,
          notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
        },
      });

      await tx.transactionLeg.create({
        data: {
          userId: user.id,
          transactionId: reconTx.id,
          vaultId: vault.id,
          subContainerId: defaultSub ? defaultSub.id : null,
          legRole: "PRIMARY",
          currency: baseCurrency,
          fxRateApplied: 1,
          originalMutation: discrepancyDec,
          debitIn: discrepancyDec,
          creditOut: toDecimal(0),
          netMutation: discrepancyDec,
          runningVaultBalance: countedDec,
          runningTotalWealth: countedDec,
        },
      });
    }

    await tx.vault.update({
      where: { id: vault.id },
      data: { currentBalance: countedDec },
    });

    await evaluateBasePartitionState(tx, vault.id, baseCurrency);
    await recalculateLedgerRunningBalances(tx, user.id);

    return checkpoint;
  });
}
