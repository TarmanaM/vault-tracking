// API Route: POST /api/cards/suggestions/dismiss
// Mutes post-save Action Card suggestions for a specific (nature, title) key across devices

import { withApiHandler } from "@/server/http/apiHandler";
import { BadRequestError } from "@/server/http/errors";
import { dismissCardSuggestionKey } from "@/lib/cardPromotionService";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  const { nature, title } = body || {};

  if (!title || !String(title).trim()) {
    throw new BadRequestError("Title is required");
  }

  const dismissedKeys = await dismissCardSuggestionKey(
    user.id,
    nature || "EXPENSE",
    title
  );
  return { dismissedKeys };
});
