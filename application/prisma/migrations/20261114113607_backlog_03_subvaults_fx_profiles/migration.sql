-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "baseCurrency" TEXT NOT NULL DEFAULT 'IDR',
    "fxSyncIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "lastFxSyncedAt" DATETIME,
    "lastFxStatus" TEXT,
    "lastFxError" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exchange_rate_cache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "rateDate" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FRANKFURTER_V2',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_action_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "cardActionType" TEXT NOT NULL,
    "defaultVaultId" INTEGER,
    "defaultSubContainerId" INTEGER,
    "targetVaultId" INTEGER,
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
    CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultSubContainerId_fkey" FOREIGN KEY ("defaultSubContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_action_cards" ("cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt", "visibilityMode") SELECT "cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt", "visibilityMode" FROM "action_cards";
DROP TABLE "action_cards";
ALTER TABLE "new_action_cards" RENAME TO "action_cards";
CREATE TABLE "new_transaction_legs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "transaction_legs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_subContainerId_fkey" FOREIGN KEY ("subContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transaction_legs" ("creditOut", "debitIn", "id", "legRole", "netMutation", "runningTotalWealth", "runningVaultBalance", "transactionId", "vaultId") SELECT "creditOut", "debitIn", "id", "legRole", "netMutation", "runningTotalWealth", "runningVaultBalance", "transactionId", "vaultId" FROM "transaction_legs";
DROP TABLE "transaction_legs";
ALTER TABLE "new_transaction_legs" RENAME TO "transaction_legs";
CREATE INDEX "transaction_legs_transactionId_idx" ON "transaction_legs"("transactionId");
CREATE INDEX "transaction_legs_vaultId_idx" ON "transaction_legs"("vaultId");
CREATE INDEX "transaction_legs_subContainerId_idx" ON "transaction_legs"("subContainerId");
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_linkedCheckpointId_fkey" FOREIGN KEY ("linkedCheckpointId") REFERENCES "vault_checkpoints" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("actionCardId", "categoryId", "commitmentType", "consumeAmount", "counterpartyAccountNote", "createdAt", "grossAmount", "id", "incomeAmount", "isBackdated", "linkedCheckpointId", "monthTag", "nature", "notes", "parentTransactionId", "partyId", "priorityTier", "proofFilePath", "title", "transactionDate", "transactionTime") SELECT "actionCardId", "categoryId", "commitmentType", "consumeAmount", "counterpartyAccountNote", "createdAt", "grossAmount", "id", "incomeAmount", "isBackdated", "linkedCheckpointId", "monthTag", "nature", "notes", "parentTransactionId", "partyId", "priorityTier", "proofFilePath", "title", "transactionDate", "transactionTime" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");
CREATE INDEX "transactions_monthTag_idx" ON "transactions"("monthTag");
CREATE INDEX "transactions_nature_idx" ON "transactions"("nature");
CREATE TABLE "new_vault_sub_containers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentBalance" DECIMAL NOT NULL DEFAULT 0,
    "lastCountedBalance" DECIMAL NOT NULL DEFAULT 0,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vault_sub_containers_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vault_sub_containers" ("code", "createdAt", "id", "lastCountedBalance", "name", "updatedAt", "vaultId") SELECT "code", "createdAt", "id", "lastCountedBalance", "name", "updatedAt", "vaultId" FROM "vault_sub_containers";
DROP TABLE "vault_sub_containers";
ALTER TABLE "new_vault_sub_containers" RENAME TO "vault_sub_containers";
CREATE UNIQUE INDEX "vault_sub_containers_vaultId_code_key" ON "vault_sub_containers"("vaultId", "code");
CREATE TABLE "new_vaults" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_vaults" ("code", "colorHex", "createdAt", "currentBalance", "hasDenominations", "hasSubContainers", "iconName", "id", "isActive", "name", "sortOrder", "updatedAt", "vaultType") SELECT "code", "colorHex", "createdAt", "currentBalance", "hasDenominations", "hasSubContainers", "iconName", "id", "isActive", "name", "sortOrder", "updatedAt", "vaultType" FROM "vaults";
DROP TABLE "vaults";
ALTER TABLE "new_vaults" RENAME TO "vaults";
CREATE UNIQUE INDEX "vaults_code_key" ON "vaults"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_cache_baseCurrency_quoteCurrency_key" ON "exchange_rate_cache"("baseCurrency", "quoteCurrency");
