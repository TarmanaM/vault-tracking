-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "onboardingProfileJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_category_templates" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_category_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaults" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vaultType" TEXT NOT NULL,
    "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_sub_containers" (
    "id" SERIAL NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastCountedBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_sub_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" TEXT,
    "partyType" TEXT NOT NULL,
    "netReceivableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "receivableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "externalAccountsJson" TEXT,
    "isDebtContact" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_cards" (
    "id" SERIAL NOT NULL,
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
    "defaultAmount" DECIMAL(65,30),
    "quickAmountsJson" TEXT,
    "oneTapSubmit" BOOLEAN NOT NULL DEFAULT false,
    "expectedCadence" TEXT,
    "pinPriority" INTEGER NOT NULL DEFAULT 0,
    "visibilityMode" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_habit_stats" (
    "cardId" INTEGER NOT NULL,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "hourCountsJson" TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
    "dowCountsJson" TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0]',
    "avgIntervalDays" DOUBLE PRECISION,
    "stdIntervalDays" DOUBLE PRECISION,
    "lastUsedTimestamp" TIMESTAMP(3),
    "lastUsedDate" TIMESTAMP(3),
    "mostFrequentAmount" DECIMAL(65,30),
    "mostFrequentVaultId" INTEGER,

    CONSTRAINT "card_habit_stats_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "vault_checkpoints" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "checkpointTimestamp" TIMESTAMP(3) NOT NULL,
    "checkpointDate" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "checkpointType" TEXT NOT NULL,
    "originalCountedAmount" DECIMAL(65,30) NOT NULL,
    "retroactiveDeductionTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "effectiveAnchorAmount" DECIMAL(65,30) NOT NULL,
    "systemBookBalanceBefore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rawDiscrepancyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "resolvedDiscrepancyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unexplainedDiscrepancyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoint_denominations" (
    "id" SERIAL NOT NULL,
    "checkpointId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitValue" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "checkpoint_denominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionDate" TIMESTAMP(3) NOT NULL,
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
    "originalGrossAmount" DECIMAL(65,30),
    "fxRateApplied" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "consumeAmount" DECIMAL(65,30) NOT NULL,
    "incomeAmount" DECIMAL(65,30) NOT NULL,
    "isBackdated" BOOLEAN NOT NULL DEFAULT false,
    "subVaultWarning" BOOLEAN NOT NULL DEFAULT false,
    "linkedCheckpointId" INTEGER,
    "counterpartyAccountNote" TEXT,
    "proofFilePath" TEXT,
    "notes" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_legs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "vaultId" INTEGER NOT NULL,
    "subContainerId" INTEGER,
    "legRole" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "fxRateApplied" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "originalMutation" DECIMAL(65,30),
    "debitIn" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditOut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netMutation" DECIMAL(65,30) NOT NULL,
    "runningVaultBalance" DECIMAL(65,30) NOT NULL,
    "runningTotalWealth" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "transaction_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_ledger_entries" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "entryCategory" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "settlementMethod" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "referenceDebtId" INTEGER,
    "remainingOpenAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_reminders" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "reminderType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedAmount" DECIMAL(65,30),
    "suggestedVaultId" INTEGER,
    "suggestedPartyId" INTEGER,
    "suggestedCategoryId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "convertedTransactionId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "pending_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'IDR',
    "fxSyncIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "lastFxSyncedAt" TIMESTAMP(3),
    "lastFxStatus" TEXT,
    "lastFxError" TEXT,
    "dismissedCardSuggestionsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_cache" (
    "id" SERIAL NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "rateDate" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FRANKFURTER_V2',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rate_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "master_category_templates_code_key" ON "master_category_templates"("code");

-- CreateIndex
CREATE INDEX "master_category_templates_moduleKey_idx" ON "master_category_templates"("moduleKey");

-- CreateIndex
CREATE INDEX "vaults_userId_idx" ON "vaults"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vaults_userId_code_key" ON "vaults"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "vault_sub_containers_vaultId_code_key" ON "vault_sub_containers"("vaultId", "code");

-- CreateIndex
CREATE INDEX "parties_userId_idx" ON "parties"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "parties_userId_code_key" ON "parties"("userId", "code");

-- CreateIndex
CREATE INDEX "categories_userId_idx" ON "categories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_code_key" ON "categories"("userId", "code");

-- CreateIndex
CREATE INDEX "action_cards_userId_idx" ON "action_cards"("userId");

-- CreateIndex
CREATE INDEX "vault_checkpoints_userId_vaultId_idx" ON "vault_checkpoints"("userId", "vaultId");

-- CreateIndex
CREATE INDEX "transactions_userId_transactionDate_idx" ON "transactions"("userId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_userId_monthTag_idx" ON "transactions"("userId", "monthTag");

-- CreateIndex
CREATE INDEX "transactions_userId_nature_idx" ON "transactions"("userId", "nature");

-- CreateIndex
CREATE INDEX "transaction_legs_userId_vaultId_idx" ON "transaction_legs"("userId", "vaultId");

-- CreateIndex
CREATE INDEX "transaction_legs_transactionId_idx" ON "transaction_legs"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_legs_vaultId_idx" ON "transaction_legs"("vaultId");

-- CreateIndex
CREATE INDEX "transaction_legs_subContainerId_idx" ON "transaction_legs"("subContainerId");

-- CreateIndex
CREATE INDEX "debt_ledger_entries_userId_partyId_idx" ON "debt_ledger_entries"("userId", "partyId");

-- CreateIndex
CREATE INDEX "debt_ledger_entries_userId_status_idx" ON "debt_ledger_entries"("userId", "status");

-- CreateIndex
CREATE INDEX "pending_reminders_userId_status_idx" ON "pending_reminders"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_userId_key" ON "app_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_cache_baseCurrency_quoteCurrency_key" ON "exchange_rate_cache"("baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE INDEX "media_assets_userId_idx" ON "media_assets"("userId");

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_sub_containers" ADD CONSTRAINT "vault_sub_containers_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_defaultSubContainerId_fkey" FOREIGN KEY ("defaultSubContainerId") REFERENCES "vault_sub_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_targetSubContainerId_fkey" FOREIGN KEY ("targetSubContainerId") REFERENCES "vault_sub_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cards" ADD CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_habit_stats" ADD CONSTRAINT "card_habit_stats_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "action_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_checkpoints" ADD CONSTRAINT "vault_checkpoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_checkpoints" ADD CONSTRAINT "vault_checkpoints_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_denominations" ADD CONSTRAINT "checkpoint_denominations_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "vault_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_actionCardId_fkey" FOREIGN KEY ("actionCardId") REFERENCES "action_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_linkedCheckpointId_fkey" FOREIGN KEY ("linkedCheckpointId") REFERENCES "vault_checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_legs" ADD CONSTRAINT "transaction_legs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_legs" ADD CONSTRAINT "transaction_legs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_legs" ADD CONSTRAINT "transaction_legs_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_legs" ADD CONSTRAINT "transaction_legs_subContainerId_fkey" FOREIGN KEY ("subContainerId") REFERENCES "vault_sub_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_ledger_entries" ADD CONSTRAINT "debt_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_ledger_entries" ADD CONSTRAINT "debt_ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_ledger_entries" ADD CONSTRAINT "debt_ledger_entries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_ledger_entries" ADD CONSTRAINT "debt_ledger_entries_referenceDebtId_fkey" FOREIGN KEY ("referenceDebtId") REFERENCES "debt_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reminders" ADD CONSTRAINT "pending_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reminders" ADD CONSTRAINT "pending_reminders_suggestedVaultId_fkey" FOREIGN KEY ("suggestedVaultId") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reminders" ADD CONSTRAINT "pending_reminders_suggestedPartyId_fkey" FOREIGN KEY ("suggestedPartyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reminders" ADD CONSTRAINT "pending_reminders_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_reminders" ADD CONSTRAINT "pending_reminders_convertedTransactionId_fkey" FOREIGN KEY ("convertedTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
