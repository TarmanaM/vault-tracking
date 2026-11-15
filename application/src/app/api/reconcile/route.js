// API Route: GET & POST /api/reconcile
// Handles physical vault audit, coin denominations, sub-wallet counting, and auto-reconciliation

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listReconcileHistoryAndVaults,
  recordVaultReconciliation,
} from "@/server/modules/reconcile/reconcile.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await listReconcileHistoryAndVaults(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await recordVaultReconciliation(user, body);
});
