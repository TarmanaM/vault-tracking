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
- `[x]` **Debt Sub-Ledger & Write-Off**: Endpoint `/api/debt/write-off` untuk mengikhlaskan piutang teman menjadi sedekah/pengeluaran konsumsi riil.
- `[x]` **Click-to-Chart Interactive Drawer**: Komponen `AutoChartDrawer.jsx` berbasis `@mui/x-charts` yang terbuka otomatis saat Card, Vault, atau Layer diklik, menampilkan grafik tren pengeluaran, timeline saldo, heatmap 24 jam, dan donut distribution.
- `[x]` **Human & Accountant Export Engine**: Endpoint `/api/export` dan komponen `ExportModal.jsx` yang menghasilkan **Standard Double-Entry Accounting Journal** (kode COA `1xxx`–`6xxx`) dan **Single-Row Flat Ledger Table** (.CSV).
- `[x]` **Clean UI & Rule 11 Compliance**: Info popover `(i)` pada Net Wealth dan 3-Tier Layer, mobile-first Material UI layout, dan 5-second Undo Snackbar (`UndoSnackbar.jsx`).

