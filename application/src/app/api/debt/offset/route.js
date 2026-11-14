// API Route: POST /api/debt/offset
// Handles manual two-way debt merge / offset between Receivables and Payables (#22-2)

import { NextResponse } from "next/server";
import { offsetPartyDebts } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      partyId,
      receivableIds = [],
      payableIds = [],
      offsetAmount = null,
      notes = null,
    } = body;

    if (!partyId) {
      return NextResponse.json(
        { success: false, error: "partyId is required" },
        { status: 400 }
      );
    }

    const result = await offsetPartyDebts({
      partyId,
      receivableIds,
      payableIds,
      offsetAmount,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/debt/offset:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to offset party debts" },
      { status: 400 }
    );
  }
}

