// Database seed script for Vault Tracking v2.0 (Multi-User Architecture)
// Seeds the global Master Category Catalog and ensures the initial ADMIN account exists.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const masterCatalog = require("./master-catalog.json");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Vault Tracking v2.0 database seeding...");

  // 1. Seed Global Master Category Templates
  const templates = masterCatalog.categories || [];
  for (const tpl of templates) {
    await prisma.masterCategoryTemplate.upsert({
      where: { code: tpl.code },
      update: {
        moduleKey: tpl.moduleKey,
        name: tpl.name,
        description: tpl.description || null,
        defaultNature: tpl.defaultNature,
        commitmentType: tpl.commitmentType,
        priorityTier: tpl.priorityTier,
        countsAsConsume: Boolean(tpl.countsAsConsume),
        coaCode: tpl.coaCode,
        iconName: tpl.iconName || null,
        colorHex: tpl.colorHex || null,
        isSystemLocked: Boolean(tpl.isSystemLocked),
        sortOrder: tpl.sortOrder || 0,
      },
      create: {
        code: tpl.code,
        moduleKey: tpl.moduleKey,
        name: tpl.name,
        description: tpl.description || null,
        defaultNature: tpl.defaultNature,
        commitmentType: tpl.commitmentType,
        priorityTier: tpl.priorityTier,
        countsAsConsume: Boolean(tpl.countsAsConsume),
        coaCode: tpl.coaCode,
        iconName: tpl.iconName || null,
        colorHex: tpl.colorHex || null,
        isSystemLocked: Boolean(tpl.isSystemLocked),
        sortOrder: tpl.sortOrder || 0,
      },
    });
  }
  console.log(`- Synced ${templates.length} MasterCategoryTemplate rows`);

  // 2. Ensure initial ADMIN account exists cleanly (starts fresh at onboarding)
  const initialUsername =
    process.env.INITIAL_ADMIN_USERNAME ||
    process.env.SEED_ADMIN_USERNAME ||
    "admin";
  const initialPassword =
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.SEED_ADMIN_PASSWORD ||
    "admin123";
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { username: initialUsername },
    update: {
      role: "ADMIN",
      isActive: true,
    },
    create: {
      username: initialUsername,
      passwordHash,
      fullName: "Isa Tarmana",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
      onboardingCompleted: false,
      onboardingSkipped: false,
    },
  });

  // Ensure per-user AppSetting row exists
  await prisma.appSetting.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      baseCurrency: "IDR",
    },
  });

  console.log(
    `- Initial ADMIN account ready: username="${adminUser.username}" (fresh onboarding pending)`,
  );
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
