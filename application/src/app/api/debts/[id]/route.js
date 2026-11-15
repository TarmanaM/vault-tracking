// API Route: GET /api/debts/[id]
// Returns full debt & transaction breakdown for a specific Party

import { withApiHandler } from "@/server/http/apiHandler";
import { getPartyDebtDetail } from "@/server/modules/debts/debts.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ params, user }) => {
    return await getPartyDebtDetail(user.id, params?.id);
  },
  { errorStatus: 500 }
);
