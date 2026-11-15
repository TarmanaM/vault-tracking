// API Route: POST /api/debt/offset
// Handles manual two-way debt merge / offset between Receivables and Payables

import { withApiHandler } from "@/server/http/apiHandler";
import { executePartyDebtOffset } from "@/server/modules/debts/debts.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await executePartyDebtOffset(user.id, body);
});
