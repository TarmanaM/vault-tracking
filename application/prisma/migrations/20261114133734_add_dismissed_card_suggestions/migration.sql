-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "baseCurrency" TEXT NOT NULL DEFAULT 'IDR',
    "fxSyncIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "lastFxSyncedAt" DATETIME,
    "lastFxStatus" TEXT,
    "lastFxError" TEXT,
    "dismissedCardSuggestionsJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_app_settings" ("baseCurrency", "fxSyncIntervalDays", "id", "lastFxError", "lastFxStatus", "lastFxSyncedAt", "updatedAt") SELECT "baseCurrency", "fxSyncIntervalDays", "id", "lastFxError", "lastFxStatus", "lastFxSyncedAt", "updatedAt" FROM "app_settings";
DROP TABLE "app_settings";
ALTER TABLE "new_app_settings" RENAME TO "app_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
