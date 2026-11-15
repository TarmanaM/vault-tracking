// API Route: GET /api/transactions/title-suggestions
// Returns active/soft-hidden Action Cards and grouped historical Transaction titles for autocomplete

import { withApiHandler } from "@/server/http/apiHandler";
import { listTitleSuggestions } from "@/server/modules/transactions/transactions.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request, user }) => {
    const { searchParams } = new URL(request.url);
    return listTitleSuggestions(user.id, searchParams.get("limit"));
  },
  { auth: "USER" }
);
