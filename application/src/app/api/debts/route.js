// API Route: GET /api/debts
// Returns separate receivables (Piutang), payables (Utang), held funds, and open entries per party (#22-2)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, addMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const parties = await prisma.party.findMany({
      where: { isActive: true },
      include: {
        debtLedgerEntries: {
          include: {
            transaction: {
              include: { category: true, legs: { include: { vault: true } } },
            },
          },
          orderBy: { id: "desc" },
        },
      },
      orderBy: [{ receivableBalance: "desc" }, { payableBalance: "desc" }, { name: "asc" }],
    });

    // Also include LIABILITY_CREDIT_LINE vaults (e.g. SPayLater) in payables overview
    const liabilityVaults = await prisma.vault.findMany({
      where: { isActive: true, vaultType: "LIABILITY_CREDIT_LINE" },
    });

    let totalReceivables = toDecimal(0);
    let totalPayables = toDecimal(0);
    let totalHeldFunds = toDecimal(0);

    for (const v of liabilityVaults) {
      const bal = toDecimal(v.currentBalance);
      if (bal.lessThan(0)) {
        totalPayables = addMoney(totalPayables, bal.abs());
      }
    }

    const enrichedParties = parties.map((p) => {
      const rec = toDecimal(p.receivableBalance);
      const pay = toDecimal(p.payableBalance);
      const held = toDecimal(p.heldFundBalance);

      totalReceivables = addMoney(totalReceivables, rec);
      totalPayables = addMoney(totalPayables, pay);
      if (held.greaterThan(0)) {
        totalHeldFunds = addMoney(totalHeldFunds, held);
      }

      let externalAccounts = [];
      try {
        externalAccounts = p.externalAccountsJson ? JSON.parse(p.externalAccountsJson) : [];
      } catch {
        externalAccounts = [];
      }

      return {
        ...p,
        receivableBalance: roundMoney(rec),
        payableBalance: roundMoney(pay),
        externalAccounts,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalReceivables: roundMoney(totalReceivables),
          totalPayables: roundMoney(totalPayables),
          totalHeldFunds: roundMoney(totalHeldFunds),
        },
        parties: enrichedParties,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/debts:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch debts" },
      { status: 500 }
    );
  }
}
