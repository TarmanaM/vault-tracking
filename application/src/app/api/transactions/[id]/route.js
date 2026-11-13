// API Route: DELETE /api/transactions/[id]
// Reverses a transaction atomically, updating vault balances and removing legs

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, addMoney, subMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const txId = parseInt(id, 10);

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: txId },
        include: {
          legs: true,
          childTransactions: { include: { legs: true } },
          debtLedgerEntries: true,
        },
      });

      if (!transaction) throw new Error("Transaction not found");

      // 1. Reverse all legs on primary transaction
      for (const leg of transaction.legs) {
        const vault = await tx.vault.findUnique({ where: { id: leg.vaultId } });
        if (vault) {
          // If leg had debitIn, subtract it; if creditOut, add it back
          const net = toDecimal(leg.netMutation);
          const restoredBalance = subMoney(vault.currentBalance, net);
          await tx.vault.update({
            where: { id: vault.id },
            data: { currentBalance: restoredBalance },
          });
        }
      }

      // 2. Reverse child transactions (e.g. auto-split admin fees)
      for (const child of transaction.childTransactions) {
        for (const cLeg of child.legs) {
          const vault = await tx.vault.findUnique({ where: { id: cLeg.vaultId } });
          if (vault) {
            const net = toDecimal(cLeg.netMutation);
            const restoredBalance = subMoney(vault.currentBalance, net);
            await tx.vault.update({
              where: { id: vault.id },
              data: { currentBalance: restoredBalance },
            });
          }
        }
        await tx.transaction.delete({ where: { id: child.id } });
      }

      // 3. Delete debt ledger entries
      if (transaction.debtLedgerEntries.length > 0) {
        for (const de of transaction.debtLedgerEntries) {
          const party = await tx.party.findUnique({ where: { id: de.partyId } });
          if (party) {
            const amt = toDecimal(de.amount);
            if (de.direction === "INCREASE") {
              await tx.party.update({
                where: { id: party.id },
                data: { netReceivableBalance: subMoney(party.netReceivableBalance, amt) },
              });
            } else {
              await tx.party.update({
                where: { id: party.id },
                data: { netReceivableBalance: addMoney(party.netReceivableBalance, amt) },
              });
            }
          }
        }
      }

      // 4. Finally delete the main transaction
      await tx.transaction.delete({ where: { id: transaction.id } });

      return { id: transaction.id, title: transaction.title };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in DELETE /api/transactions/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reverse transaction" },
      { status: 400 }
    );
  }
}

