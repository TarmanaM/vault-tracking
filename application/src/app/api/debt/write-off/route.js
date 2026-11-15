// API Route: POST /api/debt/write-off
// Handles full or manual partial debt forgiveness / write-off conversion to charity or expense

import { withApiHandler } from "@/server/http/apiHandler";
import { executeDebtWriteOff } from "@/server/modules/debts/debts.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await executeDebtWriteOff(user.id, body);
});
