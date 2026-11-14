# Journal 006 — Backlog v2 Implementation Checkpoint

**Status**: Implemented cleanly in Next.js 15 App Router (JavaScript, MUI v7, `@mui/x-charts`, Prisma, `decimal.js`, Zustand, TanStack Query v5).

## Summary of Changes

### 1. Core Formatting, State & Feedback Layer
- `application/src/lib/money.js`: Added `formatCompactRupiah`, `formatShortAxis`, `formatMoneyDisplay`, `formatCurrencyInput`, `parseCurrencyInput`, `numericToFormattedInput`.
- `application/src/store/useLedgerStore.js`: Added `isCompactNumbers` (default `true`), `isPrivacyHidden` (default `false`), stacked `toasts` / `enqueueToast` / `dismissToast`, global `confirmDialog` / `openConfirmDialog`, `manageCardsDialog`, `addPartyDialog`.
- `application/src/components/CurrencyTextField.jsx`: Live dot-thousand and comma-cent masked numeric input.
- `application/src/components/MoneyValue.jsx`: Privacy-aware and compact-aware renderer with tap-to-toggle exact value and tooltip.
- `application/src/components/ToastProvider.jsx`: In-house MUI stacked toast queue + 5-second Undo + MUI Confirm Dialog (`0` extra npm dependencies).

### 2. Schema, Seeding & Ledger Services
- `application/prisma/schema.prisma`: Added `Party.receivableBalance`, `Party.payableBalance`, `Party.externalAccountsJson`, `ActionCard.visibilityMode`, `Transaction.counterpartyAccountNote` (migrated by user via `20261113184903_backlog_v2_debt_actions`).
- `application/prisma/inject-excel.js`: Updated to populate separated `receivableBalance` / `payableBalance` and link open debt settlements accurately.
- `application/src/lib/ledgerService.js`: Added chronological `recalculateLedgerRunningBalances`, auto-retroactive checkpoint absorption, specific + FIFO `settleDebtEntries`, `PAYABLE_BORROW` (`EXPENSE_TALANG` & `CASH_LOAN`), `PAYABLE_REPAY`, partial/FIFO `writeOffDebt`, manual `offsetPartyDebts` (`DEBT_OFFSET`), and full reversal in `deleteAndReverseTransaction`.

### 3. API Routes
- `POST /api/reconcile`: Fixes `runningTotalWealth` chronological backfill alongside `runningVaultBalance`.
- `GET /api/analytics`: Computes `WEALTH_JOURNEY` with date filtering (`3M` default anchored to latest tx), stacked Cashflow Waterfall intervals, Daily/Monthly Consumption curves + linear regression, Top Consumptive Expenses, Vault Usage Frequency, and MoM comparison badge.
- `GET / POST / PATCH /api/cards`, `GET / POST /api/parties`, `GET /api/debts/[id]`, `POST /api/debt/offset`, `POST /api/debt/write-off`, `GET /api/transactions`, `GET /api/dashboard`.

### 4. UI Components & Dedicated Pages
- `application/src/app/layout.js`: Split Next.js `viewport` export out of `metadata`.
- `application/src/components/Navigation/AppLayout.jsx`: Added Top Bar Compact/Exact toggle, Privacy Eye toggle, 5-item Android bottom navigation, and global mounts (`ToastProvider`, `ReconcileModal`, `ExportModal`, `AddPartyModal`, `ManageCardsModal`, `CustomTransactionModal`, `AutoChartDrawer`).
- `application/src/components/AddPartyModal.jsx` & `application/src/components/ManageCardsModal.jsx`: Contact creation and ActionCard CRUD/restore modals.
- `application/src/components/SmartActionCards.jsx` & `application/src/components/CustomTransactionModal.jsx`: Recommended vs All Cards search tabs, 2-level Hide menu, inline amount override, `X` Reset card button, Exact Date+Time+`Now`, Auto-Retroactive warning badge, Borrowing/Repay modes, FIFO totalan vs specific item, and saved external counterparty bank autocomplete.
- `application/src/app/page.js`, `/analytics/page.js`, `/ledger/page.js`, `/checkpoints/page.js`, `/debts/page.js`, `/debts/[id]/page.js`: Full feature rollout matching all 25 requirements.

- `application/package.json`: Switched `"build"` from `"next build --turbopack"` to `"next build"` (keeping `--turbopack` on `"dev"`) after verifying `--turbopack` truncated `.next/routes-manifest.json` during `next start`.
