// API Route: GET /api/dashboard
// Returns real-time aggregate wealth, vaults, habit-scored action cards, and layer breakdowns

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateCardScore } from "@/lib/habitEngine";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const currentMonthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;

    // 1. Fetch all vaults
    const vaults = await prisma.vault.findMany({
      where: { isActive: true },
      include: { subContainers: true },
      orderBy: { sortOrder: "asc" },
    });

    // 2. Fetch all parties
    const parties = await prisma.party.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });

    // 3. Fetch all action cards with habit stats and relations
    const rawActionCards = await prisma.actionCard.findMany({
      where: { isActive: true },
      include: {
        defaultVault: true,
        targetVault: true,
        defaultCategory: true,
        defaultParty: true,
        habitStats: true,
      },
    });

    // Dynamically calculate habit scores and sort
    const scoredActionCards = rawActionCards
      .map((card) => {
        const score = calculateCardScore(card, now);
        return { ...card, dynamicScore: score };
      })
      .sort((a, b) => b.dynamicScore - a.dynamicScore);

    // 4. Compute Wealth Breakdown
    let liquidWealth = toDecimal(0);
    let heldPoolWealth = toDecimal(0);
    let liabilityPayable = toDecimal(0);

    for (const v of vaults) {
      const bal = toDecimal(v.currentBalance);
      if (v.vaultType === "LIABILITY_CREDIT_LINE") {
        if (bal.lessThan(0)) {
          liabilityPayable = addMoney(liabilityPayable, bal.abs());
        }
      } else if (v.vaultType === "HELD_POOL") {
        heldPoolWealth = addMoney(heldPoolWealth, bal);
      } else {
        liquidWealth = addMoney(liquidWealth, bal);
      }
    }

    let thirdPartyReceivable = toDecimal(0);
    let thirdPartyPayable = toDecimal(0);

    for (const p of parties) {
      const bal = toDecimal(p.netReceivableBalance);
      if (bal.greaterThan(0)) {
        thirdPartyReceivable = addMoney(thirdPartyReceivable, bal);
      } else if (bal.lessThan(0)) {
        thirdPartyPayable = addMoney(thirdPartyPayable, bal.abs());
      }
    }

    const totalReceivables = thirdPartyReceivable;
    const totalPayables = addMoney(liabilityPayable, thirdPartyPayable);
    const netTotalWealth = subMoney(
      addMoney(addMoney(liquidWealth, heldPoolWealth), totalReceivables),
      totalPayables
    );

    // 5. Current Month Consumption Breakdown by Layer
    const monthTransactions = await prisma.transaction.findMany({
      where: { monthTag: currentMonthTag },
      include: { category: true },
    });

    let mandatoryExpense = toDecimal(0);
    let variableEssentialExpense = toDecimal(0);
    let discretionaryExpense = toDecimal(0);
    let socialCharityExpense = toDecimal(0);
    let cashShortageLost = toDecimal(0);
    let monthTotalConsume = toDecimal(0);
    let monthTotalIncome = toDecimal(0);

    for (const tx of monthTransactions) {
      const gross = toDecimal(tx.grossAmount);
      const consume = toDecimal(tx.consumeAmount).abs();
      const income = toDecimal(tx.incomeAmount);

      monthTotalIncome = addMoney(monthTotalIncome, income);

      if (tx.nature === "RECONCILIATION_LOST") {
        cashShortageLost = addMoney(cashShortageLost, gross);
      } else if (tx.consumeAmount && toDecimal(tx.consumeAmount).lessThan(0)) {
        monthTotalConsume = addMoney(monthTotalConsume, consume);

        if (tx.commitmentType === "FIXED_MANDATORY") {
          mandatoryExpense = addMoney(mandatoryExpense, consume);
        } else if (tx.commitmentType === "VARIABLE_ESSENTIAL") {
          variableEssentialExpense = addMoney(variableEssentialExpense, consume);
        } else if (tx.commitmentType === "DISCRETIONARY_JAJAN") {
          discretionaryExpense = addMoney(discretionaryExpense, consume);
        } else if (tx.commitmentType === "SOCIAL_CHARITY") {
          socialCharityExpense = addMoney(socialCharityExpense, consume);
        }
      }
    }

    // 6. Pending Reminders
    const pendingReminders = await prisma.pendingReminder.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    // 7. Categories for quick creation
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          liquidWealth: roundMoney(liquidWealth),
          heldPoolWealth: roundMoney(heldPoolWealth),
          totalReceivables: roundMoney(totalReceivables),
          totalPayables: roundMoney(totalPayables),
          netTotalWealth: roundMoney(netTotalWealth),
          currentMonth: {
            monthTag: currentMonthTag,
            totalIncome: roundMoney(monthTotalIncome),
            totalConsume: roundMoney(monthTotalConsume),
            mandatoryExpense: roundMoney(mandatoryExpense),
            variableEssentialExpense: roundMoney(variableEssentialExpense),
            discretionaryExpense: roundMoney(discretionaryExpense),
            socialCharityExpense: roundMoney(socialCharityExpense),
            cashShortageLost: roundMoney(cashShortageLost),
          },
        },
        vaults,
        parties,
        actionCards: scoredActionCards,
        pendingReminders,
        categories,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/dashboard:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

