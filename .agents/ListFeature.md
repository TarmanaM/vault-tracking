# Feature Checkpoint & Roadmap (`Vault Tracking`)

Dokumen ini mencatat status seluruh modul yang sudah dirancang maupun yang akan dikembangkan (sesuai **Rule 1** pada `AGENTS.md`).

---

## Status Legend
- `[x]` **Designed & Specified** (Desain data & aturan bisnis sudah dikunci)
- `[ ]` **Pending Implementation** (Menunggu instruksi user untuk mulai tahap coding)

---

## Phase 1: Data Architecture & Agent Context (COMPLETED)
- `[x]` **3-Tier Transaction Taxonomy**: Pemisahan Layer 1 (`Nature`), Layer 2 (`Commitment: Mandatory / Variable Essential / Discretionary Jajan / Social` + `Priority: Primer / Sekunder / Tersier`), dan Layer 3 (`Functional Category`).
- `[x]` **12-Table Relational Schema Design**: Blueprint SQL & ERD lengkap di [`desain-data-vault-tracking.txt`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/desain-data-vault-tracking.txt) dan [`./DataSchema.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/DataSchema.md).
- `[x]` **Agent Context & Guardrails**: Setup `AGENTS.md`, `DataSchema.md`, `BusinessLogic.md`, dan `journal/001-initial-data-architecture.md`.

---

## Phase 2: Database & Seed Foundation (COMPLETED)
- `[x]` **Core Package Installation (`application/`)**: Next.js 15 (JS, App Router, Turbopack), MUI v7, Emotion, `@mui/x-charts`, `decimal.js`, TanStack Query v5, Zustand, Prisma ^6.10, JWT & bcryptjs.
- `[x]` **Prisma Schema & SQLite Setup (`data-server/main.db`)**: 12 tabel relasional aktif dengan dukungan presisi sen (`.21`, `.67`) dan atomic transaction helpers. Migrasi `20261113151943_init_vault_tracking` sukses dieksekusi user.
- `[x]` **Initial Master Seed (From User's Excel)**:
  - Seed 11 Penyimpanan (`BANK BCA`, `BANK NOBU`, `BANK MANDIRI`, `BANK JAGO`, `GOPAY`, `SPAY`, `DANA`, `CASH` [Sub-container `D1`, `D2`], `COIN` [1000, 500, 200, 100], `TASPEN`, `SHOPEE_PAYLATER`).
  - Seed 7 Peran (`Isa`, `Ibrahim/Dada`, `Fernando/Nando`, `Slamet/Amet`, `DDV`, `Taspen`, `Shopee PayLater`).
  - Seed 10 Action Cards awal lengkap dengan profil Habit Stats.

---

## Phase 3: Core Ledger & Smart Action Cards Engine (COMPLETED)
- `[x]` **In-House Habit Recommendation Engine**: Algoritma skor deterministik in-house (`habitEngine.js`) berbasis jam (`00–23`), hari (`Senin–Minggu`), dan jeda interval (`avg_interval_days`) + anti-spam cooldown.
- `[x]` **1-Tap & Quick-Amount Action Cards UI**: Komponen `SmartActionCards.jsx` dengan *Quick Vault Pill Switcher*, chip nominal cepat, opsi `+ Tax / Admin Fee` (Auto-Split 2 baris), dan *5-Second Undo Toast*.
- `[x]` **Pending Reminders & Draft Cards Banner**: Komponen `PendingRemindersBanner.jsx` untuk catatan cepat dan reminder tagihan yang dapat langsung dikonversi menjadi transaksi.
- `[x]` **Custom & Backdated Transaction Modal**: Komponen `CustomTransactionModal.jsx` untuk input transaksi manual dan transaksi susulan masa lalu.
- `[x]` **Atomic Double-Entry Engine (`ledgerService.js`)**: Pembuatan transaksi atomik multi-legs, auto-split pajak terpisah, dan pemenuhan Strict Consume Invariant (Rule 15).

---

## Phase 4: Reconciliation, Coin Calculator, & Backdated Absorption (COMPLETED)
- `[x]` **Initial Fund & Periodic Checkpoint Audit**: Endpoint `/api/reconcile` dan komponen `ReconcileModal.jsx` yang mendeteksi otomatis *Uang Hilang* (`RECONCILIATION_LOST`) dan *Surplus / Bunga Bank* (`RECONCILIATION_FOUND`).
- `[x]` **Physical Cash (`D1/D2`) & Coin Denomination Calculator**: Form hitung fisik dompet `D1`/`D2` dan keping koin (`1000`, `500`, `200`, `100`) dengan kalkulasi subtotal instan.
- `[x]` **Retroactive / Backdated Absorption Engine**: Service penyerapan transaksi lama yang otomatis memotong `Dana Awal` atau mengurangi angka `Uang Hilang` tanpa merusak saldo akhir.

---

## Phase 5: Debt/PayLater Sub-Ledger, Interactive Charts, & Accounting Export (COMPLETED)
- `[x]` **Debt Sub-Ledger & Write-Off**: Endpoint `/api/debt/write-off`, `/api/debts`, dan halaman dedicated `/debts` untuk mengikhlaskan piutang teman menjadi sedekah/pengeluaran konsumsi riil.
- `[x]` **Wealth Journey Stock-Like Chart**: Grafik pergerakan kekayaan bersih naik-turun dari waktu ke waktu (seperti grafik saham) di `/analytics`.
- `[x]` **Total Wealth Portfolio Pie Chart**: Donut/Pie Chart di `/analytics` yang menunjukkan distribusi total kekayaan dan di mana saja uang tersimpan saat ini.
- `[x]` **Dedicated Pages & Responsive Navigation**: Komponen `AppLayout.jsx` dengan sidebar collapsible untuk desktop, drawer buka/tutup & bottom navigation bar untuk Android mobile, serta dedicated pages (`/`, `/analytics`, `/checkpoints`, `/ledger`, `/debts`).
- `[x]` **Click-to-Chart Interactive Drawer**: Komponen `AutoChartDrawer.jsx` berbasis `@mui/x-charts` yang terbuka otomatis saat Card, Vault, atau Layer diklik.
- `[x]` **Human & Accountant Export Engine**: Endpoint `/api/export` dan komponen `ExportModal.jsx` yang menghasilkan **Standard Double-Entry Accounting Journal** (kode COA `1xxx`–`6xxx`) dan **Single-Row Flat Ledger Table** (.CSV).
- `[x]` **Excel General Ledger Injector Tool**: Script `inject-excel.js` (`npm run inject-excel`) untuk menyuntikkan data transaksi nyata dari sheet *Buku Besar Update* `Financial Management.xlsx` ke database SQLite lokal secara atomik, presisi sen, dan otomatis menghasilkan mockup penuh.
- `[x]` **Clean UI & Rule 11 Compliance**: Info popover `(i)` pada Net Wealth dan 3-Tier Layer, mobile-first Material UI layout, dan 5-second Undo Snackbar (`UndoSnackbar.jsx`).

---

## Phase 6: Backlog v2 Overhaul & Debt Sub-Ledger Expansion (IMPLEMENTED)
- `[x]` **Analytics Overhaul (`/analytics`)**: Stacked interval Cashflow Waterfall Chart (`4.png`), Daily Consumption negative curve with linear trendline (`1..png`), Monthly Consumption negative bars (`2.png`), Top Consumptive Expenses list (`3.png`), Vault Usage Frequency chart (`#6`), Wealth Trajectory Timeline (`#5`), Month-over-Month Net Wealth comparison badge (`#24`), and Date Range Filters (`1M`/`3M`/`6M`/`YTD`/`ALL`/`CUSTOM`, `#xx`).
- `[x]` **Ledger Date Range & Search (`/ledger`)**: Date range presets (`1M`/`3M`/`6M`/`YTD`/`ALL`/`CUSTOM`), keyword search, counterparty external bank badge, and atomic reverse confirmation modal.
- `[x]` **Global Compact/Exact & Full Privacy Mode**: Global top-bar compact toggle (`1jt` vs `Rp Full`) + local tap-to-exact `<MoneyValue>` (`#7`), full Privacy Eye masking (`#8`) across KPIs, cards, tables, and chart axes/tooltips, plus live thousand-dot `<CurrencyTextField>` inputs (`#9`).
- `[x]` **In-House Toast Stack & Confirm Dialog (`ToastProvider.jsx`)**: Replaced all native browser `alert()`/`confirm()` with stacked MUI toasts + 5-second Undo actions and global confirm modal (`#14`, `#20`).
- `[x]` **Smart Action Cards v2**: Recommended vs All Cards & Search tabs, 2-tier visibility hiding (`SOFT_HIDDEN` vs `ARCHIVED`), `ManageCardsModal.jsx` (create/edit/restore cards), inline manual amount input (`#16`), and 1-tap `X` Reset card button (`#18`).
- `[x]` **Reconcile & Retroactive Precision**: Fixed `runningTotalWealth` chronological recompute in `POST /api/reconcile`, full React Query invalidation (`#19`), exact Date + Time + `Now` picker (`#10`), auto-detected retroactive warning (`#15`), removed recent transactions snippet from `/` (`#12`), and Amber Warning styling for Unaccounted Cash Shortage (`#13`).
- `[x]` **Two-Way Debt, Payables, External Bank Notes & Merge**: `+ Add Contact` modal, `PAYABLE_BORROW` (`EXPENSE_TALANG` vs `CASH_LOAN`), `PAYABLE_REPAY` & `RECEIVABLE_COLLECT` with specific vs FIFO `"Totalan"`, external bank note autocomplete (`externalAccountsJson`), partial/FIFO Write-Off (`#21`), dedicated Party Detail Page `/debts/[id]` (`#22`), separated Receivables/Payables without auto-netting, and Manual Offset Merge (`DEBT_OFFSET`, `#22-2`).

---

## Phase 7: Backlog 02 — Mobile UX, Coin Split, & Dynamic Defaults (IMPLEMENTED)
- `[x]` **Home `/` Layout & Action Cards Polish**: Reordered `/` (`HeaderSummary -> LayerConsumptionOverview -> SmartActionCards -> VaultRibbon`, with `PendingRemindersBanner` auto-promoting only when active reminders exist), Vault Ribbon sorted descending by balance (`#5`), Recommended cards capped to `5` + incremental `+5 more` (`#6`), `Custom Amount` hidden behind a `Custom` chip (`#1`), 2-column desktop / 1-column mobile cards with tap-to-wrap long titles (`#9`).
- `[x]` **Dynamic Default Vaults & Cash/Coin Engine (`#4`)**: Card default falls back dynamically (`card habit vault -> card.defaultVaultId -> current month top vault -> CASH`); blank Custom Transactions default to current month's most-used vault -> `CASH`. Fixed `ledgerService.js` Coin Change math (`CASH -(gross + coinChange)` & `COIN +coinChange`), added Cash+Coin Split Payment (`CASH -(gross - coinUsed)` & `COIN -coinUsed`), extracted `CoinExpenseControls.jsx` shown ONLY when Physical `CASH` is picked for `EXPENSE`.
- `[x]` **Journey `/analytics` & Sorted Vault Table (`#2`, `#3`)**: Reordered sections (`KPIs -> Cashflow Waterfall -> Daily & Monthly Consumption -> Monthly Layer Overview -> Wealth Distribution PieChart + Sorted Vault Breakdown Table [Vault | Current Balance | Uses] -> Wealth Trajectory Timeline & Top Consumptive Expenses`).
- `[x]` **Debt Contact Separation & Search (`#8`, `#12`)**: Added `Party.isDebtContact` (`schema.prisma` + migration `20261114010633_add_party_debt_contact_flag`), kept regular `INCOME`/`EXPENSE` parties hidden from `/debts`, added live contact search on `/debts`, and compressed `/debts` KPI cards into a 3-column horizontal strip (`#11`).
- `[x]` **Checkpoints & Mobile Compact Polish (`#10`, `#11`)**: Collapsed Audit Checkpoints timeline behind a `Show Audit History` toggle on `/checkpoints`, switched Monthly Consumption Layer cards to 2x2 mobile grid (`xs={6}`), and made `/analytics` KPIs 2x2 on mobile.

---

## Phase 8: Backlog 03 — Sub-Vaults, Multi-Currency FX, Vault Profiles & Chart UX (IMPLEMENTED)
- `[x]` **Chart Data Points & Value Labels (`#1`)**: Added `ChartCardHeaderMenu.jsx` (`ChartCardHeaderMenu` `⋮` menu, `ChartDotLabelMark` custom SVG dot + halo value labels, `useChartLabelVisibility`) across `/analytics` and `AutoChartDrawer.jsx`, plus global `Labels: Auto (<=31) / All ON / All OFF` toggle on `/analytics` and Privacy-aware compact `formatShortAxis` formatting.
- `[x]` **Mobile Sidebar Overlay Fix & FX Settings (`#2`)**: Elevated mobile temporary `<Drawer>` above fixed `AppBar`, added `Isa Tarmana • Owner` sidebar header + **Add New Vault** & **Currency & FX** quick tools in `AppLayout.jsx`.
- `[x]` **Dynamic Sub-Vaults & Spillover Detection (`#3`)**: Schema migration `backlog_03_subvaults_fx_profiles` adding `VaultSubContainer.currency`, `isDefault`, `currentBalance`, `isSynced`, and `Vault.subVaultOutOfSync`/`subVaultSyncNote`; `subVaultService.js` implementing mandatory Default routing, non-mutating `Sync Split`, 2-pocket Auto-Fill vs 3+ pocket Unallocated Pool, and non-blocking spillover warnings (`Transaction.subVaultWarning`) reversible via Undo (`deleteAndReverseTransaction`).
- `[x]` **Multi-Currency Valas & Frankfurter v2 Sync (`#4`)**: Added `AppSetting` & `ExchangeRateCache` tables + `fxService.js`, `/api/settings/fx`, `/api/settings/fx/sync`, and `FxSettingsModal.jsx` (strict active-only Frankfurter v2 sync scoped only to currencies held by active Sub-Vaults and auto-disabled when only base currency is used; passive cache retention; configurable `baseCurrency` & `fxSyncIntervalDays` default `3`, manual rate overrides, live mark-to-market Vault valuation vs locked historical transaction rates).
- `[x]` **Vault Management, Profiles & Canvas Cropper (`#5`, `#7`)**: Added `/api/vaults`, `/api/vaults/[id]`, `/api/vaults/[id]/sub-vaults`, `/api/media/vaults`, `/api/media/[...path]` (`data-server/media/vaults/`), `VaultAvatar.jsx`, `VaultProfileModal.jsx` (Initials default + `<input type="color">` picker + MUI Icons + HTML5 `<canvas>` zoom/pan cropper with simultaneous Square & Circle previews), `SubVaultSyncModal.jsx`, and full management controls on `/checkpoints` + `VaultRibbon.jsx`.
- `[x]` **Action Hierarchy, Pickers & Flagship Transaction Modal (`#6`, `#8`, `#9`)**: Placed prominent `+ Transaction` CTA above `SmartActionCards` on `/`, removed `+ Custom Tx` from `SmartActionCards.jsx`, upgraded `CustomTransactionModal.jsx` with Segmented Nature Pills, Hero Amount + Currency/FX preview, Visual Vault + Sub-Vault Pocket pills, `@mui/x-date-pickers` (`DatePicker`/`TimePicker` + `dayjs`), and collapsible *More Options*.

---

## Phase 9: Save Transaction as Action Card (IMPLEMENTED)
- `[x]` **Two Seamless Entry Points**: Row button **Save as Card** in `/ledger` on unlinked eligible operational transactions (plus linked `Card: <title>` badge on linked rows), and instant **`+ CARD`** button beside `UNDO (5s)` inside `ToastProvider.jsx` right after recording an ad-hoc custom transaction.
- `[x]` **Pre-Filled Review Modal (`PromoteToCardModal.jsx`)**: Pre-populates Title, Action Type, Default Amount (preserving native Valas currency when applicable), Quick Amount presets, Source Vault/Sub-Vault, Target Vault/Target Sub-Vault (`TRANSFER`), Category, Party, Cadence, and 1-Tap switch; detects active duplicate cards cleanly to offer **Link to Existing Card** vs **Create Separate Card**.
- `[x]` **Automatic Habit Seeding & 24h Spotlight (`habitEngine.js` & `cardPromotionService.js`)**: Seeds `CardHabitStats` chronologically from matching historical entries (`seedCardHabitStatsFromTransactions`) without altering older historical rows (`actionCardId` linked strictly to the source transaction), assigns `pinPriority = 8`, and grants a 24-hour spotlight window inside Top 5 Recommended before decaying to standard habit scoring.
- `[x]` **Transfer Target Sub-Vault & Native Valas Card Execution**: Schema migration `add_action_card_target_subcontainer` adding `ActionCard.targetSubContainerId`, plus native Valas formatting & currency-aware submission inside `SmartActionCards.jsx` and `ManageCardsModal.jsx`.
- `[x]` **Title Autocomplete & Save-Time Persistent Suggestion (`012-title-autocomplete-card-suggestion.md`)**: Reordered `CustomTransactionModal.jsx` (Title + Category above Hero Amount & Vault) with combined `[Card]` + `[History]` autocomplete (`/api/transactions/title-suggestions`) that preserves user-typed custom amounts, plus deterministic post-save suggestion evaluation (`/api/transactions` -> `CardSuggestionModal.jsx` with `"Do You Want to Make a Card?"` / `"Link to Existing Card?"`, factual reasons, and cross-device `"Don't Ask Again"` via `AppSetting.dismissedCardSuggestionsJson` migration `add_dismissed_card_suggestions`).

---

## Phase 10: Backlog 04 (v2.0) — Multi-User, Onboarding & Generic Taxonomy (COMPLETED)
- `[x]` **Schema & Master Catalog Foundation (`013-backlog-04-v2-architecture.md`)**: Updated `schema.prisma` for multi-user `userId` isolation, `User` auth/onboarding fields (`USER`/`ADMIN`, `isActive`, `mustChangePassword`), `MasterCategoryTemplate` (`master-catalog.json` seeded via `prisma/seed.js`), per-user `AppSetting`, complete `HELD_POOL`/`heldFundBalance` removal, and archived `inject-excel` scripts to root `archive/`.
- `[x]` **Authentication & Privacy-First Admin Lifecycle (`/login`, `/force-password-change`, `/admin`)**: HTTP-only JWT cookie auth (`auth.js`, `middleware.js`), closed Admin-only user creation, live `isActive` session revocation, temporary password enforcement, and strict isolation blocking Admin from accessing other users' ledgers or uploaded media.
- `[x]` **Onboarding Interview & Default Skip Preset (`/onboarding`)**: Guided currency, lifestyle modules, and starter vault setup (`onboardingService.js`, `/api/onboarding`, `/onboarding`) + ready-to-use default preset when skipped.
- `[x]` **Dedicated Settings & Personalize Page (`/settings`)**: Custom category CRUD/archive & Master template quick-add (`/api/categories`, `/api/categories/[id]`, `/settings`) with `(i)` taxonomy guidance, FX/currency management, password update, and setup re-run.
- `[x]` **Complete Backend & UI `userId` Scoping + Neutral Taxonomy Cleanup**: Scoped all APIs, `ledgerService.js`, `fxService.js`, `subVaultService.js`, `cardPromotionService.js`, media routes, neutral 4 Spending Layers (`Fixed & Bills`, `Everyday Needs`, `Lifestyle & Wants`, `Giving & Gifts` via `spendingLayers.js`), hid `[coaCode]` prefixes in transaction dropdowns, and removed legacy `Taspen`/`HELD_POOL` references across UI.


