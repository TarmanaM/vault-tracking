// API Route: GET /api/dashboard
// Returns real-time aggregate wealth, vaults, habit-scored action cards, searchable/archived cards, and latest checkpoints

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateCardScore } from "@/lib/habitEngine";
import { toDecimal, addMoney, subMoney, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    let currentMonthTag = `${now.toLocaleString("en-US", { month: "short" })},${now.getFullYear()}`;

    // 1. Fetch all active vaults
    const vaults = await prisma.vault.findMany({
      where: { isActive: true },
      include: { subContainers: true },
      orderBy: { sortOrder: "asc" },
    });

    // 2. Fetch all active parties with separate receivable/payable balances
    const rawParties = await prisma.party.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });

    const parties = rawParties.map((p) => {
      let externalAccounts = [];
      try {
        externalAccounts = p.externalAccountsJson ? JSON.parse(p.externalAccountsJson) : [];
      } catch {
        externalAccounts = [];
      }
      return { ...p, externalAccounts };
    });

    // 3. Fetch action cards grouped by visibilityMode (#11, #23)
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

    const scoredAllCards = rawActionCards
      .map((card) => {
        const score = calculateCardScore(card, now);
        return { ...card, dynamicScore: score };
      })
      .sort((a, b) => b.dynamicScore - a.dynamicScore);

    const recommendedCards = scoredAllCards.filter((c) => c.visibilityMode === "ACTIVE");
    const searchableCards = scoredAllCards.filter(
      (c) => c.visibilityMode === "ACTIVE" || c.visibilityMode === "SOFT_HIDDEN"
    );
    const archivedCards = scoredAllCards.filter((c) => c.visibilityMode === "ARCHIVED");

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
      thirdPartyReceivable = addMoney(thirdPartyReceivable, p.receivableBalance);
      thirdPartyPayable = addMoney(thirdPartyPayable, p.payableBalance);
    }

    const totalReceivables = thirdPartyReceivable;
    const totalPayables = addMoney(liabilityPayable, thirdPartyPayable);
    const netTotalWealth = subMoney(
      addMoney(addMoney(liquidWealth, heldPoolWealth), totalReceivables),
      totalPayables
    );

    // 5. Current Month Consumption Breakdown by Layer (fallback to latest tx month if current month empty)
    let monthTransactions = await prisma.transaction.findMany({
      where: { monthTag: currentMonthTag },
      include: { category: true },
    });

    if (monthTransactions.length === 0) {
      const latestTx = await prisma.transaction.findFirst({
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      });
      if (latestTx) {
        currentMonthTag = latestTx.monthTag;
        monthTransactions = await prisma.transaction.findMany({
          where: { monthTag: currentMonthTag },
          include: { category: true },
        });
      }
    }

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

    // 6. Latest Checkpoint per Vault for #15 Auto-Retroactive Detection
    const allCheckpoints = await prisma.vaultCheckpoint.findMany({
      orderBy: { checkpointTimestamp: "desc" },
    });
    const latestCheckpointsByVault = {};
    for (const cp of allCheckpoints) {
      if (!latestCheckpointsByVault[cp.vaultId]) {
        latestCheckpointsByVault[cp.vaultId] = {
          id: cp.id,
          vaultId: cp.vaultId,
          periodLabel: cp.periodLabel,
          checkpointTimestamp: cp.checkpointTimestamp,
        };
      }
    }

    // 7. Pending Reminders & Categories
    const [pendingReminders, categories] = await Promise.all([
      prisma.pendingReminder.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

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
        actionCards: recommendedCards,
        searchableCards,
        archivedCards,
        latestCheckpointsByVault,
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
