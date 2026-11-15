/*
  Warnings:

  - You are about to drop the column `heldFundBalance` on the `parties` table. All the data in the column will be lost.
  - Added the required column `userId` to the `action_cards` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `app_settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `debt_ledger_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `parties` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `pending_reminders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `transaction_legs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `vault_checkpoints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `vaults` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "master_category_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultNature" TEXT NOT NULL,
    "commitmentType" TEXT NOT NULL,
    "priorityTier" TEXT NOT NULL,
    "countsAsConsume" BOOLEAN NOT NULL DEFAULT true,
    "coaCode" TEXT NOT NULL,
    "iconName" TEXT,
    "colorHex" TEXT,
    "isSystemLocked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_action_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "cardActionType" TEXT NOT NULL,
    "defaultVaultId" INTEGER,
    "defaultSubContainerId" INTEGER,
    "targetVaultId" INTEGER,
    "targetSubContainerId" INTEGER,
    "defaultCategoryId" INTEGER,
    "defaultPartyId" INTEGER,
    "defaultAmount" DECIMAL,
    "quickAmountsJson" TEXT,
    "oneTapSubmit" BOOLEAN NOT NULL DEFAULT false,
    "expectedCadence" TEXT,
    "pinPriority" INTEGER NOT NULL DEFAULT 0,
    "visibilityMode" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "action_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultSubContainerId_fkey" FOREIGN KEY ("defaultSubContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetSubContainerId_fkey" FOREIGN KEY ("targetSubContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_action_cards" ("cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultSubContainerId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetSubContainerId", "targetVaultId", "title", "updatedAt", "visibilityMode") SELECT "cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultSubContainerId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetSubContainerId", "targetVaultId", "title", "updatedAt", "visibilityMode" FROM "action_cards";
DROP TABLE "action_cards";
ALTER TABLE "new_action_cards" RENAME TO "action_cards";
CREATE INDEX "action_cards_userId_idx" ON "action_cards"("userId");
CREATE TABLE "new_app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'IDR',
    "fxSyncIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "lastFxSyncedAt" DATETIME,
    "lastFxStatus" TEXT,
    "lastFxError" TEXT,
    "dismissedCardSuggestionsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "app_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_app_settings" ("baseCurrency", "dismissedCardSuggestionsJson", "fxSyncIntervalDays", "id", "lastFxError", "lastFxStatus", "lastFxSyncedAt", "updatedAt") SELECT "baseCurrency", "dismissedCardSuggestionsJson", "fxSyncIntervalDays", "id", "lastFxError", "lastFxStatus", "lastFxSyncedAt", "updatedAt" FROM "app_settings";
DROP TABLE "app_settings";
ALTER TABLE "new_app_settings" RENAME TO "app_settings";
CREATE UNIQUE INDEX "app_settings_userId_key" ON "app_settings"("userId");
CREATE TABLE "new_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "code" TEXT NOT NULL,
    "templateCode" TEXT,
    "name" TEXT NOT NULL,
    "defaultNature" TEXT NOT NULL,
    "commitmentType" TEXT NOT NULL,
    "priorityTier" TEXT NOT NULL,
    "countsAsConsume" BOOLEAN NOT NULL DEFAULT true,
    "coaCode" TEXT NOT NULL,
    "iconName" TEXT,
    "colorHex" TEXT,
    "isSystemLocked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_categories" ("coaCode", "code", "colorHex", "commitmentType", "countsAsConsume", "createdAt", "defaultNature", "iconName", "id", "isActive", "name", "parentId", "priorityTier", "sortOrder", "updatedAt") SELECT "coaCode", "code", "colorHex", "commitmentType", "countsAsConsume", "createdAt", "defaultNature", "iconName", "id", "isActive", "name", "parentId", "priorityTier", "sortOrder", "updatedAt" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE INDEX "categories_userId_idx" ON "categories"("userId");
CREATE UNIQUE INDEX "categories_userId_code_key" ON "categories"("userId", "code");
CREATE TABLE "new_debt_ledger_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "entryCategory" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "settlementMethod" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "referenceDebtId" INTEGER,
    "remainingOpenAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debt_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "debt_ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debt_ledger_entries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "debt_ledger_entries_referenceDebtId_fkey" FOREIGN KEY ("referenceDebtId") REFERENCES "debt_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_debt_ledger_entries" ("amount", "createdAt", "direction", "entryCategory", "id", "notes", "partyId", "referenceDebtId", "remainingOpenAmount", "settlementMethod", "status", "transactionId") SELECT "amount", "createdAt", "direction", "entryCategory", "id", "notes", "partyId", "referenceDebtId", "remainingOpenAmount", "settlementMethod", "status", "transactionId" FROM "debt_ledger_entries";
DROP TABLE "debt_ledger_entries";
ALTER TABLE "new_debt_ledger_entries" RENAME TO "debt_ledger_entries";
CREATE INDEX "debt_ledger_entries_userId_partyId_idx" ON "debt_ledger_entries"("userId", "partyId");
CREATE INDEX "debt_ledger_entries_userId_status_idx" ON "debt_ledger_entries"("userId", "status");
CREATE TABLE "new_parties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" TEXT,
    "partyType" TEXT NOT NULL,
    "netReceivableBalance" DECIMAL NOT NULL DEFAULT 0,
    "receivableBalance" DECIMAL NOT NULL DEFAULT 0,
    "payableBalance" DECIMAL NOT NULL DEFAULT 0,
    "externalAccountsJson" TEXT,
    "isDebtContact" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "parties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_parties" ("aliasesJson", "code", "createdAt", "externalAccountsJson", "id", "isActive", "isDebtContact", "name", "netReceivableBalance", "partyType", "payableBalance", "receivableBalance", "updatedAt") SELECT "aliasesJson", "code", "createdAt", "externalAccountsJson", "id", "isActive", "isDebtContact", "name", "netReceivableBalance", "partyType", "payableBalance", "receivableBalance", "updatedAt" FROM "parties";
DROP TABLE "parties";
ALTER TABLE "new_parties" RENAME TO "parties";
CREATE INDEX "parties_userId_idx" ON "parties"("userId");
CREATE UNIQUE INDEX "parties_userId_code_key" ON "parties"("userId", "code");
CREATE TABLE "new_pending_reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "reminderType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedAmount" DECIMAL,
    "suggestedVaultId" INTEGER,
    "suggestedPartyId" INTEGER,
    "suggestedCategoryId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "convertedTransactionId" INTEGER,
    "notes" TEXT,
    CONSTRAINT "pending_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_suggestedVaultId_fkey" FOREIGN KEY ("suggestedVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_suggestedPartyId_fkey" FOREIGN KEY ("suggestedPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_convertedTransactionId_fkey" FOREIGN KEY ("convertedTransactionId") REFERENCES "transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pending_reminders" ("convertedTransactionId", "createdAt", "dueDate", "estimatedAmount", "id", "notes", "reminderType", "status", "suggestedCategoryId", "suggestedPartyId", "suggestedVaultId", "title") SELECT "convertedTransactionId", "createdAt", "dueDate", "estimatedAmount", "id", "notes", "reminderType", "status", "suggestedCategoryId", "suggestedPartyId", "suggestedVaultId", "title" FROM "pending_reminders";
DROP TABLE "pending_reminders";
ALTER TABLE "new_pending_reminders" RENAME TO "pending_reminders";
CREATE INDEX "pending_reminders_userId_status_idx" ON "pending_reminders"("userId", "status");
CREATE TABLE "new_transaction_legs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "subContainerId" INTEGER,
    "legRole" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "fxRateApplied" DECIMAL NOT NULL DEFAULT 1,
    "originalMutation" DECIMAL,
    "debitIn" DECIMAL NOT NULL DEFAULT 0,
    "creditOut" DECIMAL NOT NULL DEFAULT 0,
    "netMutation" DECIMAL NOT NULL,
    "runningVaultBalance" DECIMAL NOT NULL,
    "runningTotalWealth" DECIMAL NOT NULL,
    CONSTRAINT "transaction_legs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_subContainerId_fkey" FOREIGN KEY ("subContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transaction_legs" ("creditOut", "currency", "debitIn", "fxRateApplied", "id", "legRole", "netMutation", "originalMutation", "runningTotalWealth", "runningVaultBalance", "subContainerId", "transactionId", "vaultId") SELECT "creditOut", "currency", "debitIn", "fxRateApplied", "id", "legRole", "netMutation", "originalMutation", "runningTotalWealth", "runningVaultBalance", "subContainerId", "transactionId", "vaultId" FROM "transaction_legs";
DROP TABLE "transaction_legs";
ALTER TABLE "new_transaction_legs" RENAME TO "transaction_legs";
CREATE INDEX "transaction_legs_userId_vaultId_idx" ON "transaction_legs"("userId", "vaultId");
CREATE INDEX "transaction_legs_transactionId_idx" ON "transaction_legs"("transactionId");
CREATE INDEX "transaction_legs_vaultId_idx" ON "transaction_legs"("vaultId");
CREATE INDEX "transaction_legs_subContainerId_idx" ON "transaction_legs"("subContainerId");
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionDate" DATETIME NOT NULL,
    "transactionTime" TEXT NOT NULL,
    "monthTag" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "categoryId" INTEGER,
    "commitmentType" TEXT NOT NULL,
    "priorityTier" TEXT NOT NULL,
    "partyId" INTEGER NOT NULL,
    "actionCardId" INTEGER,
    "parentTransactionId" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "originalGrossAmount" DECIMAL,
    "fxRateApplied" DECIMAL NOT NULL DEFAULT 1,
    "grossAmount" DECIMAL NOT NULL,
    "consumeAmount" DECIMAL NOT NULL,
    "incomeAmount" DECIMAL NOT NULL,
    "isBackdated" BOOLEAN NOT NULL DEFAULT false,
    "subVaultWarning" BOOLEAN NOT NULL DEFAULT false,
    "linkedCheckpointId" INTEGER,
    "counterpartyAccountNote" TEXT,
    "proofFilePath" TEXT,
    "notes" TEXT,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_linkedCheckpointId_fkey" FOREIGN KEY ("linkedCheckpointId") REFERENCES "vault_checkpoints" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("actionCardId", "categoryId", "commitmentType", "consumeAmount", "counterpartyAccountNote", "createdAt", "currency", "fxRateApplied", "grossAmount", "id", "incomeAmount", "isBackdated", "linkedCheckpointId", "monthTag", "nature", "notes", "originalGrossAmount", "parentTransactionId", "partyId", "priorityTier", "proofFilePath", "subVaultWarning", "title", "transactionDate", "transactionTime") SELECT "actionCardId", "categoryId", "commitmentType", "consumeAmount", "counterpartyAccountNote", "createdAt", "currency", "fxRateApplied", "grossAmount", "id", "incomeAmount", "isBackdated", "linkedCheckpointId", "monthTag", "nature", "notes", "originalGrossAmount", "parentTransactionId", "partyId", "priorityTier", "proofFilePath", "subVaultWarning", "title", "transactionDate", "transactionTime" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_userId_transactionDate_idx" ON "transactions"("userId", "transactionDate");
CREATE INDEX "transactions_userId_monthTag_idx" ON "transactions"("userId", "monthTag");
CREATE INDEX "transactions_userId_nature_idx" ON "transactions"("userId", "nature");
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "onboardingProfileJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "fullName", "id", "passwordHash", "role", "updatedAt", "username") SELECT "createdAt", "fullName", "id", "passwordHash", "role", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE TABLE "new_vault_checkpoints" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "checkpointTimestamp" DATETIME NOT NULL,
    "checkpointDate" DATETIME NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "checkpointType" TEXT NOT NULL,
    "originalCountedAmount" DECIMAL NOT NULL,
    "retroactiveDeductionTotal" DECIMAL NOT NULL DEFAULT 0,
    "effectiveAnchorAmount" DECIMAL NOT NULL,
    "systemBookBalanceBefore" DECIMAL NOT NULL DEFAULT 0,
    "rawDiscrepancyAmount" DECIMAL NOT NULL DEFAULT 0,
    "resolvedDiscrepancyAmount" DECIMAL NOT NULL DEFAULT 0,
    "unexplainedDiscrepancyAmount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_checkpoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vault_checkpoints_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vault_checkpoints" ("checkpointDate", "checkpointTimestamp", "checkpointType", "createdAt", "effectiveAnchorAmount", "id", "notes", "originalCountedAmount", "periodLabel", "rawDiscrepancyAmount", "resolvedDiscrepancyAmount", "retroactiveDeductionTotal", "systemBookBalanceBefore", "unexplainedDiscrepancyAmount", "vaultId") SELECT "checkpointDate", "checkpointTimestamp", "checkpointType", "createdAt", "effectiveAnchorAmount", "id", "notes", "originalCountedAmount", "periodLabel", "rawDiscrepancyAmount", "resolvedDiscrepancyAmount", "retroactiveDeductionTotal", "systemBookBalanceBefore", "unexplainedDiscrepancyAmount", "vaultId" FROM "vault_checkpoints";
DROP TABLE "vault_checkpoints";
ALTER TABLE "new_vault_checkpoints" RENAME TO "vault_checkpoints";
CREATE INDEX "vault_checkpoints_userId_vaultId_idx" ON "vault_checkpoints"("userId", "vaultId");
CREATE TABLE "new_vaults" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vaultType" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL DEFAULT 0,
    "hasSubContainers" BOOLEAN NOT NULL DEFAULT false,
    "hasDenominations" BOOLEAN NOT NULL DEFAULT false,
    "symbolMode" TEXT NOT NULL DEFAULT 'INITIALS',
    "iconName" TEXT,
    "profileImageUrl" TEXT,
    "colorHex" TEXT,
    "subVaultOutOfSync" BOOLEAN NOT NULL DEFAULT false,
    "subVaultSyncNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vaults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vaults" ("code", "colorHex", "createdAt", "currentBalance", "hasDenominations", "hasSubContainers", "iconName", "id", "isActive", "name", "profileImageUrl", "sortOrder", "subVaultOutOfSync", "subVaultSyncNote", "symbolMode", "updatedAt", "vaultType") SELECT "code", "colorHex", "createdAt", "currentBalance", "hasDenominations", "hasSubContainers", "iconName", "id", "isActive", "name", "profileImageUrl", "sortOrder", "subVaultOutOfSync", "subVaultSyncNote", "symbolMode", "updatedAt", "vaultType" FROM "vaults";
DROP TABLE "vaults";
ALTER TABLE "new_vaults" RENAME TO "vaults";
CREATE INDEX "vaults_userId_idx" ON "vaults"("userId");
CREATE UNIQUE INDEX "vaults_userId_code_key" ON "vaults"("userId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "master_category_templates_code_key" ON "master_category_templates"("code");

-- CreateIndex
CREATE INDEX "master_category_templates_moduleKey_idx" ON "master_category_templates"("moduleKey");
