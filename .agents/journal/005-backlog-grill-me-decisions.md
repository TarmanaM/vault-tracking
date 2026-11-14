# Journal Checkpoint 005: Backlog Design Discussion (`/grill-me`)

- **Timestamp**: 2026-11-14T01:45:00+07:00
- **Source**: `.agents/backlog/what-i-want-next/notelog.txt` & reference images (`1..png` - `4.png`).
- **Status**: Decisions Locked, Pending User Approval to Start Implementation.

## Audit Findings on Existing Codebase
1. **Already Implemented (#20)**: 5-second Undo Snackbar already exists in `UndoSnackbar.jsx` for Smart Card & Custom Transaction creation (`DELETE /api/transactions/[id]`). Missing consistent toast/undo feedback for deletes inside Ledger.
2. **Sync Bug Found (#19)**: `POST /api/reconcile` updates DB `vault.currentBalance`, but `ReconcileModal.jsx` forgot to invalidate `["checkpoints"]` and `["analytics"]` query keys. Also, `reconcile/route.js` wrote single vault balance to `runningTotalWealth` instead of aggregate wealth.
3. **Backend Ready (#10, #15)**: `ledgerService.js` already accepts `transactionDate`, `transactionTime`, and `linkedCheckpointId`. However, `CustomTransactionModal.jsx` lacks date/time picker and auto-retroactive detection, and `ledgerService.js` currently mutates `sourceVault.currentBalance` even when `isBackdated = true` (needs fix so absorbed backdated tx preserves ending balance).

## Locked Design Decisions (All 4 Branches)

### Branch 1: Analytics & Charts (`/analytics` & `/ledger`)
- **#4 & #5**: Keep **both** charts separately:
  - *Wealth Trajectory Timeline*: Clean line chart (`area: false`), cumulative net wealth over time.
  - *Cashflow Waterfall Chart* (`4.png`): Built via stacked offset `BarChart` in `@mui/x-charts`, showing **Daily Net Cashflow** (`Debit - Kredit` per day, green up / red down, excluding `INITIAL_FUND` & internal `TRANSFER`).
- **#1 & #2 (`1..png` & `2.png`)**: Negative downward orientation from `Rp 0` (`consumeAmount`), include linear trendline on Daily Consumption Line Chart, skip days without consumption.
- **#3 (`3.png`)**: Top Largest Consumptive Transactions list within the selected date range.
- **#6**: Vault usage frequency chart/stats based on transaction count per vault (excluding `INITIAL_FUND`).
- **#24**: Month-over-Month Net Wealth comparison indicator (% & up/down icon). Falls back to Initial Baseline comparison with clear label if previous month has no data.
- **#xx**: Date range filter on both `/analytics` and `/ledger`. Default `"Last 3 Months"` computed backwards from the latest transaction date in DB (with fallback so April 2026 mockup renders), plus quick presets (`1M`, `3M`, `6M`, `YTD`, `All`, `Custom Date`).

### Branch 2: Global UX, Formatting, Privacy, & Notifications
- **#7**: Default to **Compact format** (`1jt`, `59.5k`, etc.) across UI & charts, paired with a Global Toggle in the Top Bar and tap/tooltip exact value (`.21` / `.67`).
- **#8**: **Full Privacy Mode** (default `unhide`). Clicking the eye icon masks all Rupiah values (`Rp ••••••`) including Net Wealth, Vaults, Ledger rows, Debts, and Chart Y-axis value labels, while preserving percentages and chart shapes.
- **#9**: Auto thousand separator (`1.000.000`) while typing in currency fields (preserving optional decimals `,21` for bank cents).
- **#14 & #20**: Use an **In-House MUI Toast Queue Provider** (0 extra dependencies, native React 19 & MUI v7 compatibility) replacing all JS `alert()` / `confirm()` calls with clean toasts and MUI confirm dialogs.

### Branch 3: Smart Action Cards & Entry Flow
- **#10**: Add Date & Time picker + `Now` quick-fill button to transaction modal.
- **#11 & #23**: Add `visibilityMode` (`ACTIVE` | `SOFT_HIDDEN` | `ARCHIVED`) to `ActionCard` model:
  - `ACTIVE`: Shown in Recommended & Search.
  - `SOFT_HIDDEN`: Hidden from Recommended, visible in Search/Filter tab.
  - `ARCHIVED`: Hidden from both Recommended and Search/Filter; restorable/editable from a small `"Manage Cards"` drawer/modal (which also allows creating new Smart Action Cards).
- **#12**: Remove `RecentTransactionsList` from `/` (Quick Actions) page since `/ledger` exists.
- **#13**: Style Unaccounted Cash Shortage as Amber Warning instead of Red Error.
- **#15**: Auto-detect `Retroactive` when selected `Date+Time < latest checkpointTimestamp` of selected vault (no manual checkbox). Properly absorb into checkpoint without mutating ending vault balance, and recalculate historical running balances.
- **#16 & #18**: Add inline manual amount input inside Smart Action Card + `X` / Reset button to revert card overrides back to defaults.

### Branch 4: Debt, Payables, External Bank Notes, Partial Write-Off, & Two-Way Merge
- **#17**:
  - Add `+ Add Contact / Party` button in `/debts` and transaction form.
  - Support **`PAYABLE_BORROW`** (both *ditalangin jajan/beli barang* -> `consumeAmount < 0`, vault balance unchanged; and *pinjam uang masuk vault* -> `consumeAmount = 0`, vault balance increases).
  - Support **`PAYABLE_REPAY`** with either specific debt selection OR `"aku totalin segini dulu"` (**FIFO Auto-Allocate** closing oldest open payables first).
  - Support recording external counterparty bank destination (e.g., `"BRI - Si A"`, `"SeaBank"`) on payment without creating an internal vault.
- **#21 & #22**: Build dedicated **Party Debt Detail Page** (`/debts/[partyId]`) showing full transaction/settlement history, plus Partial Write-Off (manual nominal input on either a specific item or FIFO total).
- **#22-2**: Keep Receivable & Payable balances **separate** (no auto-netting). Add manual **Merge / Offset** flow on `/debts/[partyId]` allowing user to select specific Receivable + Payable entries (or 1-click Auto-Offset) to settle via `OFFSET_DEDUCTION` + `DEBT_OFFSET` audit transaction.

