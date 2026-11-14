// API Route: GET & POST /api/reconcile
// Handles physical vault audit, coin denominations, sub-wallet counting (D1/D2), and auto-reconciliation

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, subMoney, roundMoney } from "@/lib/money";
import { recalculateLedgerRunningBalances } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      vaultId,
      checkpointType = "AUDIT_SYNC", // INITIAL_FUND, AUDIT_SYNC
      periodLabel = null,
      actualCountedAmount,
      denominations = [],
      subContainers = [],
      notes = null,
    } = body;

    const result = await prisma.$transaction(async (tx) => {
      const vault = await tx.vault.findUnique({
        where: { id: parseInt(vaultId, 10) },
        include: { subContainers: true },
      });
      if (!vault) throw new Error("Vault not found");

      const countedDec = roundMoney(actualCountedAmount);
      const bookDec = roundMoney(vault.currentBalance);
      const discrepancyDec = subMoney(countedDec, bookDec);

      const now = new Date();
      const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const selfParty = await tx.party.findFirst({ where: { partyType: "SELF" } });

      // 1. Create VaultCheckpoint Record
      const checkpoint = await tx.vaultCheckpoint.create({
        data: {
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

      // 2. Save Denominations or Sub-containers if provided
      if (denominations && denominations.length > 0) {
        for (const d of denominations) {
          const uVal = toDecimal(d.unitValue);
          const qty = parseInt(d.quantity, 10) || 0;
          const sub = uVal.times(qty);

          await tx.checkpointDenomination.create({
            data: {
              checkpointId: checkpoint.id,
              itemType: d.itemType || "COIN_PIECE",
              label: d.label || `Pecahan ${d.unitValue}`,
              unitValue: uVal,
              quantity: qty,
              subtotal: sub,
            },
          });
        }
      }

      if (subContainers && subContainers.length > 0) {
        for (const sc of subContainers) {
          await tx.vaultSubContainer.upsert({
            where: { vaultId_code: { vaultId: vault.id, code: sc.code } },
            update: { lastCountedBalance: roundMoney(sc.balance) },
            create: {
              vaultId: vault.id,
              code: sc.code,
              name: sc.name || `Dompet ${sc.code}`,
              lastCountedBalance: roundMoney(sc.balance),
            },
          });
        }
      }

      // 3. Auto-Reconciliation Transaction if there is a discrepancy
      if (discrepancyDec.lessThan(0)) {
        const lostCategory = await tx.category.findUnique({ where: { code: "EXP_CASH_LOST" } });
        const absDiff = discrepancyDec.abs();

        const reconTx = await tx.transaction.create({
          data: {
            transactionDate: now,
            transactionTime: timeStr,
            monthTag,
            title: `Selisih Kurang (Belum Tercatat) - ${vault.name}`,
            nature: "RECONCILIATION_LOST",
            categoryId: lostCategory ? lostCategory.id : null,
            commitmentType: "NONE",
            priorityTier: "NONE",
            partyId: selfParty.id,
            linkedCheckpointId: checkpoint.id,
            grossAmount: absDiff,
            consumeAmount: toDecimal(0),
            incomeAmount: toDecimal(0),
            notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
          },
        });

        await tx.transactionLeg.create({
          data: {
            transactionId: reconTx.id,
            vaultId: vault.id,
            legRole: "PRIMARY",
            debitIn: toDecimal(0),
            creditOut: absDiff,
            netMutation: absDiff.negated(),
            runningVaultBalance: countedDec,
            runningTotalWealth: countedDec, // Recomputed accurately below
          },
        });
      } else if (discrepancyDec.greaterThan(0)) {
        const surplusCategory = await tx.category.findUnique({ where: { code: "INC_RECON_SURPLUS" } });

        const reconTx = await tx.transaction.create({
          data: {
            transactionDate: now,
            transactionTime: timeStr,
            monthTag,
            title: `Bunga Bank / Selisih Lebih - ${vault.name}`,
            nature: "RECONCILIATION_FOUND",
            categoryId: surplusCategory ? surplusCategory.id : null,
            commitmentType: "NONE",
            priorityTier: "NONE",
            partyId: selfParty.id,
            linkedCheckpointId: checkpoint.id,
            grossAmount: discrepancyDec,
            consumeAmount: toDecimal(0),
            incomeAmount: discrepancyDec,
            notes: `Auto-recorded during checkpoint #${checkpoint.id}`,
          },
        });

        await tx.transactionLeg.create({
          data: {
            transactionId: reconTx.id,
            vaultId: vault.id,
            legRole: "PRIMARY",
            debitIn: discrepancyDec,
            creditOut: toDecimal(0),
            netMutation: discrepancyDec,
            runningVaultBalance: countedDec,
            runningTotalWealth: countedDec, // Recomputed accurately below
          },
        });
      }

      // 4. Update Vault's live balance and recalculate aggregate total wealth snapshots
      await tx.vault.update({
        where: { id: vault.id },
        data: { currentBalance: countedDec },
      });

      await recalculateLedgerRunningBalances(tx);

      return checkpoint;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/reconcile:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reconcile vault" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const [checkpoints, vaults] = await Promise.all([
      prisma.vaultCheckpoint.findMany({
        include: {
          vault: true,
          denominations: true,
          linkedTransactions: true,
        },
        orderBy: { checkpointTimestamp: "desc" },
        take: 30,
      }),
      prisma.vault.findMany({
        where: { isActive: true },
        include: { subContainers: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        checkpoints,
        vaults,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/reconcile:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch checkpoints" },
      { status: 500 }
    );
  }
}
