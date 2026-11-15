// Prisma repository for user-scoped in-database binary MediaAsset storage (PostgreSQL bytea)
import "server-only";
import prisma from "@/server/db/prisma";

export async function createMediaAssetRecord({ userId, fileName, mimeType, byteSize, data }) {
  return await prisma.mediaAsset.create({
    data: {
      userId: Number(userId),
      fileName,
      mimeType,
      byteSize,
      data,
    },
    select: {
      id: true,
      userId: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      createdAt: true,
    },
  });
}

export async function findMediaAssetByIdForUser(assetId, userId) {
  return await prisma.mediaAsset.findFirst({
    where: {
      id: Number(assetId),
      userId: Number(userId),
    },
  });
}
