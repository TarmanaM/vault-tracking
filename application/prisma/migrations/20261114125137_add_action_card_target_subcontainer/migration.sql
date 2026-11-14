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
    CONSTRAINT "action_cards_defaultVaultId_fkey" FOREIGN KEY ("defaultVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultSubContainerId_fkey" FOREIGN KEY ("defaultSubContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "vaults" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_targetSubContainerId_fkey" FOREIGN KEY ("targetSubContainerId") REFERENCES "vault_sub_containers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_cards_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_action_cards" ("cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultSubContainerId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt", "visibilityMode") SELECT "cardActionType", "createdAt", "defaultAmount", "defaultCategoryId", "defaultPartyId", "defaultSubContainerId", "defaultVaultId", "expectedCadence", "id", "isActive", "oneTapSubmit", "pinPriority", "quickAmountsJson", "subtitle", "targetVaultId", "title", "updatedAt", "visibilityMode" FROM "action_cards";
DROP TABLE "action_cards";
ALTER TABLE "new_action_cards" RENAME TO "action_cards";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
