# Journal 007 — Backlog 02 (`/grill-me` Design Alignment & Implementation Plan)

- **Source**: `.agents/backlog/02/note.txt` & `.agents/backlog/02/01.png`
- **Status**: Aligned & Ready for User Execution Approval
- **Target Audit Device**: Desktop + Android Mobile (Poco F7 Pro viewport ~`400x880`)

---

## Aligned Decisions by Branch

### Branch A — Ledger Logic, Coin Split/Change, & Debt Hygiene
1. **`#4` Dynamic Default Vault Hierarchy**:
   - **Action Card default**: Most frequently used vault for that `actionCardId` -> `card.defaultVaultId` -> current month's most-used primary vault -> `CASH`.
   - **Blank Custom Transaction default**: Current month's most-used primary vault in `transaction_legs` -> `CASH` fallback if no transactions yet this month.
   - Calculated deterministically in `api/dashboard/route.js` via Prisma queries (no AI/external calls).
2. **`#4` Coin Split Payment & Coin Change Math Fix (`CASH` only)**:
   - Coin inputs/controls appear **only** when the active source vault for `EXPENSE` is `CASH`.
   - Support two modes inside `CASH` Expense:
     - **Paid Using Coin (Split Payment)**: e.g. Rp 45.300 total (`44.000 CASH` + `1.300 COIN` via quick denomination chips/amount). Deducts `grossDec - coinUsedDec` from `CASH` (`PRIMARY`), deducts `coinUsedDec` from `COIN` (`COIN_SPLIT`), sets `consumeAmount = -grossDec`.
     - **Got Coin Change (+ Cash Change Calculator)**: Fix existing `ledgerService.js` bug where `CASH` only deducted `grossDec` while `COIN` received `+changeDec`. Correct accounting: `CASH` deducts `grossDec + coinChangeDec`, `COIN` increases by `+coinChangeDec` (`COIN_CHANGE`), `consumeAmount = -grossDec`. Include optional *"Cash Handed Over"* helper input (e.g. type `50.000`, `coinChange` = `500 + 100 = 600` -> displays `Paper Cash Change: Rp 2.000`).
   - Update Undo / Void / Delete reversal logic so both `COIN_SPLIT` and `COIN_CHANGE` legs reverse cleanly and stay checkpoint-aware.
3. **`#8` Permanent Debt Contact Separation (`isDebtContact`)**:
   - Add `isDebtContact Boolean @default(false)` on `Party` in `application/prisma/schema.prisma`.
   - **Rule 18 Reminder**: User must run `npx prisma migrate dev --name add-party-debt-contact-flag` inside `application/` after schema update.
   - Parties created from `/debts` (`+ Add Contact`) or involved in Debt transactions (`RECEIVABLE_*`, `PAYABLE_*`, `DEBT_OFFSET`) automatically get `isDebtContact: true`.
   - Parties created for regular `INCOME`/`EXPENSE` (e.g. "B" for *"dapet thr"*) remain `isDebtContact: false` and never appear on `/debts` unless later involved in debt/held funds.

### Branch B — Home / Quick Actions (`/`) Flow & Smart Action Cards
4. **`#7` Home Page Component Order**:
   1. `HeaderSummary` (`TOTAL NET WEALTH`)
   2. `LayerConsumptionOverview` (`Monthly Consumption`)
   3. `PendingRemindersBanner` (auto-promoted here **only** when `reminders.length > 0`)
   4. `SmartActionCards`
   5. `PendingRemindersBanner` (default resting spot when `reminders.length === 0`)
   6. `VaultRibbon` (`STORAGE VAULTS`)
5. **`#5` Storage Vaults Sorting**:
   - Sort active vaults on `/` (`VaultRibbon`) descending by `currentBalance` (largest balance first).
6. **`#6` Recommended Action Cards Pagination**:
   - Show first **5** cards on `Recommended` tab (`viewTab === 0`), followed by incremental **`+5 more`** button (`+5` per tap: `5 -> 10 -> 15...`) and **`Show Less`** when expanded beyond `5`.
7. **`#1` Hidden Custom Amount Behind Chip**:
   - Hide the manual `Custom Amount` `CurrencyTextField` by default on each Action Card; place a **`Custom`** `Chip` at the end of the quick-amount chip row to toggle it open.
   - Auto-reveal `Custom Amount` by default when a card has **no `quickAmounts` and `defaultAmount === 0`**.
8. **`#9` Smart Action Cards Grid & Tap-to-Expand Title**:
   - Grid layout: `xs={12} md={6}` (1 column on mobile, 2 columns on wide screens).
   - Long titles truncate (`noWrap`, `...`); tapping the title toggles wrapped multi-line display without widening the card (`minWidth: 0`, `overflowWrap: "anywhere"`). Clicking the chart icon or subtitle opens the card's Chart Drawer.

### Branch C — Journey (`/analytics`), Checkpoints (`/checkpoints`), & Debt Search (`/debts`)
9. **`#2` & `#3` `/analytics` ("Journey") Layout & Sorted Vault Table**:
   - Reorder sections top-to-bottom:
     1. Top KPI Cards (`NET TOTAL WEALTH`, `LIQUID & HELD VAULTS`, `OPEN RECEIVABLES`, `PAYABLES & PAYLATER`)
     2. `Cashflow Waterfall (Daily Net)`
     3. `Daily Consumption & Trendline` + `Monthly Consumption`
     4. `LayerConsumptionOverview` (`MONTHLY CONSUMPTION BY LAYER`)
     5. `Current Wealth Distribution` PieChart + full active Vault summary table matching `01.png` (`[Vault Name | Current Balance | Usage Count]`, sorted descending by `currentBalance`, including `0`-use/zero-balance active vaults) — replacing duplicate `Vault Usage Frequency` BarChart
     6. `Wealth Trajectory Timeline` + `Top Consumptive Expenses` (rendered visibly at the bottom)
10. **`#10` `/checkpoints` Hide Audit History by Default**:
    - Hide `RECENT AUDIT CHECKPOINTS & COIN COUNTS` timeline by default behind a `Show Audit History (N)` / `Hide Audit History` toggle button.
11. **`#12` `/debts` Contact Search**:
    - Add a live search box above the debt contacts grid matching party name, relationship label, phone, or notes.

### Branch D — Mobile Responsive Polish & Poco F7 Pro (`~400px`) Audit
12. **`#11` Mobile Compact Layout & Browser Audit**:
    - `/debts` KPI Summary: convert 3 stacked `xs={12}` cards into a compact 3-column mobile strip/grid (`xs={4}` / compact row with responsive typography).
    - `LayerConsumptionOverview`: use compact 2x2 grid on mobile (`xs={6} md={3}`) with tighter padding so `/` (`#7`) reaches `Smart Action Cards` smoothly on phone screens.
    - `/analytics`: use `xs={6} md={3}` across all 4 top KPIs and ensure responsive `PieChart` container sizing (`<= 400px` safe without horizontal overflow).
    - Tighter vertical margins/paddings on `xs` across `/`, `/debts`, `/analytics`, `/checkpoints`.
    - Run post-build verification using `browser` subagent at mobile Poco F7 Pro viewport (`~400x880`) against active local server.

### Answered Housekeeping (`#14`)
- `.next/trace` is Next.js's local timing/build trace log. The stray root `vault-tracking/.next/` folder is safe to remove anytime; `application/.next/` should only be cleaned when `npm run dev-pubs` is stopped.
