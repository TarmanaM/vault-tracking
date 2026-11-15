// Prisma repository for user-owned Party contacts & counterparties
import "server-only";
import prisma from "@/server/db/prisma";

export async function findActiveUserParties(userId) {
  return await prisma.party.findMany({
    where: { userId: Number(userId), isActive: true },
    orderBy: { id: "asc" },
  });
}

export async function findUserPartyByCode(userId, code) {
  return await prisma.party.findUnique({
    where: { userId_code: { userId: Number(userId), code } },
  });
}

export async function createUserParty(data) {
  return await prisma.party.create({ data });
}
