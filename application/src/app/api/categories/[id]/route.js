// API Route: PATCH /api/categories/[id], DELETE /api/categories/[id]
// Updates, archives, or safely deletes user-owned Categories

import { withApiHandler } from "@/server/http/apiHandler";
import {
  updateUserCategory,
  deleteOrArchiveUserCategory,
} from "@/server/modules/categories/categories.service";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(async ({ request, params, user }) => {
  const body = await request.json().catch(() => ({}));
  return await updateUserCategory(user.id, params?.id, body);
});

export const DELETE = withApiHandler(async ({ params, user }) => {
  return await deleteOrArchiveUserCategory(user.id, params?.id);
});
