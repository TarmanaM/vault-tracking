-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "counterpartyAccountNote" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_action_cards" (
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
    "visibilityMode" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_action_cards" ("cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt") SELECT "cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt" FROM "action_cards";
DROP TABLE "action_cards";
ALTER TABLE "new_action_cards" RENAME TO "action_cards";
CREATE TABLE "new_parties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliasesJson" TEXT,
    "partyType" TEXT NOT NULL,
    "netReceivableBalance" DECIMAL NOT NULL DEFAULT 0,
    "receivableBalance" DECIMAL NOT NULL DEFAULT 0,
    "payableBalance" DECIMAL NOT NULL DEFAULT 0,
    "externalAccountsJson" TEXT,
    "heldFundBalance" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_parties" ("aliasesJson", "code", "createdAt", "heldFundBalance", "id", "isActive", "name", "netReceivableBalance", "partyType", "updatedAt") SELECT "aliasesJson", "code", "createdAt", "heldFundBalance", "id", "isActive", "name", "netReceivableBalance", "partyType", "updatedAt" FROM "parties";
DROP TABLE "parties";
ALTER TABLE "new_parties" RENAME TO "parties";
CREATE UNIQUE INDEX "parties_code_key" ON "parties"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
