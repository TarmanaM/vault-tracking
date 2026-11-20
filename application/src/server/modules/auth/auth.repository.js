// Prisma repository for User authentication, session queries, and atomic account deletion
import "server-only";
import prisma from "@/server/db/prisma";
import { BadRequestError, NotFoundError } from "@/server/http/errors";

export const BASE_SAFE_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  onboardingCompleted: true,
  onboardingSkipped: true,
  onboardingProfileJson: true,
  createdAt: true,
  updatedAt: true,
};

export const SAFE_USER_SELECT = {
  ...BASE_SAFE_USER_SELECT,
  lastLoginAt: true,
};

export async function findSafeUserById(userId) {
  const uid = Number(userId);
  try {
    return await prisma.user.findUnique({
      where: { id: uid },
      select: SAFE_USER_SELECT,
    });
  } catch {
    return await prisma.user.findUnique({
      where: { id: uid },
      select: BASE_SAFE_USER_SELECT,
    });
  }
}

export async function findUserWithHashByUsername(username) {
  return await prisma.user.findUnique({
    where: { username: String(username || "").trim().toLowerCase() },
  });
}

export async function findUserWithHashById(userId) {
  return await prisma.user.findUnique({
    where: { id: Number(userId) },
  });
}

export async function recordUserLoginTimestamp(userId) {
  const now = new Date();
  try {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { lastLoginAt: now },
    });
  } catch {
    // Non-fatal fallback if lastLoginAt migration has not been applied yet
  }
  return now;
}

export async function updateUserPasswordById(userId, passwordHash) {
  const uid = Number(userId);
  try {
    return await prisma.user.update({
      where: { id: uid },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: SAFE_USER_SELECT,
    });
  } catch {
    return await prisma.user.update({
      where: { id: uid },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: BASE_SAFE_USER_SELECT,
    });
  }
}

/**
 * Permanently delete a user account and all of its isolated financial data inside an atomic transaction.
 * Enforces last-active-admin protection so the instance never loses administrator access.
 */
export async function deleteUserAccountCascadeInTx(userId) {
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    throw new BadRequestError("Invalid user ID");
  }

  return await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: uid },
      select: BASE_SAFE_USER_SELECT,
    });
    if (!target) {
      throw new NotFoundError("User account not found");
    }

    if (target.role === "ADMIN" && target.isActive) {
      const otherActiveAdmins = await tx.user.count({
        where: {
          id: { not: uid },
          role: "ADMIN",
          isActive: true,
        },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestError(
          "Cannot delete the last active ADMIN account. Promote another user to ADMIN first."
        );
      }
    }

    await tx.checkpointDenomination.deleteMany({
      where: { checkpoint: { userId: uid } },
    });
    await tx.transactionLeg.deleteMany({ where: { userId: uid } });
    await tx.debtLedgerEntry.deleteMany({ where: { userId: uid } });
    await tx.transaction.deleteMany({ where: { userId: uid } });
    await tx.vaultCheckpoint.deleteMany({ where: { userId: uid } });
    await tx.cardHabitStats.deleteMany({
      where: { card: { userId: uid } },
    });
    await tx.actionCard.deleteMany({ where: { userId: uid } });
    await tx.vaultSubContainer.deleteMany({
      where: { vault: { userId: uid } },
    });
    await tx.vault.deleteMany({ where: { userId: uid } });
    await tx.pendingReminder.deleteMany({ where: { userId: uid } });
    await tx.party.deleteMany({ where: { userId: uid } });
    await tx.category.deleteMany({ where: { userId: uid } });
    await tx.mediaAsset.deleteMany({ where: { userId: uid } });
    await tx.appSetting.deleteMany({ where: { userId: uid } });
    await tx.user.delete({ where: { id: uid } });

    return { deletedUserId: uid, username: target.username };
  });
}
