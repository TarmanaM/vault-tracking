// API Route: GET & POST /api/cards/from-transaction
// Previews or promotes a ledger Transaction into a Smart Action Card with habit seeding

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import {
  PromotionError,
  previewPromotionFromTransaction,
  promoteTransactionToCard,
} from "@/lib/cardPromotionService";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request, user }) => {
  const { searchParams } = new URL(request.url);
  try {
    return await previewPromotionFromTransaction(user.id, searchParams);
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    throw error;
  }
});

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  try {
    return await promoteTransactionToCard({ ...body, userId: user.id });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          ...(error.details || {}),
        },
        { status: error.statusCode }
      );
    }
    throw error;
  }
});
