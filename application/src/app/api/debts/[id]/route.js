// API Route: GET /api/debts/[id]
// Returns full debt & transaction breakdown for a specific Party (#21, #22, #22-2)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const partyId = parseInt(id, 10);

    const [party, partyTransactions, vaults, categories] = await Promise.all([
      prisma.party.findUnique({
        where: { id: partyId },
        include: {
          debtLedgerEntries: {
            include: {
              transaction: {
                include: {
                  category: true,
                  legs: { include: { vault: true } },
                },
              },
              referenceDebt: {
                include: { transaction: true },
              },
            },
            orderBy: [{ transaction: { transactionDate: "desc" } }, { id: "desc" }],
          },
        },
      }),
      prisma.transaction.findMany({
        where: { partyId },
        include: {
          category: true,
          legs: { include: { vault: true } },
          debtLedgerEntries: true,
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      }),
      prisma.vault.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    if (!party) {
      return NextResponse.json({ success: false, error: "Party not found" }, { status: 404 });
    }

    let externalAccounts = [];
    try {
      externalAccounts = party.externalAccountsJson ? JSON.parse(party.externalAccountsJson) : [];
    } catch {
      externalAccounts = [];
    }

    const openReceivables = party.debtLedgerEntries.filter(
      (e) =>
        e.entryCategory === "RECEIVABLE" &&
        e.direction === "INCREASE" &&
        toDecimal(e.remainingOpenAmount).greaterThan(0)
    );

    const openPayables = party.debtLedgerEntries.filter(
      (e) =>
        e.entryCategory === "PAYABLE" &&
        e.direction === "INCREASE" &&
        toDecimal(e.remainingOpenAmount).greaterThan(0)
    );

    return NextResponse.json({
      success: true,
      data: {
        party: {
          ...party,
          receivableBalance: roundMoney(party.receivableBalance),
          payableBalance: roundMoney(party.payableBalance),
          externalAccounts,
        },
        openReceivables,
        openPayables,
        transactions: partyTransactions,
        vaults,
        categories,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/debts/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch party debt details" },
      { status: 500 }
    );
  }
}

