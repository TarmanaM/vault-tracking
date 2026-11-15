// API Route: GET /api/debts
// Returns separate receivables and payables plus open entries per party for the authenticated user

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDecimal, addMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const parties = await prisma.party.findMany({
      where: { userId: user.id, isActive: true },
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

    // Also include LIABILITY_CREDIT_LINE vaults (e.g. PayLater) in payables overview
    const liabilityVaults = await prisma.vault.findMany({
      where: { userId: user.id, isActive: true, vaultType: "LIABILITY_CREDIT_LINE" },
    });

    let totalReceivables = toDecimal(0);
    let totalPayables = toDecimal(0);

    for (const v of liabilityVaults) {
      const bal = toDecimal(v.currentBalance);
      if (bal.lessThan(0)) {
        totalPayables = addMoney(totalPayables, bal.abs());
      }
    }

    const enrichedParties = [];
    for (const p of parties) {
      const rec = toDecimal(p.receivableBalance);
      const pay = toDecimal(p.payableBalance);

      totalReceivables = addMoney(totalReceivables, rec);
      totalPayables = addMoney(totalPayables, pay);

      const isSelf = p.code === "SELF" || p.partyType === "SELF";
      const hasDebtRelevance =
        Boolean(p.isDebtContact) ||
        rec.greaterThan(0) ||
        pay.greaterThan(0) ||
        (p.debtLedgerEntries && p.debtLedgerEntries.length > 0);

      if (isSelf || !hasDebtRelevance) {
        continue;
      }

      let externalAccounts = [];
      try {
        externalAccounts = p.externalAccountsJson ? JSON.parse(p.externalAccountsJson) : [];
      } catch {
        externalAccounts = [];
      }

      enrichedParties.push({
        ...p,
        receivableBalance: roundMoney(rec),
        payableBalance: roundMoney(pay),
        externalAccounts,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalReceivables: roundMoney(totalReceivables),
          totalPayables: roundMoney(totalPayables),
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
