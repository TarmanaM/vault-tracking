// Database injection script to import transactions from Financial Management.xlsx (Buku Besar)
// Adheres strictly to Rule 9 (English comments), Rule 10 (Dual-language convention),
// Rule 13 (Atomic transactions), Rule 14 (Decimal precision), and Rule 15 (Strict Consume Invariant)

const { PrismaClient } = require("@prisma/client");
const Decimal = require("decimal.js");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const prisma = new PrismaClient();

// Configure Decimal precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

function toDecimal(val) {
  if (val === null || val === undefined || val === "") return new Decimal(0);
  return new Decimal(val);
}

function parseExcelSerial(serial) {
  const val = parseFloat(serial);
  // Excel epoch: 1899-12-30
  const epoch = new Date(1899, 11, 30);
  const jsDate = new Date(epoch.getTime() + val * 86400000);
  const year = jsDate.getFullYear();
  const month = String(jsDate.getMonth() + 1).padStart(2, "0");
  const day = String(jsDate.getDate()).padStart(2, "0");
  const hours = String(jsDate.getHours()).padStart(2, "0");
  const minutes = String(jsDate.getMinutes()).padStart(2, "0");

  const monthTag = `${jsDate.toLocaleString("en-US", { month: "short" })},${year}`;

  return {
    date: jsDate,
    timeString: `${hours}:${minutes}`,
    monthTag,
  };
}

async function extractFromExcelIfNeeded() {
  const jsonPath = path.join(__dirname, "excel-data.json");
  const excelPath = path.resolve(__dirname, "../../Financial Management.xlsx");
  const pyExtractor = path.join(__dirname, "extract-excel.py");

  if (fs.existsSync(excelPath) && fs.existsSync(pyExtractor)) {
    try {
      console.log(`- Refreshing data from ${excelPath} using extract-excel.py...`);
      execSync(`python "${pyExtractor}"`, { stdio: "inherit" });
    } catch (err) {
      console.log(`- Note: Python extraction skipped, falling back to existing excel-data.json (${err.message})`);
    }
  }

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Neither excel-data.json nor Financial Management.xlsx could be loaded.`);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  console.log("==================================================");
  console.log("  Vault Tracking - Excel General Ledger Injector  ");
  console.log("==================================================\n");

  const rawData = await extractFromExcelIfNeeded();
  const rows = rawData.buku_besar_update || [];

  if (!rows.length) {
    console.log("No rows found in sheet 'Buku Besar Update'. Exiting.");
    return;
  }

  console.log(`Loaded ${rows.length} rows from Excel Buku Besar sheet.`);

  // Load master entities
  const vaults = await prisma.vault.findMany();
  const parties = await prisma.party.findMany();
  const categories = await prisma.category.findMany();
  const actionCards = await prisma.actionCard.findMany();

  // Helper mappings
  const vaultMap = {};
  vaults.forEach((v) => {
    vaultMap[v.code.toUpperCase()] = v;
    vaultMap[v.name.toUpperCase()] = v;
  });

  const partyMap = {};
  parties.forEach((p) => {
    partyMap[p.code.toUpperCase()] = p;
    partyMap[p.name.toUpperCase()] = p;
  });

  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.code.toUpperCase()] = c;
    categoryMap[c.name.toUpperCase()] = c;
  });

  // Resolve Vault from Excel text
  function resolveVault(nameStr) {
    if (!nameStr) return vaultMap["NOBU"] || vaults[0];
    const cleaned = nameStr.trim().toUpperCase();
    if (cleaned.includes("NOBU")) return vaultMap["NOBU"];
    if (cleaned.includes("BCA")) return vaultMap["BCA"];
    if (cleaned.includes("SPAY") || cleaned.includes("SHOPEEPAY")) return vaultMap["SPAY"];
    if (cleaned.includes("GOPAY")) return vaultMap["GOPAY"];
    if (cleaned.includes("TASPEN")) return vaultMap["TASPEN"];
    if (cleaned.includes("JAGO")) return vaultMap["JAGO"];
    if (cleaned.includes("MANDIRI")) return vaultMap["MANDIRI"];
    if (cleaned.includes("CASH") || cleaned.includes("DOMPET")) return vaultMap["CASH"];
    if (cleaned.includes("COIN") || cleaned.includes("KOIN")) return vaultMap["COIN"];
    return vaultMap["NOBU"] || vaults[0];
  }

  // Resolve Party from Excel text
  function resolveParty(nameStr) {
    if (!nameStr) return partyMap["ISA"];
    const cleaned = nameStr.trim().toUpperCase();
    if (cleaned.includes("ISA") || cleaned.includes("SELF") || cleaned.includes("SAYA")) return partyMap["ISA"];
    if (cleaned.includes("IBRAHIM") || cleaned.includes("DADA")) return partyMap["IBRAHIM"];
    if (cleaned.includes("FERNANDO") || cleaned.includes("NANDO")) return partyMap["FERNANDO"];
    if (cleaned.includes("SLAMET") || cleaned.includes("AMET")) return partyMap["SLAMET"];
    if (cleaned.includes("DDV") || cleaned.includes("KANTOR")) return partyMap["DDV"];
    if (cleaned.includes("TASPEN")) return partyMap["TASPEN"];
    return partyMap["ISA"];
  }

  // Resolve Category, Commitment, and Tier from Excel text
  function resolveCategory(item) {
    const jenis = (item.jenis || "").trim().toUpperCase();
    const nama = (item.nama || "").trim().toUpperCase();

    if (jenis === "DANA AWAL") {
      return {
        category: categoryMap["TX_INITIAL_FUND"],
        nature: "INITIAL_FUND",
        commitmentType: "NONE",
        priorityTier: "NONE",
      };
    }

    if (jenis === "GAJI") {
      return {
        category: categoryMap["INC_SALARY"],
        nature: "INCOME",
        commitmentType: "NONE",
        priorityTier: "NONE",
      };
    }

    if (jenis === "PIUTANG") {
      const debit = toDecimal(item.debit);
      if (debit.greaterThan(0)) {
        return {
          category: null,
          nature: "RECEIVABLE_COLLECT",
          commitmentType: "NONE",
          priorityTier: "NONE",
        };
      }
      return {
        category: null,
        nature: "RECEIVABLE_LEND",
        commitmentType: "NONE",
        priorityTier: "NONE",
      };
    }

    if (jenis === "TRANSPORTASI") {
      if (nama.includes("PARKIR")) {
        return {
          category: categoryMap["EXP_PARKING"],
          nature: "EXPENSE",
          commitmentType: "FIXED_MANDATORY",
          priorityTier: "PRIMER",
        };
      }
      if (nama.includes("BENSIN") || nama.includes("SKUPI")) {
        return {
          category: categoryMap["EXP_FUEL"],
          nature: "EXPENSE",
          commitmentType: "FIXED_MANDATORY",
          priorityTier: "PRIMER",
        };
      }
      return {
        category: categoryMap["EXP_TRANSPORT"],
        nature: "EXPENSE",
        commitmentType: "VARIABLE_ESSENTIAL",
        priorityTier: "SEKUNDER",
      };
    }

    if (jenis === "JAJAN") {
      if (nama.includes("KOPI") || nama.includes("AMERICANO") || nama.includes("NESCAFE")) {
        return {
          category: categoryMap["EXP_COFFEE"],
          nature: "EXPENSE",
          commitmentType: "DISCRETIONARY_JAJAN",
          priorityTier: "TERSIER",
        };
      }
      if (nama.includes("ROKO") || nama.includes("SAMPURNA")) {
        return {
          category: categoryMap["EXP_LIFESTYLE_HABIT"],
          nature: "EXPENSE",
          commitmentType: "DISCRETIONARY_JAJAN",
          priorityTier: "TERSIER",
        };
      }
      return {
        category: categoryMap["EXP_SNACK_CULINARY"],
        nature: "EXPENSE",
        commitmentType: "DISCRETIONARY_JAJAN",
        priorityTier: "TERSIER",
      };
    }

    if (jenis === "HIBURAN") {
      return {
        category: categoryMap["EXP_LIFESTYLE_HABIT"],
        nature: "EXPENSE",
        commitmentType: "DISCRETIONARY_JAJAN",
        priorityTier: "TERSIER",
      };
    }

    return {
      category: categoryMap["EXP_SNACK_CULINARY"],
      nature: "EXPENSE",
      commitmentType: "DISCRETIONARY_JAJAN",
      priorityTier: "TERSIER",
    };
  }

  // Resolve matching Action Card for habit stats updating
  function resolveActionCard(nama) {
    const upper = (nama || "").toUpperCase();
    if (upper.includes("PARKIR KANTOR")) {
      return actionCards.find((c) => c.title === "Parkir Kantor");
    }
    if (upper.includes("BENSIN") || upper.includes("SKUPI")) {
      return actionCards.find((c) => c.title === "Beli Bensin Skupi");
    }
    if (upper.includes("AMERICANO")) {
      return actionCards.find((c) => c.title === "Americano FM");
    }
    if (upper.includes("HOKBEN")) {
      return actionCards.find((c) => c.title === "Makan Siang");
    }
    return null;
  }

  console.log("Preparing database for atomic Excel injection...");

  // Atomic database transaction
  await prisma.$transaction(async (tx) => {
    // 1. Clean existing transactions, legs, debt entries, and checkpoints to allow clean idempotent re-run
    await tx.debtLedgerEntry.deleteMany({});
    await tx.transactionLeg.deleteMany({});
    await tx.transaction.deleteMany({});
    await tx.vaultCheckpoint.deleteMany({});
    
    // Reset card habit stats
    await tx.cardHabitStats.updateMany({
      data: {
        totalUses: 0,
        hourCountsJson: "[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]",
        dowCountsJson: "[0,0,0,0,0,0,0]",
        lastUsedTimestamp: null,
        lastUsedDate: null,
        mostFrequentAmount: null,
      },
    });

    // Reset vault current balances to 0
    await tx.vault.updateMany({
      data: { currentBalance: new Decimal(0) },
    });

    // Reset party balances to 0
    await tx.party.updateMany({
      data: {
        netReceivableBalance: new Decimal(0),
        receivableBalance: new Decimal(0),
        payableBalance: new Decimal(0),
        heldFundBalance: new Decimal(0),
      },
    });

    // In-memory running balance trackers
    const vaultBalances = {};
    vaults.forEach((v) => {
      vaultBalances[v.id] = new Decimal(0);
    });

    let runningTotalWealth = new Decimal(0);
    const cardUsageMap = {};

    console.log("- Injecting transactions chronologically...");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = row.nama || `Transaction ${i + 1}`;
      const debitIn = toDecimal(row.debit);
      const creditOut = toDecimal(row.kredit);
      const targetVault = resolveVault(row.penyimpanan);
      const party = resolveParty(row.peran);
      const { category, nature, commitmentType, priorityTier } = resolveCategory(row);
      const actionCard = resolveActionCard(title);

      const parsedTime = row.timestamp ? parseExcelSerial(row.timestamp) : parseExcelSerial(row.tanggal || "46131.0");

      // Calculate gross amount
      let grossDec = new Decimal(0);
      if (debitIn.greaterThan(0)) {
        grossDec = debitIn;
      } else {
        grossDec = creditOut;
      }

      // Rule 15: Strict Consume Invariant
      let consumeDec = new Decimal(0);
      let incomeDec = new Decimal(0);

      if (nature === "EXPENSE" && party.partyType === "SELF") {
        consumeDec = grossDec.negated();
      } else if (nature === "INCOME") {
        incomeDec = grossDec;
      }

      // Mutate vault running balance
      const currentVBal = vaultBalances[targetVault.id] || new Decimal(0);
      let newVBal = currentVBal;

      if (nature === "INITIAL_FUND" || nature === "INCOME" || nature === "RECEIVABLE_COLLECT") {
        newVBal = currentVBal.plus(grossDec);
        runningTotalWealth = runningTotalWealth.plus(grossDec);
      } else if (nature === "EXPENSE" || nature === "RECEIVABLE_LEND") {
        newVBal = currentVBal.minus(grossDec);
        runningTotalWealth = runningTotalWealth.minus(grossDec);
      }
      vaultBalances[targetVault.id] = newVBal;

      // 1. Create Transaction
      const createdTx = await tx.transaction.create({
        data: {
          transactionDate: parsedTime.date,
          transactionTime: parsedTime.timeString,
          monthTag: parsedTime.monthTag,
          title,
          nature,
          categoryId: category ? category.id : null,
          commitmentType,
          priorityTier,
          partyId: party.id,
          actionCardId: actionCard ? actionCard.id : null,
          grossAmount: grossDec,
          consumeAmount: consumeDec,
          incomeAmount: incomeDec,
          isBackdated: false,
          notes: row.keterangan || (nature === "INITIAL_FUND" ? "Pencatatan saldo awal" : null),
        },
      });

      // 2. Create Primary Transaction Leg
      await tx.transactionLeg.create({
        data: {
          transactionId: createdTx.id,
          vaultId: targetVault.id,
          legRole: "PRIMARY",
          debitIn: debitIn,
          creditOut: creditOut,
          netMutation: debitIn.minus(creditOut),
          runningVaultBalance: newVBal,
          runningTotalWealth: runningTotalWealth,
        },
      });

      // 3. Handle Debt Ledger Entries for Receivables (Piutang)
      if (nature === "RECEIVABLE_LEND") {
        await tx.debtLedgerEntry.create({
          data: {
            transactionId: createdTx.id,
            partyId: party.id,
            entryCategory: "RECEIVABLE",
            direction: "INCREASE",
            settlementMethod: "CASH_OR_BANK",
            amount: grossDec,
            remainingOpenAmount: grossDec,
            status: "OPEN",
          },
        });

        await tx.party.update({
          where: { id: party.id },
          data: {
            netReceivableBalance: { increment: grossDec },
            receivableBalance: { increment: grossDec },
          },
        });
      } else if (nature === "RECEIVABLE_COLLECT") {
        // Settle oldest open receivable entry for this party (FIFO)
        const openItem = await tx.debtLedgerEntry.findFirst({
          where: {
            partyId: party.id,
            entryCategory: "RECEIVABLE",
            direction: "INCREASE",
            remainingOpenAmount: { gt: 0 },
          },
          orderBy: { id: "asc" },
        });

        if (openItem) {
          const prevOpen = new Decimal(openItem.remainingOpenAmount);
          const nextOpen = prevOpen.greaterThan(grossDec) ? prevOpen.minus(grossDec) : new Decimal(0);
          await tx.debtLedgerEntry.update({
            where: { id: openItem.id },
            data: {
              remainingOpenAmount: nextOpen,
              status: nextOpen.isZero() ? "SETTLED" : "PARTIAL",
            },
          });
        }

        await tx.debtLedgerEntry.create({
          data: {
            transactionId: createdTx.id,
            partyId: party.id,
            entryCategory: "RECEIVABLE",
            direction: "DECREASE",
            settlementMethod: "CASH_OR_BANK",
            amount: grossDec,
            referenceDebtId: openItem ? openItem.id : null,
            remainingOpenAmount: new Decimal(0),
            status: "SETTLED",
          },
        });

        await tx.party.update({
          where: { id: party.id },
          data: {
            netReceivableBalance: { decrement: grossDec },
            receivableBalance: { decrement: grossDec },
          },
        });
      }

      // 4. Initial Fund Checkpoint
      if (nature === "INITIAL_FUND") {
        await tx.vaultCheckpoint.create({
          data: {
            vaultId: targetVault.id,
            checkpointTimestamp: parsedTime.date,
            checkpointDate: parsedTime.date,
            periodLabel: `Awal (${parsedTime.monthTag})`,
            checkpointType: "INITIAL_FUND",
            originalCountedAmount: newVBal,
            retroactiveDeductionTotal: new Decimal(0),
            effectiveAnchorAmount: newVBal,
            systemBookBalanceBefore: new Decimal(0),
            rawDiscrepancyAmount: new Decimal(0),
            notes: `Initial baseline audit for ${targetVault.name}`,
          },
        });
      }

      // 5. Track Card Usage for Habit Stats
      if (actionCard) {
        if (!cardUsageMap[actionCard.id]) {
          cardUsageMap[actionCard.id] = {
            cardId: actionCard.id,
            count: 0,
            amounts: [],
            lastUsed: parsedTime.date,
          };
        }
        cardUsageMap[actionCard.id].count += 1;
        cardUsageMap[actionCard.id].amounts.push(grossDec);
        if (parsedTime.date > cardUsageMap[actionCard.id].lastUsed) {
          cardUsageMap[actionCard.id].lastUsed = parsedTime.date;
        }
      }
    }

    // 6. Update Final Balances for Vaults
    for (const [vaultId, balance] of Object.entries(vaultBalances)) {
      await tx.vault.update({
        where: { id: parseInt(vaultId, 10) },
        data: { currentBalance: balance },
      });
    }

    // 7. Seed / Update Habit Statistics
    for (const cardUsage of Object.values(cardUsageMap)) {
      const sumAmount = cardUsage.amounts.reduce((acc, curr) => acc.plus(curr), new Decimal(0));
      const avgAmount = sumAmount.dividedBy(cardUsage.count).toDecimalPlaces(2);

      await tx.cardHabitStats.upsert({
        where: { cardId: cardUsage.cardId },
        update: {
          totalUses: cardUsage.count,
          lastUsedTimestamp: cardUsage.lastUsed,
          lastUsedDate: cardUsage.lastUsed,
          mostFrequentAmount: avgAmount,
        },
        create: {
          cardId: cardUsage.cardId,
          totalUses: cardUsage.count,
          lastUsedTimestamp: cardUsage.lastUsed,
          lastUsedDate: cardUsage.lastUsed,
          mostFrequentAmount: avgAmount,
        },
      });
    }
  });

  // Verification & Output Summary
  const updatedVaults = await prisma.vault.findMany({
    where: { currentBalance: { not: 0 } },
    orderBy: { currentBalance: "desc" },
  });

  const allVaults = await prisma.vault.findMany();
  const totalNetWealth = allVaults.reduce((acc, v) => acc.plus(new Decimal(v.currentBalance)), new Decimal(0));

  const totalTxCount = await prisma.transaction.count();
  const totalLegsCount = await prisma.transactionLeg.count();
  const openReceivables = await prisma.party.findMany({
    where: { netReceivableBalance: { gt: 0 } },
  });

  console.log("\n==================================================");
  console.log("             INJECTION SUCCESSFUL!                ");
  console.log("==================================================");
  console.log(`- Transactions Injected   : ${totalTxCount}`);
  console.log(`- Transaction Legs Created: ${totalLegsCount}`);
  console.log(`- Total Liquid Wealth     : Rp ${totalNetWealth.toNumber().toLocaleString("id-ID", { minimumFractionDigits: 2 })}`);
  console.log("\nVault Balances:");
  updatedVaults.forEach((v) => {
    const balNum = new Decimal(v.currentBalance).toNumber();
    console.log(`  • ${v.name.padEnd(25)}: Rp ${balNum.toLocaleString("id-ID", { minimumFractionDigits: 2 })}`);
  });

  console.log("\nActive Receivables (Piutang):");
  openReceivables.forEach((p) => {
    const recNum = new Decimal(p.netReceivableBalance).toNumber();
    console.log(`  • ${p.name.padEnd(25)}: Rp ${recNum.toLocaleString("id-ID", { minimumFractionDigits: 2 })}`);
  });
  console.log("==================================================\n");
}

main()
  .catch((e) => {
    console.error("Error during Excel injection:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
