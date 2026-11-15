// API Route: PATCH & DELETE /api/vaults/[id]
// Updates Vault profile or soft-archives Vault

import { withApiHandler } from "@/server/http/apiHandler";
import {
  updateUserVaultProfile,
  archiveUserVault,
} from "@/server/modules/vaults/vaults.service";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(async ({ request, params, user }) => {
  const body = await request.json().catch(() => ({}));
  return await updateUserVaultProfile(user.id, params?.id, body);
});

export const DELETE = withApiHandler(async ({ params, user }) => {
  return await archiveUserVault(user.id, params?.id);
});
