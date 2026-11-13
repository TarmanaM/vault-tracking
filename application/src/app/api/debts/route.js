// API Route: GET /api/debts
// Returns active receivables, payables, held funds, and open settlement chains

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
          include: { transaction: true },
          orderBy: { id: "desc" },
        },
      },
      orderBy: { netReceivableBalance: "desc" },
    });

    let totalReceivables = toDecimal(0);
    let totalPayables = toDecimal(0);
    let totalHeldFunds = toDecimal(0);

    for (const p of parties) {
      const rec = toDecimal(p.netReceivableBalance);
      const held = toDecimal(p.heldFundBalance);

      if (rec.greaterThan(0)) {
        totalReceivables = addMoney(totalReceivables, rec);
      } else if (rec.lessThan(0)) {
        totalPayables = addMoney(totalPayables, rec.abs());
      }

      if (held.greaterThan(0)) {
        totalHeldFunds = addMoney(totalHeldFunds, held);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalReceivables: roundMoney(totalReceivables),
          totalPayables: roundMoney(totalPayables),
          totalHeldFunds: roundMoney(totalHeldFunds),
        },
        parties,
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

