// Prisma repository for user-owned Vaults and VaultSubContainers
import "server-only";
import prisma from "@/server/db/prisma";

export async function findActiveUserVaultsWithSubContainers(userId) {
  return await prisma.vault.findMany({
    where: { userId: Number(userId), isActive: true },
    include: {
      subContainers: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findUserVaultById(vaultId, userId, tx = prisma) {
  return await tx.vault.findFirst({
    where: { id: Number(vaultId), userId: Number(userId) },
    include: {
      subContainers: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
}

export async function countActiveUserVaults(userId, tx = prisma) {
  return await tx.vault.count({
    where: { userId: Number(userId), isActive: true },
  });
}

export async function updateVaultById(vaultId, data, tx = prisma) {
  return await tx.vault.update({
    where: { id: Number(vaultId) },
    data,
    include: {
      subContainers: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
}
