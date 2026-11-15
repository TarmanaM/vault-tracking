// Server-only Prisma Client singleton for PostgreSQL / Neon serverless pooling
import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const transactionMaxWait =
  Number(process.env.PRISMA_TRANSACTION_MAX_WAIT) || 10000;
const transactionTimeout =
  Number(process.env.PRISMA_TRANSACTION_TIMEOUT) || 25000;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    transactionOptions: {
      // Allow enough wait/execution headroom for remote serverless PostgreSQL (e.g., Neon)
      maxWait: transactionMaxWait,
      timeout: transactionTimeout,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
