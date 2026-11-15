// API Route: GET /api/categories, POST /api/categories
// Lists and creates user-owned Categories for /settings and transaction selection

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listUserCategoriesAndTemplates,
  createOrEnableUserCategory,
} from "@/server/modules/categories/categories.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await listUserCategoriesAndTemplates(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createOrEnableUserCategory(user.id, body);
});
