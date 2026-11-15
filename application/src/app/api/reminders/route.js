// API Route: GET & POST /api/reminders
// Manages draft transaction notes and pending reminders

import { withApiHandler } from "@/server/http/apiHandler";
import {
  listPendingReminders,
  createPendingReminder,
} from "@/server/modules/cards/cards.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    return await listPendingReminders(user.id);
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await createPendingReminder(user.id, body);
});
