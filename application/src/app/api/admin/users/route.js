// API Route: GET /api/admin/users, POST /api/admin/users
// Strictly manages user account metadata only; Admin cannot inspect any user's financial ledger data

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listAllUserAccountsMetadata,
  provisionNewUserAccount,
} from "@/server/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async () => {
    return await listAllUserAccountsMetadata();
  },
  { auth: "ADMIN", errorStatus: 500 }
);

export const POST = withApiHandler(
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return await provisionNewUserAccount(body);
  },
  { auth: "ADMIN" }
);
