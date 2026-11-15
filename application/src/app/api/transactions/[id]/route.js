// API Route: GET & DELETE /api/transactions/[id]
// Fetches single transaction details or reverses a transaction atomically

import { withApiHandler } from "@/server/http/apiHandler";
import {
  getUserTransactionById,
  reverseUserTransactionById,
} from "@/server/modules/transactions/transactions.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ params, user }) => getUserTransactionById(user.id, params?.id),
  { auth: "USER" }
);

export const DELETE = withApiHandler(
  async ({ params, user }) => reverseUserTransactionById(user.id, params?.id),
  { auth: "USER" }
);
