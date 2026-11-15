// API Route: POST /api/cards/suggestions/dismiss
// Mutes post-save Action Card suggestions for a specific (nature, title) key across devices

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dismissCardSuggestionKey } from "@/lib/cardPromotionService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { nature, title } = body || {};

    if (!title || !String(title).trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const dismissedKeys = await dismissCardSuggestionKey(user.id, nature || "EXPENSE", title);
    return NextResponse.json({ success: true, data: { dismissedKeys } });
  } catch (error) {
    console.error("Error in POST /api/cards/suggestions/dismiss:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mute suggestion" },
      { status: 400 }
    );
  }
}
