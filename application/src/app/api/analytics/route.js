// API Route: GET /api/analytics
// Returns Wealth Journey (#5), Cashflow Waterfall (#4), Consumption (#1, #2), and Entity Drilldowns

import { withApiHandler } from "@/server/http/apiHandler";
import { BadRequestError } from "@/server/http/errors";
import { getWealthJourneyAnalytics } from "@/server/modules/analytics/analyticsWealth.service";
import { getDrilldownAnalytics } from "@/server/modules/analytics/analyticsDrilldown.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request, user }) => {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("type");
    const targetId = searchParams.get("id");
    const preset = searchParams.get("preset") || "3M";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!targetType) {
      throw new BadRequestError("type parameter is required");
    }

    if (targetType === "WEALTH_JOURNEY") {
      return getWealthJourneyAnalytics(user.id, { preset, startDateParam, endDateParam });
    }

    return getDrilldownAnalytics(user.id, targetType, targetId);
  },
  { auth: "USER" }
);
