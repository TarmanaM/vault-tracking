// API Route: GET /api/dashboard
// Returns real-time aggregate wealth, vaults, habit-scored action cards, and latest checkpoints

import { withApiHandler } from "@/server/http/apiHandler";
import { getDashboardData } from "@/server/modules/dashboard/dashboard.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => getDashboardData(user.id),
  { auth: "USER" }
);
