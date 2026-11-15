// API Route: GET /api/debts
// Returns separate receivables and payables plus open entries per party

import { withApiHandler } from "@/server/http/apiHandler";
import { getUserDebtOverview } from "@/server/modules/debts/debts.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await getUserDebtOverview(user.id);
  },
  { errorStatus: 500 }
);
