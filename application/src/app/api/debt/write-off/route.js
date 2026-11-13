// API Route: POST /api/debt/write-off
// Handles debt forgiveness / write-off conversion to charity or emergency expense

import { NextResponse } from "next/server";
import { writeOffDebt } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { debtEntryId, destinationCategoryCode = "EXP_SOCIAL_CHARITY" } = body;

    if (!debtEntryId) {
      return NextResponse.json({ success: false, error: "debtEntryId is required" }, { status: 400 });
    }

    const result = await writeOffDebt(parseInt(debtEntryId, 10), destinationCategoryCode);

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

