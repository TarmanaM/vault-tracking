// API Route: GET & POST /api/cards/from-transaction
// Previews or promotes a ledger Transaction into a Smart Action Card with habit seeding

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  PromotionError,
  findMatchingActiveCard,
  findMatchingHistoricalTransactions,
  promoteTransactionToCard,
} from "@/lib/cardPromotionService";
import { normalizeCardTitle } from "@/lib/cardPromotionUtils";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const sourceTransactionId = parseInt(searchParams.get("sourceTransactionId") || "", 10);
    if (!Number.isInteger(sourceTransactionId) || sourceTransactionId <= 0) {
      return NextResponse.json({ success: false, error: "Valid sourceTransactionId is required" }, { status: 400 });
    }

    const sourceTx = await prisma.transaction.findFirst({
      where: { id: sourceTransactionId, userId: user.id },
      include: {
        category: true,
        party: true,
        actionCard: true,
        legs: {
          include: {
            vault: true,
            subContainer: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!sourceTx) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const titleToCheck = searchParams.get("title") || sourceTx.title;
    const typeToCheck = searchParams.get("cardActionType") || sourceTx.nature;

    const duplicateCard = await findMatchingActiveCard(prisma, user.id, titleToCheck, typeToCheck);
    const matchTitles = new Set([normalizeCardTitle(sourceTx.title), normalizeCardTitle(titleToCheck)]);
    const matchingHistory = await findMatchingHistoricalTransactions(
      prisma,
      user.id,
      sourceTx.nature,
      matchTitles,
      sourceTx
    );

    return NextResponse.json({
      success: true,
      data: {
        transaction: sourceTx,
        duplicateCard,
        matchingHistoryCount: matchingHistory.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/cards/from-transaction:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to inspect transaction" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const result = await promoteTransactionToCard({ ...body, userId: user.id });
    return NextResponse.json({ success: true, data: result });
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

    console.error("Error in POST /api/cards/from-transaction:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to promote transaction to card" },
      { status: 400 }
    );
  }
}
