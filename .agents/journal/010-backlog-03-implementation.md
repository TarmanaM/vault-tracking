# Journal 010 — Backlog 03 Implementation Checkpoint

**Date:** 2026-11-14  
**Scope:** Implementation of Backlog 03 (`#1`–`#9` per [`009-backlog-03-grill-me-decisions.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/journal/009-backlog-03-grill-me-decisions.md)), excluding live browser UI testing per explicit user note.

## Architectural & Code Additions

### 1. Schema & Core Precision Services
- **Database Schema (`application/prisma/schema.prisma`)**: Migrated via user (`backlog_03_subvaults_fx_profiles`) adding `Vault` profile/warning fields, `VaultSubContainer` currency/default/live-sync fields, `ActionCard.defaultSubContainerId`, foreign snapshot fields on `Transaction` & `TransactionLeg`, plus `AppSetting` & `ExchangeRateCache`.
- **Precision Math (`application/src/lib/money.js`)**: Added `divMoney(a, b)` with divide-by-zero protection.
- **Currency & Media Helpers (`currencyHelpers.js`, `mediaStorage.js`)**: Shared multi-currency formatting (`SUPPORTED_CURRENCIES`, `formatNativeMoney`) and traversal-safe file persistence into `data-server/media/vaults/`.
- **Frankfurter v2 FX Service (`fxService.js`)**: Server-side fetching from `https://api.frankfurter.dev/v2/rate/{from}/{to}` strictly scoped to `getActiveForeignCurrencies()` (foreign currencies held in `vault_sub_containers` of `isActive: true` vaults), automatically disabled (`0` HTTP calls) when no active foreign sub-vault exists, retaining unused cache rows passively (`Keep Silently`), plus configurable sync intervals (default `3` days) and manual override support (`upsertManualFxRate`).
- **Dynamic Sub-Vault Engine (`subVaultService.js`)**: Implements mandatory single `isDefault` pocket enforcement, non-mutating partition sync (`syncVaultPartitions`), 2-pocket auto-fill vs 3+ pocket Unallocated Pool math, mark-to-market foreign base valuations (`computeVaultPartitionSummary`), and spillover warning detection (`evaluateBasePartitionState`).
- **Atomic Ledger & Reversal (`ledgerService.js`)**: Updated `createTransaction` and `deleteAndReverseTransaction` to route sub-vault defaults, lock historical FX rates onto foreign transactions without mutating Base book totals, flag `subVaultWarning` on spillover, and atomically restore sub-vault balances + partition status on Undo/Delete.

### 2. Backend API Routes
- **Vault & Sub-Vault Endpoints**:
  - `GET/POST /api/vaults` (`application/src/app/api/vaults/route.js`)
  - `PATCH/DELETE /api/vaults/[id]` (`application/src/app/api/vaults/[id]/route.js`)
  - `POST/PATCH/DELETE /api/vaults/[id]/sub-vaults` (`application/src/app/api/vaults/[id]/sub-vaults/route.js`)
- **Media & FX Endpoints**:
  - `POST /api/media/vaults` & `GET /api/media/[...path]`
  - `GET/PATCH /api/settings/fx` & `POST /api/settings/fx/sync`
- **Updated Read/Write Routes**: Enriched `/api/dashboard`, `/api/analytics`, `/api/reconcile`, `/api/cards`, `/api/transactions`, and `/api/export` with Valas valuation sums, `appSettings`, `exchangeRates`, `subContainer` joins, and FX flat export columns.

### 3. Frontend UI & Chart Enhancements
- **Providers & Global State (`Providers.js`, `useLedgerStore.js`, `MoneyValue.jsx`)**: Wrapped app with `@mui/x-date-pickers` `LocalizationProvider` (`AdapterDayjs`), added multi-currency support to `MoneyValue`, and added dialog/chart label state to `useLedgerStore`.
- **Navigation & Modals (`AppLayout.jsx`, `VaultAvatar.jsx`, `VaultProfileModal.jsx`, `SubVaultSyncModal.jsx`, `FxSettingsModal.jsx`)**:
  - Fixed mobile temporary `<Drawer>` z-index (`drawer + 2`) so the top brand/owner profile (`Isa Tarmana • Owner`) is no longer occluded by the fixed `AppBar`.
  - Built in-house native HTML5 `<canvas>` pan/zoom image cropper (`VaultProfileModal.jsx`: explicit DOM `width={220}`/`144` bitmap attributes bypassing MUI `Box` `systemProps` interception so 1:1 images never stretch to 300x150) with simultaneous Square & Circle live previews, interactive color picker (`<input type="color">`), MUI icon picker, and `1:1` aspect-ratio lock in `VaultAvatar.jsx`.
  - Built interactive Sub-Vault Sync Split manager and FX Settings dialog (with active-currency target chips, automatic `Sync Now` disable state when base-currency-only, and `Passive` badge for historical/inactive cached rows).
- **Dashboard, Flagship Transaction Form & Charts (`app/page.js`, `SmartActionCards.jsx`, `VaultRibbon.jsx`, `CustomTransactionModal.jsx`, `ManageCardsModal.jsx`, `checkpoints/page.js`, `ledger/page.js`, `ChartCardHeaderMenu.jsx`, `analytics/page.js`, `AutoChartDrawer.jsx`)**:
  - Added prominent `+ Transaction` hero CTA above `SmartActionCards` and removed `+ Custom Tx` from inside `SmartActionCards`.
  - Rebuilt `CustomTransactionModal` into a mobile-first Fintech flow with segmented type pills, Hero Amount + currency/FX preview, Visual Vault & Sub-Vault pocket pills, spacious `@mui/x-date-pickers` (`DatePicker` / `TimePicker` + `Now`), and collapsible *More Options*.
  - Added `ChartCardHeaderMenu` (`⋮` menu toggle) and `ChartDotLabelMark` SVG dots + halo labels across `/analytics` and `AutoChartDrawer.jsx`, defaulting ON when `<= 31` points and honoring Privacy Mode.

## Verification Status (No Browser UI Tests per User Note)
- `npm --prefix application run lint`: Passed (`exit 0`, zero errors/warnings).
- End-to-end verification script (`verify-backlog-03.mjs`, synthetic records cleaned up post-run): All 5 suites passed (`money` + helpers, media storage + traversal guard, FX rate cache + active-only sync disable guard with 0 HTTP calls when unused, 2-pocket auto-fill / 3+ pool / spillover bypass & undo, locked historical FX vs live mark-to-market revaluation + strict single-currency USD sync & passive cache retention).
- `npm --prefix application run build`: Passed cleanly earlier (`exit 0`, 14.5s, 9/9 static pages); skipped on the subsequent `VaultProfileModal.jsx` / `VaultAvatar.jsx` canvas fix per explicit user instruction.
