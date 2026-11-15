// Prisma repository for User authentication & session queries
import "server-only";
import prisma from "@/server/db/prisma";

export const SAFE_USER_SELECT = {
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

export async function findSafeUserById(userId) {
  return await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: SAFE_USER_SELECT,
  });
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

export async function updateUserPasswordById(userId, passwordHash) {
  return await prisma.user.update({
    where: { id: Number(userId) },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
    select: SAFE_USER_SELECT,
  });
}
