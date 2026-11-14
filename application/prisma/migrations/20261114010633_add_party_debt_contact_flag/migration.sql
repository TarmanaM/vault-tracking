-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isDebtContact" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_parties" ("aliasesJson", "code", "createdAt", "externalAccountsJson", "heldFundBalance", "id", "isActive", "name", "netReceivableBalance", "partyType", "payableBalance", "receivableBalance", "updatedAt") SELECT "aliasesJson", "code", "createdAt", "externalAccountsJson", "heldFundBalance", "id", "isActive", "name", "netReceivableBalance", "partyType", "payableBalance", "receivableBalance", "updatedAt" FROM "parties";
DROP TABLE "parties";
ALTER TABLE "new_parties" RENAME TO "parties";
CREATE UNIQUE INDEX "parties_code_key" ON "parties"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
