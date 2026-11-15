// API Route: PATCH /api/admin/users/[id]
// Handles Admin account status toggling, password reset, and basic metadata updates

import { withApiHandler } from "@/server/http/apiHandler";
import { updateManagedUserAccount } from "@/server/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(
  async ({ request, params, user: adminUser }) => {
    const body = await request.json().catch(() => ({}));
    return await updateManagedUserAccount({
      adminUser,
      targetUserId: params?.id,
      payload: body,
    });
  },
  { auth: "ADMIN" }
);
