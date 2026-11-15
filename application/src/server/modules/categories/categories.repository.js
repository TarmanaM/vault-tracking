// Prisma repository for user-owned Categories and MasterCategoryTemplates
import "server-only";
import prisma from "@/server/db/prisma";

export async function findUserCategoriesWithCounts(userId) {
  return await prisma.category.findMany({
    where: { userId: Number(userId) },
    include: {
      _count: {
        select: { transactions: true, actionCards: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function findAllMasterTemplates() {
  return await prisma.masterCategoryTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function findMasterTemplateByCode(code) {
  return await prisma.masterCategoryTemplate.findUnique({
    where: { code: String(code || "").trim() },
  });
}

export async function upsertUserCategoryFromTemplate(userId, tpl) {
  return await prisma.category.upsert({
    where: { userId_code: { userId: Number(userId), code: tpl.code } },
    update: { isActive: true },
    create: {
      userId: Number(userId),
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
    },
  });
}

export async function createCustomUserCategory(data) {
  return await prisma.category.create({ data });
}

export async function findUserCategoryById(categoryId, userId, includeCounts = false) {
  return await prisma.category.findFirst({
    where: { id: Number(categoryId), userId: Number(userId) },
    ...(includeCounts
      ? {
          include: {
            _count: { select: { transactions: true, actionCards: true } },
          },
        }
      : {}),
  });
}

export async function updateCategoryById(categoryId, data) {
  return await prisma.category.update({
    where: { id: Number(categoryId) },
    data,
  });
}

export async function deleteCategoryById(categoryId) {
  return await prisma.category.delete({
    where: { id: Number(categoryId) },
  });
}
