// API Route: DELETE /api/transactions/[id]
// Reverses a transaction atomically using ledgerService (5s Undo & Ledger Delete)

import { NextResponse } from "next/server";
import { deleteAndReverseTransaction } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = await deleteAndReverseTransaction(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in DELETE /api/transactions/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reverse transaction" },
      { status: 400 }
    );
  }
}
