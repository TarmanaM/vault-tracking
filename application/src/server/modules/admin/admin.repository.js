// Prisma repository for Admin user lifecycle management (strictly metadata-only, zero ledger fields)
import "server-only";
import prisma from "@/server/db/prisma";
import { SAFE_USER_SELECT } from "@/server/modules/auth/auth.repository";

export const ADMIN_USER_LIST_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  onboardingCompleted: true,
  onboardingSkipped: true,
  createdAt: true,
  updatedAt: true,
};

export async function listAllUserAccountsMetadata() {
  return await prisma.user.findMany({
    select: ADMIN_USER_LIST_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function findUserAccountByUsername(username) {
  return await prisma.user.findUnique({
    where: { username },
    select: ADMIN_USER_LIST_SELECT,
  });
}

export async function findUserAccountById(userId) {
  return await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: ADMIN_USER_LIST_SELECT,
  });
}

export async function countOtherActiveAdmins(excludeUserId) {
  return await prisma.user.count({
    where: {
      id: { not: Number(excludeUserId) },
      role: "ADMIN",
      isActive: true,
    },
  });
}

export async function createProvisionedUserWithAppSettings({
  username,
  fullName,
  role,
  passwordHash,
}) {
  return await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        fullName,
        role,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        onboardingCompleted: false,
        onboardingSkipped: false,
      },
      select: SAFE_USER_SELECT,
    });

    await tx.appSetting.create({
      data: {
        userId: created.id,
        baseCurrency: "IDR",
        fxSyncIntervalDays: 3,
      },
    });

    return created;
  });
}

export async function updateUserAccountById(userId, data) {
  return await prisma.user.update({
    where: { id: Number(userId) },
    data,
    select: SAFE_USER_SELECT,
  });
}
