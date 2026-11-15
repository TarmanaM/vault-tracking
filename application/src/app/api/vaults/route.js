// API Route: GET & POST /api/vaults
// Lists active vaults with sub-vault FX valuations and creates new vaults + optional sub-vaults (#3, #5, #7)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDecimal, roundMoney } from "@/lib/money";
import { getOrCreateAppSettings, getCachedRateMap } from "@/lib/fxService";
import {
  computeVaultPartitionSummary,
  ensureDefaultSubContainer,
  evaluateBasePartitionState,
} from "@/lib/subVaultService";
import { recalculateLedgerRunningBalances } from "@/lib/ledgerService";
import { sortVaultsByBalanceDesc } from "@/lib/vaultHelpers";

export const dynamic = "force-dynamic";

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

export async function GET(request) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const settings = await getOrCreateAppSettings(user.id);
    const [rateMap, rawVaults] = await Promise.all([
      getCachedRateMap(settings.baseCurrency),
      prisma.vault.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          subContainers: {
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const enriched = rawVaults.map((v) => ({
      ...v,
      partitionSummary: computeVaultPartitionSummary(v, settings.baseCurrency, rateMap),
      totalEstimatedBase: computeVaultPartitionSummary(v, settings.baseCurrency, rateMap).totalEstimatedBase,
    }));

    return NextResponse.json({
      success: true,
      data: {
        vaults: sortVaultsByBalanceDesc(enriched),
        baseCurrency: settings.baseCurrency,
        rateMap,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch vaults" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
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

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Vault name is required" }, { status: 400 });
    }
    if (!ALLOWED_VAULT_TYPES.has(vaultType)) {
      return NextResponse.json({ success: false, error: "Invalid vault type" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
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
          name: name.trim(),
          vaultType,
          currentBalance: toDecimal(0),
          hasSubContainers: validSubsInput.length > 0,
          hasDenominations: Boolean(hasDenominations) || vaultType === "PHYSICAL_COIN",
          symbolMode: ["INITIALS", "ICON", "IMAGE"].includes(symbolMode) ? symbolMode : "INITIALS",
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
          const isSynced = isForeign ? !initSubBal.isZero() || Boolean(item.isSynced) : Boolean(item.isSynced);

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

      // Record an INITIAL_FUND ledger entry when starting base balance > 0 so wealth timeline matches
      if (!initialDec.isZero()) {
        const now = new Date();
        const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        let selfParty = await tx.party.findFirst({ where: { userId: user.id, partyType: "SELF" } });
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
          const targetSub = await tx.vaultSubContainer.findUnique({ where: { id: defaultBaseSubId } });
          if (targetSub && toDecimal(targetSub.currentBalance).isZero() && !targetSub.isSynced) {
            // Keep unsynced pool clean; only evaluate partitions
            await evaluateBasePartitionState(tx, createdVault.id, baseCurrency);
          }
        }

        await recalculateLedgerRunningBalances(tx, user.id);
      }

      return await tx.vault.findUnique({
        where: { id: createdVault.id },
        include: {
          subContainers: {
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          },
        },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in POST /api/vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create vault" },
      { status: 400 }
    );
  }
}
