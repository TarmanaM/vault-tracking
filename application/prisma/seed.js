// Database seed script for Vault Tracking
// Populates initial vaults, parties, 3-tier categories, and habit action cards

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Vault Tracking database seeding...");

  // 1. Default Admin User
  const defaultPasswordHash = await bcrypt.hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { username: "isa" },
    update: {},
    create: {
      username: "isa",
      passwordHash: defaultPasswordHash,
      fullName: "Isa Tarmana",
      role: "OWNER",
    },
  });
  console.log(`- User created: ${user.username}`);

  // 2. Vaults (Storage Accounts)
  const vaultsData = [
    { code: "BCA", name: "Bank BCA", vaultType: "BANK", colorHex: "#0060AF", sortOrder: 1 },
    { code: "NOBU", name: "Bank Nobu", vaultType: "BANK", colorHex: "#E31E24", sortOrder: 2 },
    { code: "MANDIRI", name: "Bank Mandiri", vaultType: "BANK", colorHex: "#003366", sortOrder: 3 },
    { code: "JAGO", name: "Bank Jago", vaultType: "BANK", colorHex: "#FF8000", sortOrder: 4 },
    { code: "GOPAY", name: "GoPay", vaultType: "EWALLET", colorHex: "#00AED6", sortOrder: 5 },
    { code: "SPAY", name: "ShopeePay", vaultType: "EWALLET", colorHex: "#EE4D2D", sortOrder: 6 },
    { code: "DANA", name: "DANA", vaultType: "EWALLET", colorHex: "#118EEA", sortOrder: 7 },
    { code: "CASH", name: "Dompet Cash", vaultType: "PHYSICAL_CASH", colorHex: "#10B981", hasSubContainers: true, sortOrder: 8 },
    { code: "COIN", name: "Celengan Koin", vaultType: "PHYSICAL_COIN", colorHex: "#F59E0B", hasDenominations: true, sortOrder: 9 },
    { code: "TASPEN", name: "Taspen (Pool Dana Tertahan)", vaultType: "HELD_POOL", colorHex: "#6366F1", sortOrder: 10 },
    { code: "SPAYLATER", name: "Shopee PayLater", vaultType: "LIABILITY_CREDIT_LINE", colorHex: "#E11D48", sortOrder: 11 },
  ];

  const vaultMap = {};
  for (const v of vaultsData) {
    const createdVault = await prisma.vault.upsert({
      where: { code: v.code },
      update: v,
      create: v,
    });
    vaultMap[v.code] = createdVault;
  }
  console.log(`- Seeded ${Object.keys(vaultMap).length} vaults`);

  // Sub-containers for CASH (D1 and D2 wallets from user's Excel)
  await prisma.vaultSubContainer.upsert({
    where: { vaultId_code: { vaultId: vaultMap["CASH"].id, code: "D1" } },
    update: { name: "Dompet D1 (Utama)" },
    create: { vaultId: vaultMap["CASH"].id, code: "D1", name: "Dompet D1 (Utama)" },
  });
  await prisma.vaultSubContainer.upsert({
    where: { vaultId_code: { vaultId: vaultMap["CASH"].id, code: "D2" } },
    update: { name: "Dompet D2 (Cadangan)" },
    create: { vaultId: vaultMap["CASH"].id, code: "D2", name: "Dompet D2 (Cadangan)" },
  });
  console.log("- Seeded Cash Sub-containers (D1 & D2)");

  // 3. Parties (Counterparties & Roles)
  const partiesData = [
    { code: "ISA", name: "Isa", partyType: "SELF", isDebtContact: false, aliasesJson: '["Self", "Saya"]' },
    { code: "IBRAHIM", name: "Ibrahim (Dada)", partyType: "FAMILY", isDebtContact: true, aliasesJson: '["Dada", "Sidada"]' },
    { code: "FERNANDO", name: "Fernando", partyType: "FRIEND", isDebtContact: true, aliasesJson: '["Nando"]' },
    { code: "SLAMET", name: "Slamet", partyType: "FRIEND", isDebtContact: true, aliasesJson: '["Amet"]' },
    { code: "DDV", name: "DDV", partyType: "EMPLOYER", isDebtContact: false, aliasesJson: '["Kantor", "Gaji"]' },
    { code: "TASPEN", name: "Taspen", partyType: "INSTITUTION", isDebtContact: false, aliasesJson: '["Dapem", "Santunan"]' },
    { code: "SHOPEE_PAYLATER", name: "Shopee PayLater", partyType: "LENDER", isDebtContact: true, aliasesJson: '["SPayLater", "Shopee"]' },
  ];

  const partyMap = {};
  for (const p of partiesData) {
    const createdParty = await prisma.party.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    partyMap[p.code] = createdParty;
  }
  console.log(`- Seeded ${Object.keys(partyMap).length} parties`);

  // 4. Categories (3-Tier Taxonomy & COA)
  const categoriesData = [
    // Mandatory & Essential
    { code: "EXP_PARKING", name: "Parkir", defaultNature: "EXPENSE", commitmentType: "FIXED_MANDATORY", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5101", iconName: "LocalParking", colorHex: "#3B82F6" },
    { code: "EXP_FUEL", name: "BBM / Bensin", defaultNature: "EXPENSE", commitmentType: "FIXED_MANDATORY", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5102", iconName: "LocalGasStation", colorHex: "#EF4444" },
    { code: "EXP_TRANSPORT", name: "Transportasi Umum / Ojol", defaultNature: "EXPENSE", commitmentType: "VARIABLE_ESSENTIAL", priorityTier: "SEKUNDER", countsAsConsume: true, coaCode: "5103", iconName: "DirectionsBus", colorHex: "#06B6D4" },
    { code: "EXP_VEHICLE_MAINT", name: "Perawatan Kendaraan", defaultNature: "EXPENSE", commitmentType: "VARIABLE_ESSENTIAL", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5104", iconName: "Build", colorHex: "#64748B" },
    { code: "EXP_MAIN_MEAL", name: "Makan Utama", defaultNature: "EXPENSE", commitmentType: "VARIABLE_ESSENTIAL", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5201", iconName: "Restaurant", colorHex: "#F97316" },
    { code: "EXP_COMMUNICATION", name: "Komunikasi & Kuota", defaultNature: "EXPENSE", commitmentType: "FIXED_MANDATORY", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5301", iconName: "Wifi", colorHex: "#8B5CF6" },
    { code: "EXP_EDUCATION_DOC", name: "Pendidikan & Dokumen", defaultNature: "EXPENSE", commitmentType: "VARIABLE_ESSENTIAL", priorityTier: "PRIMER", countsAsConsume: true, coaCode: "5401", iconName: "School", colorHex: "#14B8A6" },

    // Discretionary / Jajan
    { code: "EXP_COFFEE", name: "Kopi & Minuman", defaultNature: "EXPENSE", commitmentType: "DISCRETIONARY_JAJAN", priorityTier: "TERSIER", countsAsConsume: true, coaCode: "6101", iconName: "Coffee", colorHex: "#D97706" },
    { code: "EXP_SNACK_CULINARY", name: "Jajan & Kuliner", defaultNature: "EXPENSE", commitmentType: "DISCRETIONARY_JAJAN", priorityTier: "TERSIER", countsAsConsume: true, coaCode: "6102", iconName: "Fastfood", colorHex: "#EC4899" },
    { code: "EXP_LIFESTYLE_HABIT", name: "Hiburan, Warnet & Rokok", defaultNature: "EXPENSE", commitmentType: "DISCRETIONARY_JAJAN", priorityTier: "TERSIER", countsAsConsume: true, coaCode: "6201", iconName: "SportsEsports", colorHex: "#A855F7" },

    // Social & Charity
    { code: "EXP_SOCIAL_CHARITY", name: "Sedekah & Sosial", defaultNature: "EXPENSE", commitmentType: "SOCIAL_CHARITY", priorityTier: "SEKUNDER", countsAsConsume: true, coaCode: "6301", iconName: "VolunteerActivism", colorHex: "#10B981" },

    // Fees & Reconciliation
    { code: "EXP_ADMIN_TAX", name: "Biaya Admin & Pajak Transaksi", defaultNature: "EXPENSE", commitmentType: "FIXED_MANDATORY", priorityTier: "SEKUNDER", countsAsConsume: true, coaCode: "6401", iconName: "ReceiptLong", colorHex: "#94A3B8" },
    { code: "EXP_CASH_LOST", name: "Uang Hilang / Selisih Kas", defaultNature: "RECONCILIATION_LOST", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "6901", iconName: "Warning", colorHex: "#DC2626" },

    // Income
    { code: "INC_SALARY", name: "Gaji Bulanan", defaultNature: "INCOME", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "4101", iconName: "Payments", colorHex: "#22C55E" },
    { code: "INC_FAMILY_GRANT", name: "Penerimaan Taspen / Keluarga", defaultNature: "INCOME", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "4201", iconName: "AccountBalanceWallet", colorHex: "#3B82F6" },
    { code: "INC_RECON_SURPLUS", name: "Bunga Bank & Selisih Lebih", defaultNature: "RECONCILIATION_FOUND", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "4901", iconName: "Savings", colorHex: "#10B981" },

    // Non-Consume Ledger Mutators
    { code: "TX_TRANSFER", name: "Pindah Dana / Mutasi", defaultNature: "TRANSFER", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "1100", iconName: "SwapHoriz", colorHex: "#64748B" },
    { code: "TX_INITIAL_FUND", name: "Dana Awal", defaultNature: "INITIAL_FUND", commitmentType: "NONE", priorityTier: "NONE", countsAsConsume: false, coaCode: "3101", iconName: "Anchor", colorHex: "#475569" },
  ];

  const categoryMap = {};
  for (const c of categoriesData) {
    const createdCategory = await prisma.category.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
    categoryMap[c.code] = createdCategory;
  }
  console.log(`- Seeded ${Object.keys(categoryMap).length} categories`);

  // 5. Initial Action Cards
  const actionCardsData = [
    {
      title: "Parkir Kantor",
      subtitle: "Rp 12.000 • BANK NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_PARKING"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 12000,
      quickAmountsJson: "[12000, 15000]",
      oneTapSubmit: true,
      expectedCadence: "DAILY_WORKDAY",
      pinPriority: 10,
    },
    {
      title: "Parkir Motor",
      subtitle: "BANK NOBU / CASH",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_PARKING"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 2000,
      quickAmountsJson: "[2000, 5000, 12000]",
      expectedCadence: "DAILY_ANY",
      pinPriority: 7,
    },
    {
      title: "Beli Bensin Skupi",
      subtitle: "Rp 38.000 • CASH",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["CASH"].id,
      defaultCategoryId: categoryMap["EXP_FUEL"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 38000,
      quickAmountsJson: "[30000, 38000, 50000]",
      expectedCadence: "WEEKLY",
      pinPriority: 9,
    },
    {
      title: "Sarapan Pagi",
      subtitle: "CASH / NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["CASH"].id,
      defaultCategoryId: categoryMap["EXP_MAIN_MEAL"].id,
      defaultPartyId: partyMap["ISA"].id,
      quickAmountsJson: "[10000, 15000, 20000]",
      expectedCadence: "DAILY_ANY",
      pinPriority: 6,
    },
    {
      title: "Makan Siang (Hokben/Warteg)",
      subtitle: "BANK NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_MAIN_MEAL"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 20550,
      quickAmountsJson: "[20550, 25000, 35000]",
      expectedCadence: "DAILY_ANY",
      pinPriority: 8,
    },
    {
      title: "Kopi Americano FM",
      subtitle: "Rp 19.500 • BANK NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_COFFEE"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 19500,
      quickAmountsJson: "[15000, 19500, 22500]",
      expectedCadence: "DAILY_ANY",
      pinPriority: 5,
    },
    {
      title: "Beli Rokok Sampoerna Mild",
      subtitle: "Rp 38.500 • BANK BCA",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["BCA"].id,
      defaultCategoryId: categoryMap["EXP_LIFESTYLE_HABIT"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 38500,
      pinPriority: 4,
    },
    {
      title: "Jajan Sate / Ayam Kulit",
      subtitle: "BANK NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_SNACK_CULINARY"].id,
      defaultPartyId: partyMap["ISA"].id,
      quickAmountsJson: "[35000, 54000, 80000]",
      pinPriority: 3,
    },
    {
      title: "Main Warnet Paradox Reg",
      subtitle: "Rp 30.000 • BANK NOBU",
      cardActionType: "EXPENSE",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["EXP_LIFESTYLE_HABIT"].id,
      defaultPartyId: partyMap["ISA"].id,
      defaultAmount: 30000,
      pinPriority: 2,
    },
    {
      title: "Gajian DDV",
      subtitle: "Rp 6.155.061 • BANK NOBU",
      cardActionType: "INCOME",
      defaultVaultId: vaultMap["NOBU"].id,
      defaultCategoryId: categoryMap["INC_SALARY"].id,
      defaultPartyId: partyMap["DDV"].id,
      defaultAmount: 6155061,
      expectedCadence: "MONTHLY",
      pinPriority: 1,
    },
  ];

  for (const ac of actionCardsData) {
    const existing = await prisma.actionCard.findFirst({ where: { title: ac.title } });
    let card;
    if (existing) {
      card = await prisma.actionCard.update({ where: { id: existing.id }, data: ac });
    } else {
      card = await prisma.actionCard.create({ data: ac });
    }

    // Initialize CardHabitStats record
    await prisma.cardHabitStats.upsert({
      where: { cardId: card.id },
      update: {},
      create: {
        cardId: card.id,
        totalUses: 0,
        hourCountsJson: "[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]",
        dowCountsJson: "[0,0,0,0,0,0,0]",
      },
    });
  }
  console.log(`- Seeded ${actionCardsData.length} Action Cards with Habit Stats`);

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

