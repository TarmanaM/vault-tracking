# Journal 008 — Backlog 02 Implementation & Verification Notes

- **Aligned Spec**: `.agents/journal/007-backlog-02-grill-me-decisions.md`
- **Migration Applied**: `20261114010633_add_party_debt_contact_flag` (User-executed)

## Implemented Files
- `application/prisma/schema.prisma`, `application/prisma/seed.js`, `application/prisma/inject-excel.js`
- `application/src/lib/vaultHelpers.js` (Shared `isPhysicalCashVault`, `isPhysicalCoinVault`, `isSelectableSpendVault`, `sortVaultsByBalanceDesc`)
- `application/src/lib/ledgerService.js` (`coinUsedAmount` split payment leg `COIN_SPLIT`, fixed `coinChangeAmount` deducting `gross + coinChange` from `CASH`, checkpoint reversal precision, automatic `isDebtContact` promotion on debt transactions)
- `application/src/app/api/dashboard/route.js`, `application/src/app/api/analytics/route.js`, `application/src/app/api/debts/route.js`, `application/src/app/api/parties/route.js`
- `application/src/store/useLedgerStore.js`, `application/src/components/AddPartyModal.jsx`, `application/src/components/CoinExpenseControls.jsx`
- `application/src/components/CustomTransactionModal.jsx`, `application/src/components/SmartActionCards.jsx`, `application/src/components/Navigation/AppLayout.jsx`
- `application/src/components/HeaderSummary.jsx`, `application/src/components/LayerConsumptionOverview.jsx`, `application/src/components/VaultRibbon.jsx`
- `application/src/app/page.js`, `application/src/app/analytics/page.js`, `application/src/app/checkpoints/page.js`, `application/src/app/debts/page.js`, `application/src/app/debts/[id]/page.js`, `application/src/components/ReconcileModal.jsx`

## Post-Audit Layout Fix Pass (MUI v7 `<Grid size>`)
- **Root Cause Found in First Live Chrome Audit**: `@mui/material@^7.3.11` ignores legacy MUI v5 `<Grid item xs=... sm=... md=... lg=...>` props without `size={{ ... }}`, causing shrink-to-content Grid panels (`PieChart` squashed on `/analytics`, `SmartActionCards` 1 column on desktop, unstable 2x2 `LayerConsumptionOverview` on `400px` mobile, narrow KPI boxes/search bar on `/debts`).
- **Fixes Applied**:
  - Migrated all `<Grid item ...>` usages across `analytics/page.js`, `SmartActionCards.jsx`, `LayerConsumptionOverview.jsx`, `debts/page.js`, `debts/[id]/page.js`, `checkpoints/page.js`, `CustomTransactionModal.jsx`, and `ReconcileModal.jsx` to MUI v7 `<Grid size={{ ... }}>`.
  - Updated `PieChart` in `analytics/page.js` with `slotProps.legend` (`direction: "horizontal"`, `position: { vertical: "bottom", horizontal: "center" }`) and `Box` height `295` / `height={285}` so donut geometry renders full-width cleanly on both `400x880` and `1280x800`.
  - Widened `/debts` search input `maxWidth: { sm: 520 }` and raised `AppLayout.jsx` mobile bottom padding from `72px` to `96px`.

## Verification Status (2026-11-14)
- **Ledger & Data Integrity (`verify-backlog-02.mjs`, pre-JSX Grid fix)**: Passed all assertions (`#5` vault balance sort, `#4` split payment `45,300 = 44,000 CASH + 1,300 COIN` + Undo, `#4` coin change math `47,400 + 600 -> -48,000 CASH, +600 COIN` + Undo, `#8` `isDebtContact` isolation & promotion). Backend ledger/API files were untouched after this run.
- **ESLint (`npm --prefix application run lint`, after final edit)**: Passed (`0` errors, `0` warnings).
- **Production Build & Server (`npm run build && npm run start`, user-executed after final edit)**: Clean build and live server running on `http://localhost:3000`.
- **Live Browser Re-Audit (`400x880` touch/standard mobile & `1280x800` desktop, after final rebuild)**:
  - **Console / Page / Network**: `0` console errors, `0` page errors, `0` MUI Grid/Charts sizing errors or unknown-prop warnings, `0` HTTP `>= 400` responses across `/`, `/analytics`, `/debts`, `/debts/2`, `/checkpoints`.
  - **Home `/`**: `#1`, `#4`, `#5`, `#6`, `#7` (`LayerConsumptionOverview` symmetric `2x2` on `400x880`, `4x1` on desktop), `#9` (`SmartActionCards` `2` equal cols on `1280x800`, `1` full-width col on `400x880`, `+5 more` clear of `BottomNavigation` with `96px` bottom padding) — **PASS**.
  - **Analytics `/analytics`**: `#2` (`Current Wealth Distribution` `PieChart` unclipped circular donut with horizontal bottom legend alongside `5:7` sorted Vault Breakdown table on desktop, full width on mobile), `#3` section order, `#11` `2x2` mobile / `4x1` desktop KPIs, zero overflow — **PASS**.
  - **Debts `/debts` & `/debts/2`**: `#8`, `#11` (`3` equal `1/3` KPI cards), `#12` (unclipped desktop search bar + live filter), read-only `/debts/2` `50/50` desktop / stacked mobile layout — **PASS**.
  - **Checkpoints `/checkpoints`**: `3` cols desktop / `1` col mobile vault cards, `#10` (`Show Audit History` toggle clears `BottomNavigation` on `400x880`) — **PASS**.
