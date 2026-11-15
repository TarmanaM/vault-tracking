// API Route: GET /api/transactions/title-suggestions
// Returns active/soft-hidden Action Cards and grouped historical Transaction titles for autocomplete

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTransactionTitleSuggestions } from "@/lib/cardPromotionService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit") || "40", 10);
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(100, limitParam) : 40;

    const data = await getTransactionTitleSuggestions(user.id, limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in GET /api/transactions/title-suggestions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load title suggestions" },
      { status: 500 }
    );
  }
}
