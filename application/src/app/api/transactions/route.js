// API Route: GET & POST /api/transactions
// Handles double-entry transaction creation and date-filtered ledger retrieval (#xx)

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
    const preset = searchParams.get("preset"); // 1M, 3M, 6M, YTD, ALL, CUSTOM
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Determine date bounds anchored to latest transaction when using relative presets (#xx)
    const latestTx = await prisma.transaction.findFirst({
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      select: { transactionDate: true },
    });
    const anchorDate = latestTx ? new Date(latestTx.transactionDate) : new Date();

    let resolvedStart = null;
    let resolvedEnd = null;

    if (preset && preset !== "ALL") {
      if (preset === "CUSTOM") {
        if (startDateParam) resolvedStart = new Date(`${startDateParam}T00:00:00`);
        if (endDateParam) resolvedEnd = new Date(`${endDateParam}T23:59:59.999`);
      } else {
        resolvedEnd = new Date(anchorDate);
        resolvedEnd.setHours(23, 59, 59, 999);
        resolvedStart = new Date(anchorDate);
        if (preset === "1M") resolvedStart.setMonth(resolvedStart.getMonth() - 1);
        else if (preset === "3M") resolvedStart.setMonth(resolvedStart.getMonth() - 3);
        else if (preset === "6M") resolvedStart.setMonth(resolvedStart.getMonth() - 6);
        else if (preset === "YTD") resolvedStart = new Date(anchorDate.getFullYear(), 0, 1);
        resolvedStart.setHours(0, 0, 0, 0);
      }
    } else if (startDateParam || endDateParam) {
      if (startDateParam) resolvedStart = new Date(`${startDateParam}T00:00:00`);
      if (endDateParam) resolvedEnd = new Date(`${endDateParam}T23:59:59.999`);
    }

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
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { notes: { contains: search.trim() } },
        { counterpartyAccountNote: { contains: search.trim() } },
      ];
    }
    if (resolvedStart || resolvedEnd) {
      where.transactionDate = {
        ...(resolvedStart ? { gte: resolvedStart } : {}),
        ...(resolvedEnd ? { lte: resolvedEnd } : {}),
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
        orderBy: [{ transactionDate: "desc" }, { transactionTime: "desc" }, { id: "desc" }],
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
        appliedRange: {
          preset: preset || "ALL",
          startDate: resolvedStart ? resolvedStart.toISOString().split("T")[0] : null,
          endDate: resolvedEnd ? resolvedEnd.toISOString().split("T")[0] : null,
          anchorDate: anchorDate.toISOString().split("T")[0],
        },
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
