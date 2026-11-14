// API Route: GET /api/export
// Generates Standard Double-Entry Accounting Journal and Flat Ledger exports in CSV or TXT

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal, roundMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "journal_csv"; // journal_csv, flat_csv, journal_txt
    const monthTag = searchParams.get("monthTag");

    const where = {};
    if (monthTag) where.monthTag = monthTag;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        party: true,
        legs: { include: { vault: true } },
      },
      orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
    });

    if (format === "journal_csv") {
      let csv = "Journal No,Date,Time,COA Code,Account Name,Party/Sub-Ledger,Debit (IDR),Credit (IDR),Description\n";

      for (const t of transactions) {
        const jNo = `JRN-${t.id}`;
        const dateStr = t.transactionDate.toISOString().split("T")[0];
        const gross = toDecimal(t.grossAmount).toNumber();
        const primaryLeg = t.legs.find((l) => l.legRole === "PRIMARY") || t.legs[0];
        const vault = primaryLeg?.vault;

        if (t.nature === "EXPENSE") {
          // Debit: Expense Account (Category)
          const expCoa = t.category?.coaCode || "5000";
          const expName = t.category?.name || "Beban Pengeluaran";
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","${expCoa}","${expName}","${t.party.name}",${gross},0,"${t.title}"\n`;

          // Credit: Vault Account (Asset)
          const vCoa = vault?.vaultType === "BANK" ? "1110" : "1100";
          const vName = vault?.name || "Kas/Bank";
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","${vCoa}","${vName}","${t.party.name}",0,${gross},"${t.title} [Keluar dari ${vName}]"\n`;
        } else if (t.nature === "INCOME") {
          // Debit: Vault Account (Asset)
          const vCoa = vault?.vaultType === "BANK" ? "1110" : "1100";
          const vName = vault?.name || "Kas/Bank";
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","${vCoa}","${vName}","${t.party.name}",${gross},0,"${t.title} [Masuk ke ${vName}]"\n`;

          // Credit: Revenue Account
          const revCoa = t.category?.coaCode || "4000";
          const revName = t.category?.name || "Pendapatan";
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","${revCoa}","${revName}","${t.party.name}",0,${gross},"${t.title}"\n`;
        } else if (t.nature === "TRANSFER") {
          const targetLeg = t.legs.find((l) => l.legRole === "TRANSFER_TARGET");
          const targetVault = targetLeg?.vault;

          // Debit: Target Vault
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${targetVault?.name || "Kas/Bank"}","${t.party.name}",${gross},0,"Pindah dana dari ${vault?.name}"\n`;
          // Credit: Source Vault
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Kas/Bank"}","${t.party.name}",0,${gross},"Pindah dana ke ${targetVault?.name}"\n`;
        } else if (t.nature === "RECEIVABLE_LEND") {
          // Debit: Receivable Account
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1201","Piutang Pihak Ketiga","${t.party.name}",${gross},0,"Pinjaman/Talangan: ${t.title}"\n`;
          // Credit: Vault Account
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Kas/Bank"}","${t.party.name}",0,${gross},"Keluar dari ${vault?.name}"\n`;
        } else if (t.nature === "RECEIVABLE_COLLECT") {
          // Debit: Vault Account
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1100","${vault?.name || "Kas/Bank"}","${t.party.name}",${gross},0,"Terima pelunasan piutang: ${t.title}"\n`;
          // Credit: Receivable Account
          csv += `"${jNo}","${dateStr}","${t.transactionTime}","1201","Piutang Pihak Ketiga","${t.party.name}",0,${gross},"Pelunasan dari ${t.party.name}"\n`;
        }
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="accounting_journal_${monthTag || "all"}.csv"`,
        },
      });
    }

    // Default Flat CSV
    let flatCsv = "ID,Date,Time,Month,Title,Nature,Category,Party,Amount (Base),Consume (Base),Entry Currency,Original Amount,FX Rate,Vaults Affected,Notes\n";
    for (const t of transactions) {
      const dateStr = t.transactionDate.toISOString().split("T")[0];
      const vaultsAffected = t.legs.map((l) => `${l.vault.name} (${toDecimal(l.netMutation).toNumber()})`).join("; ");
      const origAmt = t.originalGrossAmount !== null && t.originalGrossAmount !== undefined ? toDecimal(t.originalGrossAmount).toNumber() : "";
      const fxApplied = t.fxRateApplied ? toDecimal(t.fxRateApplied).toNumber() : 1;
      flatCsv += `${t.id},"${dateStr}","${t.transactionTime}","${t.monthTag}","${t.title}","${t.nature}","${t.category?.name || ""}","${t.party.name}",${toDecimal(t.grossAmount).toNumber()},${toDecimal(t.consumeAmount).toNumber()},"${t.currency || "IDR"}",${origAmt},${fxApplied},"${vaultsAffected}","${t.notes || ""}"\n`;
    }

    return new NextResponse(flatCsv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger_flat_${monthTag || "all"}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/export:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to export data" },
      { status: 500 }
    );
  }
}

