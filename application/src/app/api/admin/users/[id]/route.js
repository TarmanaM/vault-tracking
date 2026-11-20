// API Route: PATCH & DELETE /api/admin/users/[id]
// Handles Admin account status toggling, password reset, metadata updates, and permanent account deletion

import { withApiHandler } from "@/server/http/apiHandler";
import {
  updateManagedUserAccount,
  deleteManagedUserAccount,
} from "@/server/modules/admin/admin.service";

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

export const DELETE = withApiHandler(
  async ({ request, params }) => {
    const body = await request.json().catch(() => ({}));
    return await deleteManagedUserAccount({
      targetUserId: params?.id,
      confirmUsername: body.confirmUsername,
    });
  },
  { auth: "ADMIN" }
);
