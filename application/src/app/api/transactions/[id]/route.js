// API Route: GET & DELETE /api/transactions/[id]
// Fetches single transaction details or reverses a transaction atomically using ledgerService

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteAndReverseTransaction } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const txId = parseInt(id, 10);
    if (!Number.isInteger(txId) || txId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid transaction id" }, { status: 400 });
    }

    const tx = await prisma.transaction.findFirst({
      where: { id: txId, userId: user.id },
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

    if (!tx) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tx });
  } catch (error) {
    console.error("Error in GET /api/transactions/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const result = await deleteAndReverseTransaction(id, user.id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in DELETE /api/transactions/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reverse transaction" },
      { status: 400 }
    );
  }
}
