// API Route: GET & POST /api/transactions
// Handles double-entry transaction creation and filtered ledger retrieval

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createTransaction } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vaultId = searchParams.get("vaultId");
    const categoryId = searchParams.get("categoryId");
    const partyId = searchParams.get("partyId");
    const nature = searchParams.get("nature");
    const monthTag = searchParams.get("monthTag");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where = {};
    if (categoryId) where.categoryId = parseInt(categoryId, 10);
    if (partyId) where.partyId = parseInt(partyId, 10);
    if (nature) where.nature = nature;
    if (monthTag) where.monthTag = monthTag;
    if (vaultId) {
      where.legs = {
        some: { vaultId: parseInt(vaultId, 10) },
      };
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: {
          category: true,
          party: true,
          actionCard: true,
          legs: {
            include: { vault: true },
          },
          debtLedgerEntries: true,
          childTransactions: true,
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        limit,
        offset,
        transactions,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/transactions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createTransaction(body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/transactions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create transaction" },
      { status: 400 }
    );
  }
}

