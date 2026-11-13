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

## Phase 2: Database & Seed Foundation (IN PROGRESS)
- `[x]` **Core Package Installation (`application/`)**: Next.js 15 (JS, App Router, Turbopack), MUI v7, Emotion, `@mui/x-charts`, `decimal.js`, TanStack Query v5, Zustand, Prisma ^6.10, JWT & bcryptjs.
- `[ ]` **Prisma Schema & SQLite Setup (`data-server/main.db`)**: Implementasi 12 tabel dengan dukungan presisi sen (`.21`, `.67`) dan atomic transaction helpers. *(Note: Migrasi wajib dieksekusi oleh user via `npx prisma migrate dev`).*
- `[ ]` **Initial Master Seed (From User's Excel)**:
  - Seed Penyimpanan (`BANK BCA`, `BANK NOBU`, `BANK MANDIRI`, `BANK JAGO`, `GOPAY`, `SPAY`, `DANA`, `CASH` [Sub-container `D1`, `D2`], `COIN` [1000, 500, 200, 100], `TASPEN`, `SHOPEE_PAYLATER`).
  - Seed Peran (`Isa`, `Ibrahim/Dada`, `Fernando/Nando`, `Slamet/Amet`, `DDV`, `Taspen`, `Shopee PayLater`).
  - Seed 15 Action Cards awal (*Parkir Kantor Rp 12.000*, *Bensin Skupi Rp 38.000*, *Kopi FM*, *Makan Siang*, *Sarapan*, *Rokok*, *Warnet*, *Gajian DDV*, dll.).

---

## Phase 3: Core Ledger & Smart Action Cards Engine (NOT STARTED)
- `[ ]` **In-House Habit Recommendation Engine**: Perhitungan skor real-time berbasis jam (`00–23`), hari (`Senin–Minggu`), dan siklus interval hari (`avg_interval_days`) + anti-spam cooldown.
- `[ ]` **1-Tap & Quick-Amount Action Cards UI**: Dilengkapi *Quick Vault Pill Switcher*, field opsional `+ Tax / Admin Fee` (Auto-Split 2 baris), opsi *Coin Change to COIN*, dan *5-Second Undo Toast*.
- `[ ]` **Pending Reminders / Draft Banner**: Kartu pengingat di bagian atas layar untuk transaksi yang belum pasti nominalnya (*"Tanya Nando kopi berapa"*, *"Tagihan SPayLater"*).

---

## Phase 4: Reconciliation, Coin Calculator, & Backdated Absorption (NOT STARTED)
- `[ ]` **Initial Fund & Periodic Checkpoint Audit**: Deteksi otomatis *Uang Hilang* (`RECONCILIATION_LOST`) dan *Uang Masuk Tak Terduga / Bunga Bank* (`RECONCILIATION_FOUND`).
- `[ ]` **Physical Cash (`D1/D2`) & Coin Denomination Calculator**: Hitung kepingan koin (`1000`, `500`, `200`, `100`) + *Auto Cross-Vault Offset* (deteksi otomatis uang kertas `CASH` yang berubah jadi `COIN`).
- `[ ]` **Retroactive / Backdated Transaction Absorption**: Input transaksi lama yang baru diingat dengan otomatis memotong `Dana Awal` atau mengurangi angka `Uang Hilang` agar saldo akhir tetap 100% sinkron.

---

## Phase 5: Debt/PayLater Sub-Ledger, Interactive Charts, & Accounting Export (NOT STARTED)
- `[ ]` **Human-Friendly Debt & PayLater Manager**: Alur *Lend/Talangi*, *Collect/Terima Bayar*, *Forgive/Write-Off to Charity*, *Held Fund Offset (Kasus Taspen/Dada)*, dan *PayLater Billing* tanpa dobel hitung `Consume`.
- `[ ]` **Click-to-Chart Interactive Drawer**: Klik Card (Action Card, Layer Pengeluaran, Vault, atau Party) langsung membuka grafik tren waktu, komposisi Donut Chart, dan statistik frekuensi + tombol info `(i)`.
- `[ ]` **Human & Accountant Export Engine**: Ekspor ke format **Standard Double-Entry Accounting Journal** (dengan kode COA `1xxx`–`6xxx` seimbang Debit = Kredit) dan **Single-Row Flat Ledger Table** (`.CSV` / `.XLSX` / `.TXT`).

