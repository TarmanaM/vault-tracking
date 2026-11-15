// API Route: GET & POST /api/vaults
// Lists active vaults with sub-vault FX valuations and creates new vaults + optional sub-vaults

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listEnrichedUserVaults,
  createVaultWithSubVaults,
} from "@/server/modules/vaults/vaults.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await listEnrichedUserVaults(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createVaultWithSubVaults(user, body);
});
