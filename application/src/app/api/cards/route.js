// API Route: GET, POST & PATCH /api/cards
// Manages Smart Action Cards creation, editing, and 2-tier visibility hiding

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listActiveActionCards,
  createActionCard,
  updateActionCard,
} from "@/server/modules/cards/cards.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await listActiveActionCards(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createActionCard(user.id, body);
});

export const PATCH = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await updateActionCard(user.id, body);
});
