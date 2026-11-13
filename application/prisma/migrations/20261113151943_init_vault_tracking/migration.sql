-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vaults" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vaultType" TEXT NOT NULL,
    "currentBalance" DECIMAL NOT NULL DEFAULT 0,
    "hasSubContainers" BOOLEAN NOT NULL DEFAULT false,
    "hasDenominations" BOOLEAN NOT NULL DEFAULT false,
    "iconName" TEXT,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vault_sub_containers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastCountedBalance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vault_sub_containers_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" TEXT,
    "partyType" TEXT NOT NULL,
    "netReceivableBalance" DECIMAL NOT NULL DEFAULT 0,
    "heldFundBalance" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parentId" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultNature" TEXT NOT NULL,
    "commitmentType" TEXT NOT NULL,
    "priorityTier" TEXT NOT NULL,
    "countsAsConsume" BOOLEAN NOT NULL DEFAULT true,
    "coaCode" TEXT NOT NULL,
    "iconName" TEXT,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "action_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "cardActionType" TEXT NOT NULL,
    "defaultVaultId" INTEGER,
    "targetVaultId" INTEGER,
    "defaultCategoryId" INTEGER,
    "defaultPartyId" INTEGER,
    "defaultAmount" DECIMAL,
    "quickAmountsJson" TEXT,
    "oneTapSubmit" BOOLEAN NOT NULL DEFAULT false,
    "expectedCadence" TEXT,
    "pinPriority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "card_habit_stats" (
    "cardId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "hourCountsJson" TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
    "dowCountsJson" TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0]',
    "avgIntervalDays" REAL,
    "stdIntervalDays" REAL,
    "lastUsedTimestamp" DATETIME,
    "lastUsedDate" DATETIME,
    "mostFrequentAmount" DECIMAL,
    "mostFrequentVaultId" INTEGER,
    CONSTRAINT "card_habit_stats_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "action_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vault_checkpoints" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "vault_checkpoints_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checkpoint_denominations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checkpointId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitValue" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "checkpoint_denominations_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "vault_checkpoints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
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
    "grossAmount" DECIMAL NOT NULL,
    "consumeAmount" DECIMAL NOT NULL,
    "incomeAmount" DECIMAL NOT NULL,
    "isBackdated" BOOLEAN NOT NULL DEFAULT false,
    "linkedCheckpointId" INTEGER,
    "proofFilePath" TEXT,
    "notes" TEXT,
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_linkedCheckpointId_fkey" FOREIGN KEY ("linkedCheckpointId") REFERENCES "vault_checkpoints" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transaction_legs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" INTEGER NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "legRole" TEXT NOT NULL,
    "debitIn" DECIMAL NOT NULL DEFAULT 0,
    "creditOut" DECIMAL NOT NULL DEFAULT 0,
    "netMutation" DECIMAL NOT NULL,
    "runningVaultBalance" DECIMAL NOT NULL,
    "runningTotalWealth" DECIMAL NOT NULL,
    CONSTRAINT "transaction_legs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_legs_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debt_ledger_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "debt_ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debt_ledger_entries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "debt_ledger_entries_referenceDebtId_fkey" FOREIGN KEY ("referenceDebtId") REFERENCES "debt_ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pending_reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "pending_reminders_suggestedVaultId_fkey" FOREIGN KEY ("suggestedVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_suggestedPartyId_fkey" FOREIGN KEY ("suggestedPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pending_reminders_convertedTransactionId_fkey" FOREIGN KEY ("convertedTransactionId") REFERENCES "transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "vaults_code_key" ON "vaults"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vault_sub_containers_vaultId_code_key" ON "vault_sub_containers"("vaultId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "parties_code_key" ON "parties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "transactions_monthTag_idx" ON "transactions"("monthTag");

-- CreateIndex
CREATE INDEX "transactions_nature_idx" ON "transactions"("nature");

-- CreateIndex
CREATE INDEX "transaction_legs_transactionId_idx" ON "transaction_legs"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_legs_vaultId_idx" ON "transaction_legs"("vaultId");

-- CreateIndex
CREATE INDEX "debt_ledger_entries_partyId_idx" ON "debt_ledger_entries"("partyId");

-- CreateIndex
CREATE INDEX "debt_ledger_entries_status_idx" ON "debt_ledger_entries"("status");
