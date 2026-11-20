# 019 — Account Deletion, Dynamic Base Currency Consistency & Last Login Greeting (Backlog 06)

**Date:** 2026-11-20  
**Scope:** Self & Admin Account Deletion, Global Base Currency Propagation, & `lastLoginAt` Warm Welcome

---

## 1. Design & Implementation Summary

1. **Permanent Account Deletion (`#1`)**
   - Added `deleteUserAccountCascadeInTx(userId)` in `src/server/modules/auth/auth.repository.js` that atomically deletes all user-owned rows (`checkpointDenominations`, `transactionLegs`, `debtLedgerEntries`, `transactions`, `vaultCheckpoints`, `cardHabitStats`, `actionCards`, `vaultSubContainers`, `vaults`, `pendingReminders`, `parties`, `categories`, `mediaAssets`, `appSetting`, and `user`) inside `prisma.$transaction`.
   - Enforces last-active-ADMIN protection so the instance never loses administrator access.
   - Exposed `DELETE /api/auth/me` (requires current password, clears `auth_token` cookie) + Self-Delete confirmation modal in `AccountSecurityCard.jsx`.
   - Exposed `DELETE /api/admin/users/[id]` (requires typing target `username`) + Admin Delete modal in `AdminUI.jsx`.

2. **Global Base Currency Propagation (`#2`)**
   - Added `baseCurrency` & `setBaseCurrency` to `useLedgerStore`, synced automatically in `AppLayout.jsx`.
   - Updated `<MoneyValue />` and `<CurrencyTextField />` to default to the active store `baseCurrency` whenever no explicit `currency` prop is provided.
   - Updated `formatShortAxis(val, hidden, currencyCode)`, `AnalyticsUI.jsx`, `useAnalyticsLogic.js`, `CashflowWaterfallCard.jsx`, `WealthDistributionAndTimelineSection.jsx`, `AutoChartDrawer.jsx`, `ChartCardHeaderMenu.jsx`, `ReconcileModal.jsx`, and `AppLayout.jsx` top-bar compact toggle (`"1jt" / "Rp Full"` vs `"1M" / "<Symbol> Full"`) to format according to `baseCurrency`.
   - Updated `updateUserFxSettingsPayload` (`src/server/modules/fx/fx.service.js`) to sync existing base-currency/default `VaultSubContainer` rows when the user changes their `baseCurrency`.

3. **User `lastLoginAt` & Warm Welcome (`#3`)**
   - Added nullable `lastLoginAt DateTime?` to `User` in `application/prisma/schema.prisma` with defensive query fallbacks in `auth.repository.js` and `admin.repository.js`.
   - Recorded `lastLoginAt` on successful sign-in (`authenticateUserCredentials`) while returning `previousLoginAt`.
   - Added an **Elegant Warm Welcome Toast** (`variant: "welcome"` in `ToastProvider.jsx` & `useLoginLogic.js`) with tailored messaging depending on how long the user was away:
     - First sign-in (`previousLoginAt == null`)
     - Same day (`< 1` day)
     - A few days away (`1–7` days)
     - Long time away (`> 7` days, encouraging a quick vault audit)
   - Added `Last sign-in` metadata on each user card in `AdminUI.jsx`.
