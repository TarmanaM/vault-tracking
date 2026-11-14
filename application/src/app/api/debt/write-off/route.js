// API Route: POST /api/debt/write-off
// Handles full or manual partial debt forgiveness / write-off conversion to charity or expense

import { NextResponse } from "next/server";
import { writeOffDebt } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      debtEntryId = null,
      partyId = null,
      amount = null,
      destinationCategoryCode = "EXP_SOCIAL_CHARITY",
      notes = null,
    } = body;

    if (!debtEntryId && !partyId) {
      return NextResponse.json(
        { success: false, error: "Either debtEntryId or partyId is required" },
        { status: 400 }
      );
    }

    const result = await writeOffDebt({
      debtEntryId,
      partyId,
      amount,
      destinationCategoryCode,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/debt/write-off:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to write off debt" },
      { status: 400 }
    );
  }
}
