// User Onboarding Interview & Default Preset Generator for Vault Tracking v2.0
// Runs atomically when a new user completes or skips setup, or customizes modules in Settings

import prisma from "./prisma.js";
import { toDecimal, roundMoney } from "./money.js";
import {
  SKIP_PRESET_MODULES,
  STARTER_VAULT_TEMPLATES,
  ensureMasterTemplatesSeeded,
} from "./masterCatalog.js";
import { recalculateLedgerRunningBalances } from "./ledgerService.js";

/**
 * Normalize starter vault configuration coming from onboarding interview or skip default
 */
function buildSelectedStarterVaults(mode, rawStarterVaults = []) {
  const tplMap = Object.fromEntries(STARTER_VAULT_TEMPLATES.map((t) => [t.key, t]));

  if (mode === "SKIP" || !Array.isArray(rawStarterVaults) || rawStarterVaults.length === 0) {
    // Skip default preset: ready-to-use Cash Wallet + Main Bank so user can transact immediately
    return ["CASH", "BANK"].map((key, idx) => {
      const tpl = tplMap[key];
      return {
        ...tpl,
        customName: tpl.defaultName,
        openingBalance: 0,
        sortOrder: idx + 1,
      };
    });
  }

  const normalized = [];
  const seenKeys = new Set();
  for (const item of rawStarterVaults) {
    if (!item || item.enabled === false) continue;
    const key = String(item.key || "").toUpperCase();
    const tpl = tplMap[key];
    if (!tpl || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const parsedBal = Number(item.openingBalance || 0);
    normalized.push({
      ...tpl,
      customName: String(item.customName || tpl.defaultName).trim().slice(0, 50) || tpl.defaultName,
      openingBalance: Number.isFinite(parsedBal) && parsedBal > 0 ? parsedBal : 0,
      sortOrder: normalized.length + 1,
    });
  }

  // Always guarantee at least 1 starter vault exists so the user is never blocked
  if (normalized.length === 0) {
    const cashTpl = tplMap.CASH;
    normalized.push({
      ...cashTpl,
      customName: cashTpl.defaultName,
      openingBalance: 0,
      sortOrder: 1,
    });
  }

  return normalized;
}

/**
 * Apply personalized onboarding modules, currency, starter vaults, categories, and sample cards
 */
export async function applyUserOnboarding(userId, payload = {}) {
  const mode = String(payload.mode || "INTERVIEW").toUpperCase() === "SKIP" ? "SKIP" : "INTERVIEW";
  const baseCurrency =
    mode === "SKIP"
      ? "IDR"
      : String(payload.baseCurrency || "IDR").trim().toUpperCase() || "IDR";

  const selectedModuleSet = new Set(["CORE_SYSTEM", "CORE_ESSENTIAL"]);
  if (mode === "SKIP") {
    for (const m of SKIP_PRESET_MODULES) selectedModuleSet.add(m);
  } else if (Array.isArray(payload.modules)) {
    for (const m of payload.modules) {
      const upper = String(m || "").trim().toUpperCase();
      if (upper) selectedModuleSet.add(upper);
    }
  } else if (payload.modules && typeof payload.modules === "object") {
    for (const [mKey, enabled] of Object.entries(payload.modules)) {
      if (enabled) selectedModuleSet.add(String(mKey).trim().toUpperCase());
    }
  }

  const starterVaults = buildSelectedStarterVaults(mode, payload.starterVaults);

  await ensureMasterTemplatesSeeded(prisma);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new Error("Active user account not found");
    }

    // 1. Initialize or update per-user AppSetting
    await tx.appSetting.upsert({
      where: { userId },
      update: { baseCurrency },
      create: {
        userId,
        baseCurrency,
        fxSyncIntervalDays: 3,
      },
    });

    // 2. Ensure user's own SELF party exists cleanly
    const selfParty = await tx.party.upsert({
      where: { userId_code: { userId, code: "SELF" } },
      update: { name: user.fullName || user.username, isActive: true },
      create: {
        userId,
        code: "SELF",
        name: user.fullName || user.username,
        partyType: "SELF",
        isDebtContact: false,
        aliasesJson: JSON.stringify(["Me", "Self"]),
      },
    });

    // 3. Instantiate selected MasterCategoryTemplate rows into user's Categories
    const masterTemplates = await tx.masterCategoryTemplate.findMany({
      where: { moduleKey: { in: Array.from(selectedModuleSet) } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    const templateCodes = masterTemplates.map((tpl) => tpl.code);
    if (templateCodes.length > 0) {
      await tx.category.updateMany({
        where: {
          userId,
          code: { in: templateCodes },
          isActive: false,
        },
        data: { isActive: true },
      });

      await tx.category.createMany({
        data: masterTemplates.map((tpl) => ({
          userId,
          code: tpl.code,
          templateCode: tpl.code,
          name: tpl.name,
          defaultNature: tpl.defaultNature,
          commitmentType: tpl.commitmentType,
          priorityTier: tpl.priorityTier,
          countsAsConsume: tpl.countsAsConsume,
          coaCode: tpl.coaCode,
          iconName: tpl.iconName,
          colorHex: tpl.colorHex,
          isSystemLocked: tpl.isSystemLocked,
          sortOrder: tpl.sortOrder,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    const instantiatedCategories =
      templateCodes.length > 0
        ? await tx.category.findMany({
            where: { userId, code: { in: templateCodes } },
          })
        : [];
    const categoryByCode = Object.fromEntries(
      instantiatedCategories.map((cat) => [cat.code, cat])
    );

    // 4. Instantiate starter Vaults idempotently & record Opening Balance if requested
    const createdVaultsByCode = {};
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const monthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;
    const initialCategory = categoryByCode["TX_INITIAL_FUND"] || null;
    let recordedOpeningFund = false;

    for (const sv of starterVaults) {
      let vault = await tx.vault.findUnique({
        where: { userId_code: { userId, code: sv.code } },
        include: { subContainers: true },
      });

      if (!vault) {
        vault = await tx.vault.create({
          data: {
            userId,
            code: sv.code,
            name: sv.customName,
            vaultType: sv.vaultType,
            colorHex: sv.colorHex,
            hasSubContainers: Boolean(sv.hasSubContainers),
            hasDenominations: Boolean(sv.hasDenominations),
            sortOrder: sv.sortOrder,
            isActive: true,
          },
          include: { subContainers: true },
        });

        // Create default sub-containers (e.g., Cash Wallet primary pocket)
        if (Array.isArray(sv.subContainers) && sv.subContainers.length > 0) {
          for (let i = 0; i < sv.subContainers.length; i++) {
            const sc = sv.subContainers[i];
            const createdSub = await tx.vaultSubContainer.create({
              data: {
                vaultId: vault.id,
                code: sc.code,
                name: sc.name,
                currency: baseCurrency,
                isDefault: Boolean(sc.isDefault),
                sortOrder: i + 1,
              },
            });
            vault.subContainers.push(createdSub);
          }
        }
      }

      createdVaultsByCode[vault.code] = vault;

      // Record opening balance ONLY on clean zero-transaction vaults
      if (sv.openingBalance > 0) {
        const existingLegCount = await tx.transactionLeg.count({
          where: { userId, vaultId: vault.id },
        });
        if (existingLegCount === 0) {
          const openDec = roundMoney(toDecimal(sv.openingBalance));
          const isLiability = sv.vaultType === "LIABILITY_CREDIT_LINE";
          const signedBal = isLiability ? openDec.negated() : openDec;
          const defaultSub = vault.subContainers?.find((s) => s.isDefault) || vault.subContainers?.[0] || null;

          const cp = await tx.vaultCheckpoint.create({
            data: {
              userId,
              vaultId: vault.id,
              checkpointTimestamp: now,
              checkpointDate: now,
              periodLabel: "Initial Setup",
              checkpointType: "INITIAL_FUND",
              originalCountedAmount: roundMoney(signedBal),
              effectiveAnchorAmount: roundMoney(signedBal),
              systemBookBalanceBefore: toDecimal(0),
              notes: "Initial balance set during onboarding",
            },
          });

          const initTx = await tx.transaction.create({
            data: {
              userId,
              transactionDate: now,
              transactionTime: timeStr,
              monthTag,
              title: `Opening Balance - ${vault.name}`,
              nature: isLiability ? "PAYABLE_BORROW" : "INITIAL_FUND",
              categoryId: isLiability ? null : initialCategory?.id || null,
              commitmentType: "NONE",
              priorityTier: "NONE",
              partyId: selfParty.id,
              currency: baseCurrency,
              fxRateApplied: toDecimal(1),
              grossAmount: openDec,
              consumeAmount: toDecimal(0),
              incomeAmount: toDecimal(0),
              linkedCheckpointId: cp.id,
              notes: "Created during workspace onboarding",
            },
          });

          await tx.transactionLeg.create({
            data: {
              userId,
              transactionId: initTx.id,
              vaultId: vault.id,
              subContainerId: defaultSub?.id || null,
              legRole: "PRIMARY",
              currency: baseCurrency,
              fxRateApplied: toDecimal(1),
              originalMutation: roundMoney(signedBal),
              debitIn: signedBal.greaterThan(0) ? openDec : toDecimal(0),
              creditOut: signedBal.lessThan(0) ? openDec : toDecimal(0),
              netMutation: roundMoney(signedBal),
              runningVaultBalance: roundMoney(signedBal),
              runningTotalWealth: roundMoney(signedBal),
            },
          });

          await tx.vault.update({
            where: { id: vault.id },
            data: { currentBalance: roundMoney(signedBal) },
          });

          if (defaultSub) {
            await tx.vaultSubContainer.update({
              where: { id: defaultSub.id },
              data: {
                currentBalance: roundMoney(signedBal),
                lastCountedBalance: roundMoney(signedBal),
                isSynced: true,
              },
            });
          }

          recordedOpeningFund = true;
        }
      }
    }

    if (recordedOpeningFund) {
      await recalculateLedgerRunningBalances(tx, userId);
    }

    // 5. Generate neutral starter Action Cards when user currently has zero cards
    const existingCardCount = await tx.actionCard.count({ where: { userId } });
    if (existingCardCount === 0) {
      const vaultList = Object.values(createdVaultsByCode);
      const primaryCash = createdVaultsByCode["CASH"] || vaultList[0];
      const primaryBank = createdVaultsByCode["MAIN_BANK"] || vaultList[0];
      const bankDefaultSub =
        primaryBank?.subContainers?.find((s) => s.isDefault) || primaryBank?.subContainers?.[0] || null;
      const cashDefaultSub =
        primaryCash?.subContainers?.find((s) => s.isDefault) || primaryCash?.subContainers?.[0] || null;

      const starterCards = [];

      if (categoryByCode["EXP_MAIN_MEAL"] && primaryCash) {
        starterCards.push({
          title: "Daily Meal",
          cardActionType: "EXPENSE",
          defaultVaultId: primaryCash.id,
          defaultSubContainerId: cashDefaultSub?.id || null,
          defaultCategoryId: categoryByCode["EXP_MAIN_MEAL"].id,
          defaultPartyId: selfParty.id,
          expectedCadence: "DAILY_ANY",
          pinPriority: 9,
        });
      }

      if (categoryByCode["EXP_FUEL"] && primaryCash) {
        starterCards.push({
          title: "Fuel Refill",
          cardActionType: "EXPENSE",
          defaultVaultId: primaryCash.id,
          defaultSubContainerId: cashDefaultSub?.id || null,
          defaultCategoryId: categoryByCode["EXP_FUEL"].id,
          defaultPartyId: selfParty.id,
          expectedCadence: "WEEKLY",
          pinPriority: 8,
        });
      } else if (categoryByCode["EXP_COFFEE"] && primaryBank) {
        starterCards.push({
          title: "Morning Coffee",
          cardActionType: "EXPENSE",
          defaultVaultId: primaryBank.id,
          defaultSubContainerId: bankDefaultSub?.id || null,
          defaultCategoryId: categoryByCode["EXP_COFFEE"].id,
          defaultPartyId: selfParty.id,
          expectedCadence: "DAILY_ANY",
          pinPriority: 8,
        });
      }

      if (categoryByCode["INC_SALARY"] && primaryBank) {
        starterCards.push({
          title: "Monthly Salary",
          cardActionType: "INCOME",
          defaultVaultId: primaryBank.id,
          defaultSubContainerId: bankDefaultSub?.id || null,
          defaultCategoryId: categoryByCode["INC_SALARY"].id,
          defaultPartyId: selfParty.id,
          expectedCadence: "MONTHLY",
          pinPriority: 5,
        });
      }

      for (const cardData of starterCards) {
        const createdCard = await tx.actionCard.create({
          data: {
            userId,
            title: cardData.title,
            cardActionType: cardData.cardActionType,
            defaultVaultId: cardData.defaultVaultId,
            defaultSubContainerId: cardData.defaultSubContainerId,
            defaultCategoryId: cardData.defaultCategoryId,
            defaultPartyId: cardData.defaultPartyId,
            expectedCadence: cardData.expectedCadence,
            pinPriority: cardData.pinPriority,
            oneTapSubmit: false,
            visibilityMode: "ACTIVE",
            isActive: true,
          },
        });

        await tx.cardHabitStats.create({
          data: {
            cardId: createdCard.id,
            totalUses: 0,
            hourCountsJson: "[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]",
            dowCountsJson: "[0,0,0,0,0,0,0]",
          },
        });
      }
    }

    // 6. Persist onboarding completion & personalization snapshot on User
    const profileSnapshot = {
      mode,
      baseCurrency,
      modules: Array.from(selectedModuleSet),
      starterVaultCodes: starterVaults.map((v) => v.code),
      updatedAt: now.toISOString(),
    };

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        onboardingSkipped: mode === "SKIP",
        onboardingProfileJson: JSON.stringify(profileSnapshot),
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        onboardingCompleted: true,
        onboardingSkipped: true,
        onboardingProfileJson: true,
      },
    });

    return {
      user: updatedUser,
      baseCurrency,
      modules: Array.from(selectedModuleSet),
      categoryCount: masterTemplates.length,
      vaultCount: Object.keys(createdVaultsByCode).length,
    };
  });
}
