// API Route: GET & POST /api/parties
// Lists and creates user-owned contacts / debt channels

import { withApiHandler } from "@/server/http/apiHandler";
import {
  findActiveUserParties,
  createNewUserParty,
} from "@/server/modules/parties/parties.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await findActiveUserParties(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createNewUserParty(user.id, body);
});
