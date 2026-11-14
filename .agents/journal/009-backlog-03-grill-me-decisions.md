# Journal 009 — Backlog 03 Alignment Decisions (`/grill-me`)

- **Source Backlog**: `.agents/backlog/03/note.txt` (`#1`–`#9`)
- **Status**: Aligned with User (Ready for Phase-by-Phase Implementation Approval)

## 1. Sub-Vault Partitions & Multi-Currency Valas (`#3`, `#4`)
- **Currency Level**: Currency attaches at the **`Sub-Vault` (`VaultSubContainer`)** level (defaulting to App **Base Currency** `IDR`), while parent Vaults aggregate native + estimated Base Currency (`IDR`) totals.
- **Default Sub-Vault**: Every Vault that has Sub-Vaults enforces one **`isDefault: true`** Sub-Vault (e.g., `D1` on `CASH`, or the first created Sub-Vault on any other Vault). If a transaction or 1-Tap Action Card omits choosing a Sub-Vault, the backend automatically routes to the Vault's Default Sub-Vault (zero extra friction).
- **Sync Split vs Top-Up**:
  - **Sync Sub-Vault (`Sync Split`)** adjusts Sub-Vault partition balances inside an existing Main Vault **without increasing or decreasing Main Vault total balance**.
  - Main Vault balances change only via transactions (`INITIAL_FUND`, `INCOME`, `EXPENSE`, `TRANSFER`, etc.) or full Vault Reconcile.
- **2-Sub-Vault Auto-Fill & `>= 3` Unallocated Pool + Spillover Warning (same-currency group)**:
  - When syncing one Sub-Vault and **exactly 1** other same-currency Sub-Vault exists (unsynced/auto), remaining `Main Vault Balance - Synced Sub-Vault Balance` automatically fills that second Sub-Vault.
  - When **`>= 2` other same-currency Sub-Vaults remain unsynced** (total `>= 3`), neither auto-fills; remainder stays in an **Unallocated Pool**.
  - Spending from any Sub-Vault never blocks (`Rule 16`). If spending exceeds available Unallocated Pool and encroaches on another synced Sub-Vault (e.g. `13jt` spent via `Sub 3` when `Unallocated = 10jt` & `Sub 1 = 5jt`), the transaction succeeds and flags the Vault / Sub-Vault with an **Out-of-Sync Warning badge** highlighting partition drift.
- **FX Exchange Rates & Frankfurter Sync (`#4`)**:
  - Configurable **Base Currency** (default `IDR`), **Sync Interval** (default `3` days), and **Sync Now** action stored in SQLite (`AppSettings` / `ExchangeRateCache`).
  - Backend fetches `https://api.frankfurter.dev/v2/...` server-side **at most once per configured interval** (or on explicit manual `Sync Now`), never on UI re-render.
  - **Standard Accounting Split**: Live Vault / Sub-Vault balances & Net Wealth revalue dynamically (*mark-to-market*) using the latest cached DB exchange rate; historical transactions lock their **`fxRateApplied` snapshot** at entry time so historical monthly consumption/income does not shift retroactively.

## 2. Vault Management, Profile Pictures & Cropper (`#5`, `#7`)
- **Location**: `+ Add Vault` & `Edit Vault Profile / Sub-Vaults` integrated into Vaults (`/checkpoints`) page plus `+ Add` shortcut in `VaultRibbon`.
- **Default Symbol & Color Picker**: New/existing Vaults default to a clean **Initials Avatar** derived from the Vault name + an interactive **Color Picker** (`<input type="color">`, hex input, and optional swatches).
- **Icon / Image Upload Cropper**: Supports picking an icon or uploading a custom image cropped in-house via HTML5 `<canvas>` (zoom + pan) with **simultaneous Square & Circle live previews** before saving.
- **Image Storage**: Cropped images saved to `data-server/media/vaults/` and served via `/api/media/[...path]` (guarantees instant serving in `npm run start` production without rebuild/static-manifest `404` and keeps user assets cleanly inside `data-server/`).

## 3. Navigation, Charts & Flagship Record Transaction Flow (`#1`, `#2`, `#6`, `#8`, `#9`)
- **`#1` Chart Data Points & Numeric Labels**: Display circle markers on `LineChart` and compact value labels (`formatShortAxis`, respecting Privacy Mode) on `BarChart` & `LineChart` (`/analytics` and `AutoChartDrawer`), skipping labels on the dashed `Linear Trend` series. Auto-ON when series points `<= 31`; each chart card gets a `⋮` menu toggle plus global Show/Hide All toggle in `/analytics` header.
- **`#2` Mobile Sidebar Overlay Fix + Settings**: Fix mobile temporary `<Drawer>` in `AppLayout.jsx` (`zIndex` / top navbar spacing) so the top sidebar **Owner Profile / App Header** is never obscured on phone viewports, and add **Currency & FX Settings** entry inside the sidebar.
- **`#8` Action Flow Hierarchy**: Render a dedicated prominent **`(+ Transaction)`** button **above `Smart Action Cards`** on `/` and remove `+ Custom Tx` from `SmartActionCards.jsx`.
- **`#6` & `#9` Record Transaction Backbone Overhaul**: Install **`@mui/x-date-pickers` (Free MIT Community Edition) + `dayjs`** for touch-friendly Date & Time pickers laid out spaciously (full row / 2-row + `Now` button) inside a **Fintech Transaction Flow**: `fullScreen` on mobile (`xs`), color-coded Segmented Nature Pills, Hero Amount display (currency-aware with live IDR estimate), Visual Vault/Sub-Vault Picker Pills, contextual Cash Coin / Debt panels, and grouped optional fields (`Admin Fee`, `Notes`, `Manual FX Override`).

## 4. Verification Note
- Per Backlog 03 `#` note: Browser testing is deferred until explicitly requested after implementation.
