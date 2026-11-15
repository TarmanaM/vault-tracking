// Category management service: template activation, custom creation, Spending Layer updates, and safe archive/delete
import "server-only";
import crypto from "node:crypto";
import prisma from "@/server/db/prisma";
import {
  SPENDING_LAYERS,
  getSpendingLayerMeta,
  deriveSilentAccountingFields,
  ensureMasterTemplatesSeeded,
} from "@/lib/masterCatalog";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import {
  findUserCategoriesWithCounts,
  findAllMasterTemplates,
  findMasterTemplateByCode,
  upsertUserCategoryFromTemplate,
  createCustomUserCategory,
  findUserCategoryById,
  updateCategoryById,
  deleteCategoryById,
} from "./categories.repository.js";

const ALLOWED_CUSTOM_NATURES = new Set(["EXPENSE", "INCOME"]);
const ALLOWED_EXPENSE_LAYERS = new Set([
  "FIXED_MANDATORY",
  "VARIABLE_ESSENTIAL",
  "DISCRETIONARY_JAJAN",
  "SOCIAL_CHARITY",
]);

export async function listUserCategoriesAndTemplates(userId) {
  await ensureMasterTemplatesSeeded(prisma);

  const [categories, templates] = await Promise.all([
    findUserCategoriesWithCounts(userId),
    findAllMasterTemplates(),
  ]);

  const installedCodes = new Set(categories.map((c) => c.templateCode || c.code));
  const availableTemplates = templates.filter((t) => !installedCodes.has(t.code));

  const enriched = categories.map((cat) => ({
    ...cat,
    spendingLayerMeta: getSpendingLayerMeta(cat.commitmentType),
  }));

  return {
    categories: enriched,
    availableTemplates,
    spendingLayers: SPENDING_LAYERS,
  };
}

export async function createOrEnableUserCategory(userId, body = {}) {
  if (body.templateCode) {
    const tpl = await findMasterTemplateByCode(body.templateCode);
    if (!tpl) {
      throw new NotFoundError("Master category template not found");
    }

    const category = await upsertUserCategoryFromTemplate(userId, tpl);
    return {
      ...category,
      spendingLayerMeta: getSpendingLayerMeta(category.commitmentType),
    };
  }

  const name = String(body.name || "").trim();
  if (!name || name.length < 2) {
    throw new BadRequestError("Category name must be at least 2 characters");
  }

  const defaultNature = String(body.defaultNature || "EXPENSE").toUpperCase();
  if (!ALLOWED_CUSTOM_NATURES.has(defaultNature)) {
    throw new BadRequestError("Custom categories support EXPENSE or INCOME types");
  }

  const requestedLayer = String(body.commitmentType || "VARIABLE_ESSENTIAL").toUpperCase();
  if (defaultNature === "EXPENSE" && !ALLOWED_EXPENSE_LAYERS.has(requestedLayer)) {
    throw new BadRequestError("Invalid Spending Layer selected for expense category");
  }

  const derived = deriveSilentAccountingFields(defaultNature, requestedLayer);
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "CUSTOM";
  const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const code = `USR_${slug}_${uniqueSuffix}`;

  const category = await createCustomUserCategory({
    userId: Number(userId),
    code,
    name,
    defaultNature,
    commitmentType: derived.commitmentType,
    priorityTier: derived.priorityTier,
    countsAsConsume: derived.countsAsConsume,
    coaCode: derived.coaCode,
    iconName: body.iconName
      ? String(body.iconName).trim()
      : defaultNature === "INCOME"
        ? "Payments"
        : "Category",
    colorHex: body.colorHex
      ? String(body.colorHex).trim()
      : getSpendingLayerMeta(derived.commitmentType).colorHex,
    isSystemLocked: false,
    sortOrder: 100,
    isActive: true,
  });

  return {
    ...category,
    spendingLayerMeta: getSpendingLayerMeta(category.commitmentType),
  };
}

export async function updateUserCategory(userId, rawCategoryId, body = {}) {
  const categoryId = parseInt(rawCategoryId, 10);
  if (!categoryId || Number.isNaN(categoryId)) {
    throw new BadRequestError("Invalid category ID");
  }

  const existing = await findUserCategoryById(categoryId, userId);
  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  const updateData = {};

  if (body.name !== undefined) {
    const nextName = String(body.name || "").trim();
    if (nextName.length < 2) {
      throw new BadRequestError("Category name must be at least 2 characters");
    }
    updateData.name = nextName;
  }

  if (body.iconName !== undefined) {
    updateData.iconName = body.iconName ? String(body.iconName).trim() : null;
  }

  if (body.colorHex !== undefined) {
    updateData.colorHex = body.colorHex ? String(body.colorHex).trim() : null;
  }

  if (
    body.commitmentType !== undefined &&
    existing.defaultNature === "EXPENSE" &&
    !existing.isSystemLocked
  ) {
    const nextLayer = String(body.commitmentType).toUpperCase();
    if (!ALLOWED_EXPENSE_LAYERS.has(nextLayer)) {
      throw new BadRequestError("Invalid Spending Layer");
    }
    const derived = deriveSilentAccountingFields("EXPENSE", nextLayer);
    updateData.commitmentType = derived.commitmentType;
    updateData.priorityTier = derived.priorityTier;
    if (!existing.templateCode) {
      updateData.coaCode = derived.coaCode;
    }
  }

  if (body.isActive !== undefined) {
    if (existing.isSystemLocked && body.isActive === false) {
      throw new BadRequestError("Core system categories cannot be disabled");
    }
    updateData.isActive = Boolean(body.isActive);
  }

  const updated = await updateCategoryById(existing.id, updateData);
  return {
    ...updated,
    spendingLayerMeta: getSpendingLayerMeta(updated.commitmentType),
  };
}

export async function deleteOrArchiveUserCategory(userId, rawCategoryId) {
  const categoryId = parseInt(rawCategoryId, 10);
  if (!categoryId || Number.isNaN(categoryId)) {
    throw new BadRequestError("Invalid category ID");
  }

  const existing = await findUserCategoryById(categoryId, userId, true);
  if (!existing) {
    throw new NotFoundError("Category not found");
  }
  if (existing.isSystemLocked) {
    throw new BadRequestError("Core system categories cannot be deleted");
  }

  const refCount =
    (existing._count?.transactions || 0) + (existing._count?.actionCards || 0);
  if (refCount > 0) {
    const archived = await updateCategoryById(existing.id, { isActive: false });
    return {
      action: "ARCHIVED",
      archivedOnly: true,
      message: "Category is linked to existing records and was archived instead.",
      category: archived,
    };
  }

  await deleteCategoryById(existing.id);
  return {
    action: "DELETED",
    archivedOnly: false,
  };
}
