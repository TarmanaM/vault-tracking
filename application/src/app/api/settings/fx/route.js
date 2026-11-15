// API Route: GET & PATCH /api/settings/fx
// Manages base currency, Frankfurter v2 auto-sync interval, and manual FX overrides

import { withApiHandler } from "@/server/http/apiHandler";
import {
  getUserFxSettingsPayload,
  updateUserFxSettingsPayload,
} from "@/server/modules/fx/fx.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => getUserFxSettingsPayload(user.id),
  { auth: "USER" }
);

export const PATCH = withApiHandler(
  async ({ request, user }) => {
    const body = await request.json().catch(() => ({}));
    return updateUserFxSettingsPayload(user.id, body);
  },
  { auth: "USER" }
);
