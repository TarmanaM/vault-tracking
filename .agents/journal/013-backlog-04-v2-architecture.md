# Backlog 04 (v2.0) — Multi-User, Onboarding & Generic Architecture Decisions

**Date**: 2026-11-15  
**Source**: `.agents/backlog/04(v2.0)/note.txt` (`#1`–`#11`)  
**Status**: IMPLEMENTED & VERIFIED (ESLint, `next build`, and multi-user live HTTP integration tests passed).

---

## Summary of Approved Architectural Decisions

1. **Pure Closed Multi-User Account Provisioning (`#1`, `#6`, `#11`)**:
   - No open public self-registration; only `ADMIN` users can create accounts in `/admin`.
   - Two roles: `USER` and `ADMIN`. `ADMIN` retains their own isolated personal Vault Tracking ledger (`isa` is migrated/seeded as `ADMIN`), while `/admin` only exposes non-financial account metadata (`username`, `fullName`, `role`, `isActive`, `mustChangePassword`, `onboardingCompleted`, `createdAt`) for **Create User**, **Activate/Deactivate**, and **Reset Password** — zero access to other users' vaults, transactions, balances, cards, debts, or uploaded media.
   - Privacy-first password lifecycle: accounts created or password-reset by Admin get `mustChangePassword = true` and must set a private password upon first login. Auth uses HTTP-only JWT cookie (`auth_token`) + live DB `isActive` check so deactivation immediately invalidates active sessions. Vault profile images are isolated per user (`data-server/media/vaults/<userId>/...`).
   - Fresh DB start approved by user (dummy data reset allowed).

2. **Master vs User-Personalized Separation (`#4`, `#8`, `#9`)**:
   - **Global Master Tables**: `ExchangeRateCache` and `MasterCategoryTemplate` (`master_category_templates` seeded from `application/prisma/master-catalog.json`).
   - **User-Owned Tables (`userId`)**: `Vault` (`@@unique([userId, code])`), `VaultSubContainer` (via `Vault`), `Party` (`@@unique([userId, code])`), `Category` (`@@unique([userId, code])`, `isSystemLocked`), `ActionCard`, `CardHabitStats`, `VaultCheckpoint`, `CheckpointDenomination`, `Transaction`, `TransactionLeg`, `DebtLedgerEntry`, `PendingReminder`, and `AppSetting` (converted from singleton `id = 1` to `userId @unique` storing `baseCurrency`, FX sync config, and `dismissedCardSuggestionsJson`).
   - **Clean Removals**:
     - Completely removed `HELD_POOL` (*Taspen* / `heldFundBalance` / `/debts` `HELD POOL` card).
     - Archived `inject-excel.js`, `extract-excel.py`, and `excel-data.json` into root `archive/` and removed `"inject-excel"` from `application/package.json`.

3. **Simplified Taxonomy & Technical Code Hiding (`#2`, `#7`)**:
   - Users see a clean **2-step mental model**: **Transaction Type (`nature`) -> Category** (clean names without `[coaCode]` prefix in transaction dropdowns).
   - 4 Dashboard Consumption Layers renamed into neutral universal English: **Fixed & Bills** (`FIXED_MANDATORY`), **Everyday Needs** (`VARIABLE_ESSENTIAL`), **Lifestyle & Wants** (`DISCRETIONARY_JAJAN`), and **Giving & Gifts** (`SOCIAL_CHARITY`).
   - `priorityTier` (`PRIMER`, `SEKUNDER`, `TERSIER`) and `coaCode` (`1xxx`–`6xxx`) are automatically populated and maintained in the backend so Double-Entry CSV Accountant Export stays valid without confusing users.

4. **Onboarding Interview, Default Skip Preset & Dedicated `/settings` (`#3`, `#5`, `#10`)**:
   - **Onboarding Interview Wizard**: Collects `Primary Currency`, modular `Lifestyle Switches` (*Vehicle?, Rent/Utilities?, Subscriptions?, Coffee/Hobbies?, Charity/Gifts?*), and optional `Starter Vaults & Opening Balance`, instantiating matching categories, `SELF` party, starter vaults, and neutral sample Action Cards.
   - **Skip Default Preset (`#10`)**: Creates a ready-to-use neutral setup (`IDR`, `Cash Wallet` + `Main Bank`, essential balanced categories, `SELF` party, and sample Action Cards) so users never start on an empty confusing screen.
   - **Dedicated `/settings` (Settings & Personalize)**: Houses **Categories & Spending Layers** (create/edit/archive custom categories with `(i)` taxonomy guidance per Rule 11), **Currency & FX Settings**, **Account & Password Security**, and **Onboarding / Re-Personalize Setup**, keeping `+ Transaction` clean and distraction-free.

5. **Testing Constraint**:
   - Do NOT execute browser UI testing unless explicitly instructed by user (`note.txt`).

---

## Implementation Summary (Completed)

- **Auth, Middleware & Admin Lifecycle**: Added `application/src/lib/auth.js`, `application/src/middleware.js`, `/api/auth/{login,logout,me,change-password}`, `/api/admin/users`, `/api/admin/users/[id]`, `/login`, `/force-password-change`, `/admin`, and the AuthGuard in `AppLayout.jsx` (`(i)` privacy boundary notices included).
- **Master Catalog, Onboarding & Custom Categories**: Added `application/prisma/master-catalog.json`, `application/src/lib/masterCatalog.js`, `application/src/lib/spendingLayers.js` (client-safe helper), `application/src/lib/onboardingService.js`, `/api/onboarding`, `/api/categories`, `/api/categories/[id]`, `/onboarding`, and `/settings`.
- **Full `userId` Isolation & Cleanup**: Scoped all services (`ledgerService.js`, `fxService.js`, `subVaultService.js`, `cardPromotionService.js`, `mediaStorage.js`) and all API endpoints to `requireUser` + strict `userId` ownership, removed `HELD_POOL` / `Taspen` / `heldFundBalance` / `[coaCode]` dropdown prefixes, and updated `LayerConsumptionOverview.jsx`, `HeaderSummary.jsx`, `ManageCardsModal.jsx`, `CustomTransactionModal.jsx`, `VaultAvatar.jsx`, `VaultProfileModal.jsx`, `app/ledger/page.js`, and `app/debts/page.js` to neutral English labels.
- **Verification**:
  - `npm --prefix application run lint` exited `0` cleanly.
  - `npm --prefix application run build` exited `0` cleanly.
  - Live Node HTTP multi-user integration test against `next start` passed all 6 suites (`PASS 1`–`PASS 6`): unauthenticated middleware/API guards, closed Admin provisioning & metadata-only listing, forced password change & role gating, Interview vs Skip onboarding presets, custom category + atomic ledger + Double-Entry CSV export + strict cross-user/admin/media isolation, and immediate session revocation on Admin deactivation / password reset.

## Post-Release Bugfix: Onboarding Toast Crash & Currency-Formatted Opening Balance (2026-11-15)

- **Root Cause Fixed**: `useLedgerStore` exposes `enqueueToast(message, options)` (no `showToast`). `onboarding/page.js`, `settings/page.js`, and `admin/page.js` selected `s.showToast`, causing `POST /api/onboarding` (which already succeeded in DB) to throw `TypeError: showToast is not a function` afterward inside `try`, triggering `"Failed to save onboarding setup."`.
- **Updates Applied**:
  - Replaced `showToast` with `enqueueToast(..., { severity })` across `onboarding/page.js`, `settings/page.js`, and `admin/page.js` (0 `showToast` references remaining), plus safe text/JSON response parsing and error propagation in `onboarding/page.js`.
  - Updated `CurrencyTextField.jsx` to accept `currency = "IDR"` and render dynamic currency prefix via `getCurrencySymbol(currency)` (`Rp`, `$`, etc.) while keeping live dot-thousand (`300.000`) and comma-cent formatting.
  - Replaced the raw `<TextField type="number">` Opening Balance input in `onboarding/page.js` with `<CurrencyTextField currency={baseCurrency} showClear ... />`.
- **Re-Verified**: `npm --prefix application run lint`, `npm --prefix application run build`, currency helper unit assertions, and `verify_v2_api.mjs` (including `IDR` + `BCA` `300000` interview preset) all passed cleanly.
