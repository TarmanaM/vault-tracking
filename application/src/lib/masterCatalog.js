// Master Catalog & Simplified Taxonomy Mapping Helpers for Vault Tracking v2.0
// Keeps user UI simple (Type -> Category -> 4 neutral Spending Layers) while preserving COA exports

import masterCatalog from "../../prisma/master-catalog.json";
import prisma from "./prisma.js";

export const SPENDING_LAYERS = masterCatalog.spendingLayers || [];
export const ONBOARDING_MODULES = masterCatalog.onboardingModules || [];
export const MASTER_CATEGORY_TEMPLATES = masterCatalog.categories || [];
export const STARTER_VAULT_TEMPLATES = masterCatalog.starterVaultTemplates || [];

export const SPENDING_LAYER_MAP = Object.fromEntries(
  SPENDING_LAYERS.map((layer) => [layer.key, layer])
);

export const SKIP_PRESET_MODULES = [
  "CORE_SYSTEM",
  "CORE_ESSENTIAL",
  "HOUSING_BILLS",
  "COFFEE_LIFESTYLE",
  "CHARITY_SOCIAL",
];

/**
 * Resolve friendly UI label and metadata for an internal commitmentType enum
 */
export function getSpendingLayerMeta(commitmentType = "NONE") {
  if (!commitmentType || commitmentType === "NONE") {
    return {
      key: "NONE",
      label: "Non-Spending",
      shortLabel: "System",
      priorityTier: "NONE",
      coaPrefix: "1",
      colorHex: "#64748B",
      description: "Transfers, income, opening balances, and principal debt repayments.",
    };
  }

  if (commitmentType === "RECONCILIATION_LOST") {
    return {
      key: "RECONCILIATION_LOST",
      label: "Cash Shortage",
      shortLabel: "Audit",
      priorityTier: "NONE",
      coaPrefix: "6",
      colorHex: "#DC2626",
      description: "Unexplained cash differences detected during vault audits.",
    };
  }

  return (
    SPENDING_LAYER_MAP[commitmentType] || {
      key: commitmentType,
      label: commitmentType.replace(/_/g, " "),
      shortLabel: commitmentType,
      priorityTier: "SEKUNDER",
      coaPrefix: "6",
      colorHex: "#64748B",
      description: "",
    }
  );
}

/**
 * Automatically derive silent accounting fields (priorityTier & default COA code)
 * from user-facing transaction nature + spending layer so users do not need accounting jargon.
 */
export function deriveSilentAccountingFields(defaultNature = "EXPENSE", commitmentType = "NONE") {
  const nature = String(defaultNature || "EXPENSE").toUpperCase();

  if (nature === "INCOME") {
    return {
      commitmentType: "NONE",
      priorityTier: "NONE",
      countsAsConsume: false,
      coaCode: "4209",
    };
  }

  if (nature !== "EXPENSE") {
    return {
      commitmentType: "NONE",
      priorityTier: "NONE",
      countsAsConsume: false,
      coaCode: "1100",
    };
  }

  switch (commitmentType) {
    case "FIXED_MANDATORY":
      return {
        commitmentType: "FIXED_MANDATORY",
        priorityTier: "PRIMER",
        countsAsConsume: true,
        coaCode: "5309",
      };
    case "VARIABLE_ESSENTIAL":
      return {
        commitmentType: "VARIABLE_ESSENTIAL",
        priorityTier: "PRIMER",
        countsAsConsume: true,
        coaCode: "5409",
      };
    case "SOCIAL_CHARITY":
      return {
        commitmentType: "SOCIAL_CHARITY",
        priorityTier: "SEKUNDER",
        countsAsConsume: true,
        coaCode: "6309",
      };
    case "DISCRETIONARY_JAJAN":
    default:
      return {
        commitmentType: "DISCRETIONARY_JAJAN",
        priorityTier: "TERSIER",
        countsAsConsume: true,
        coaCode: "6109",
      };
  }
}

/**
 * Ensure global MasterCategoryTemplate rows exist cleanly in PostgreSQL using a single batch insert
 */
export async function ensureMasterTemplatesSeeded(prismaClient = prisma) {
  const existingCount = await prismaClient.masterCategoryTemplate.count();
  if (existingCount >= MASTER_CATEGORY_TEMPLATES.length) {
    return;
  }

  await prismaClient.masterCategoryTemplate.createMany({
    data: MASTER_CATEGORY_TEMPLATES.map((tpl) => ({
      code: tpl.code,
      moduleKey: tpl.moduleKey,
      name: tpl.name,
      description: tpl.description || null,
      defaultNature: tpl.defaultNature,
      commitmentType: tpl.commitmentType,
      priorityTier: tpl.priorityTier,
      countsAsConsume: Boolean(tpl.countsAsConsume),
      coaCode: tpl.coaCode,
      iconName: tpl.iconName || null,
      colorHex: tpl.colorHex || null,
      isSystemLocked: Boolean(tpl.isSystemLocked),
      sortOrder: tpl.sortOrder || 0,
    })),
    skipDuplicates: true,
  });
}
