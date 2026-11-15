// API Route: POST, PATCH & DELETE /api/vaults/[id]/sub-vaults
// Manages dynamic sub-vault pockets, default routing, foreign currencies, and non-mutating Sync Split

import { withApiHandler } from "@/server/http/apiHandler";
import {
  createSubVaultPocket,
  updateOrSyncSubVaults,
  deleteSubVaultPocket,
} from "@/server/modules/vaults/vaults.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, params, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createSubVaultPocket(user.id, params?.id, body);
});

export const PATCH = withApiHandler(async ({ request, params, user }) => {
  const body = await request.json().catch(() => ({}));
  return await updateOrSyncSubVaults(user.id, params?.id, body);
});

export const DELETE = withApiHandler(async ({ request, params, user }) => {
  const { searchParams } = new URL(request.url);
  return await deleteSubVaultPocket(user.id, params?.id, searchParams.get("subId"));
});
