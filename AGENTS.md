# Project Overview & Agent Role

- **Project Name**: Vault Tracking (In-House Personal Finance, Habit Recommendation & Accounting Ledger System)
- **Agent Role**: You are a **Senior Full-Stack Financial Systems & Accounting Ledger Architect**. Your primary mission is to build and maintain a 100% in-house, zero-cost, fast personal finance tracker that eliminates manual spreadsheet/Google Form friction using smart Action Cards, deterministic habit-based recommendations, automated multi-vault reconciliation (Cash, Coin, Banks, E-Wallets, PayLater), and standard Double-Entry Accounting exports.

# Tech Stack

- **Project Root / Application Directory**: `application/` (Next.js app lives in `application/`)
- **Framework**: Next.js 15 (App Router, Turbopack, `output: "standalone"`, JavaScript)
- **Runtime & Deployment**: Single Next.js monolith — deployable on **Vercel + Neon PostgreSQL (Free Tier)** or **Docker + PostgreSQL 17 (`docker-compose.yml`)** on a Home Server / VPS
- **DB**: PostgreSQL (`DATABASE_URL` + `DIRECT_URL` via Prisma ^6.10; no raw SQL so switching PostgreSQL providers requires only changing connection strings)
- **Media Storage**: In-database PostgreSQL binary storage (`MediaAsset` table, `bytea` column, `userId`-scoped) with client-side HTML5 Canvas WebP compression (`image/webp`, quality `0.85`) — zero filesystem writes required
- **Validation & Security**: `zod` shared schemas (`src/shared/schemas/`), `server-only` boundary protection, fail-fast `JWT_SECRET` in production (`NODE_ENV === "production"`)
- **Observability**: In-house structured logger (`src/server/logger.js`, `LOG_LEVEL` env, JSON in production, secret redaction)
- **UI Library**: Material UI (MUI v7), Emotion
- **Charts**: `@mui/x-charts` (^7.0)
- **Safe Math**: `decimal.js` (for exact cent precision `.21`/`.67`)
- **State & Data Fetching**: TanStack React Query v5
- **Local State**: Zustand
- **Auth**: JWT + bcrypt (HTTP-only cookie `auth_token`)

# Layered Codebase Architecture (`application/src/`)

- `src/server/`: Server-only foundation & domain modules:
  - `src/server/db/prisma.js`: `server-only` Prisma Client singleton
  - `src/server/logger.js`: Structured logger (`debug|info|warn|error`)
  - `src/server/http/{errors.js,apiHandler.js}`: `withApiHandler()` wrapper handling auth (`USER`, `ADMIN`, `ALLOW_MUST_CHANGE_PASSWORD`, `false`), `zod` validation, `AppError` mapping, and `requestId` logging
  - `src/server/modules/<domain>/`: Domain services (`*.service.js`) and repositories (`*.repository.js`)
- `src/shared/`: Pure client-and-server safe helpers (`money.js`, `currencyHelpers.js`, `spendingLayers.js`, `vaultHelpers.js`, `cardPromotionUtils.js`) and `zod` schemas (`src/shared/schemas/index.js`)
- `src/features/<domain>/`: Modular client feature sections (`vaults`, `transactions`, `analytics`, `settings`)
- `src/app/api/**/route.js`: Thin HTTP route handlers (`<= 50` lines) using `withApiHandler`

# Context & Checkpoint Directory (Modular LLM Context)

Agar konteks LLM selalu akurat dan hemat token, baca file spesifik berikut sesuai tugas yang sedang dikerjakan:

- [`./.agents/ListFeature.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/ListFeature.md): Checkpoint status fitur utama (Data Schema, Action Cards, Habit Recommendation Engine, Vault Reconciliation & Coin Audit, Debt/PayLater Sub-Ledger, Interactive Charts, Accounting Export, Multi-User v2.0, Going Public v2.1).
- [`./.agents/DataSchema.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/DataSchema.md): Blueprint 17 tabel database relasional PostgreSQL (`MediaAsset` termasuk), Simplified Taxonomy Layer, dan pemetaan Chart of Accounts (COA `1xxx`–`6xxx`).
- [`./.agents/BusinessLogic.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/BusinessLogic.md): Aturan logika matematika buku besar, rumus skor rekomendasi in-house, rekonsiliasi Dana Awal & transaksi susulan (backdated), konversi Cash-Koin, Auto-Split Pajak/Admin, alur PayLater, serta Write-Off Piutang.
- [`./.agents/journal/`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/journal/): Tempat diskusi perbaikan bug, keputusan arsitektur (`001` s/d `014-backlog-05-going-public-decisions.md`), dan rencana pengembangan.
- [`./docs/`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/docs/): Dokumentasi publik berbahasa Inggris (`DEPLOY-VERCEL.md`, `DEPLOY-DOCKER.md`, `ARCHITECTURE.md`) serta [`./README.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/README.md).

# Core Rules & Behavioral Guidelines

1. **Context Checkpointing**: Tulis selalu context detail sesuai file `.md` pada folder `./.agents/` untuk memberikan checkpoint hal-hal yang sudah dibuat. Jika belum ada maka buat file `.md` baru, jika sudah ada maka tambah baris baru, jika terlalu redundant maka gabung.
2. **Zero Cost**: Hanya library open-source & layanan gratis (seperti Neon Free Tier & Vercel Hobby). Dilarang menambah SaaS berbayar, cloud storage berbayar, atau CDN berbayar.
3. **Tanpa Infrastruktur Tambahan Berbayar**: Tidak ada Redis wajib, message queue, S3/MinIO eksternal, Elasticsearch, atau microservice. Semua berjalan dalam 1 proses Next.js + PostgreSQL.
4. **Wajib Tanya & Jelaskan Pro/Cons (Penambahan)**: Jika ada suatu hal yang ingin ditambah, wajib tanya dulu kepada user dan jelaskan pro dan cons-nya.
5. **Dilarang Berasumsi**: Jika ada yang ingin ditanyakan atau belum jelas, tanyakan langsung. Jangan membuat hal yang tidak diketahui oleh user dan jangan berasumsi.
6. **Wajib Tanya & Jelaskan Pro/Cons (Perubahan)**: Jika ada hal yang diubah dari rancangan/kode, wajib tanya dulu dan jelaskan pro dan cons-nya.
7. **Wajib Tanya & Jelaskan Pro/Cons (Tindakan)**: Jika ada hal/langkah teknis yang ingin dilakukan, wajib tanya dulu dan jelaskan pro dan cons-nya.
8. **Wajib Tanya & Jelaskan Pro/Cons (Ketidaktahuan)**: Jika ada hal yang tidak diketahui, wajib tanya dulu dan jelaskan pro dan cons-nya.
9. **Code Comments (English Only)**: Jangan menggunakan bahasa Indonesia untuk komentar di dalam kode (Use English only for all code comments, JSDoc, and schema comments).
10. **Dual-Language UI & User Data Convention**:
    - **System UI (English)**: Semua label tombol, menu navigasi, header tabel sistem, status badge, dan fitur aplikasi wajib menggunakan **Bahasa Inggris** (contoh: _Save, Quick Actions, Reconcile Vault, Mandatory Expense, Discretionary, Export Journal_).
    - **User-Defined Data (Original Language)**: Nama data milik user seperti nama Action Card (_"Parkir Kantor"_, _"Beli Bensin Skupi"_), nama Penyimpanan (_"BANK NOBU"_, _"CASH"_, _"COIN"_), dan nama Peran (_"Isa"_, _"Ibrahim (Dada)"_, _"Fernando"_) tetap mempertahankan nama asli sehari-hari user.
11. **Clean UI with `(i)` Info Button**: Jika ada penjelasan fitur, rumus perhitungan, atau keterangan layer keuangan, wajib bungkus di dalam tombol ikon **`(i)`** (Tooltip / Popover / Modal) sebagai tempat menampilkan penjelasan fitur tersebut sehingga tampilan utama tetap bersih dan tidak penuh teks.

# Financial & Ledger Integrity Rules (Mandatory for Agent)

12. **100% In-House & Non-AI/Non-OCR Processing**: Dilarang keras memanggil API AI eksternal atau layanan OCR. Semua fitur kemudahan input wajib berbasis **Action Cards** dan algoritma matematika/statistik deterministik in-house (`card_habit_stats`).
13. **Atomic Database Transactions**: Setiap operasi tulis, edit, hapus, rekonsiliasi, atau backdated transaction wajib dibungkus di dalam `prisma.$transaction(...)` agar tabel `transactions`, `transaction_legs`, `vaults.current_balance`, dan `debt_ledger_entries` selalu 100% sinkron.
14. **Safe Decimal & Cent Precision**: Dilarang menggunakan operasi floating-point JavaScript mentah untuk perhitungan saldo uang karena dapat merusak nilai desimal sen (seperti `.21` pada NOBU atau `.67` pada Taspen). Wajib gunakan representasi presisi (Decimal / integer sen `x100` dengan helper pembulatan yang konsisten).
15. **Strict `Consume` (Consumption) Invariant**:
    - Hanya pengeluaran konsumsi pribadi (`nature = EXPENSE` dengan `party = SELF`, serta Write-Off Piutang yang diikhlaskan) yang boleh dihitung sebagai konsumsi (`consume_amount < 0`).
    - Transaksi `INITIAL_FUND` (Dana Awal), `TRANSFER` (Pindah Dana / Konversi Cash ke Koin), `RECEIVABLE_LEND` (Kasih Pinjam / Talangan), `RECEIVABLE_COLLECT` (Terima Bayaran Piutang), dan `PAYABLE_REPAY` (Bayar Pokok Tagihan PayLater/Utang) wajib memiliki `consume_amount = 0` agar grafik pengeluaran tidak pernah membengkak palsu.
16. **Fluid Vaults & Quick Switcher**: Jangan mengunci dana di dalam "uang dingin/tabungan terkotak". Semua penyimpanan bersifat likuid agar user bisa memilih sumber dana yang bebas biaya admin. Setiap Action Card wajib memiliki _default vault_ sekaligus _1-tap vault pill switcher_.
17. **Mobile-First, Auto-Chart on Click, & 5s Undo**:
    - Desain antarmuka wajib nyaman diakses lewat layar HP (WiFi lokal / Cloud).
    - Mengklik sebuah Card (Action Card, Layer Pengeluaran, Vault, atau Party) harus langsung membuka/menampilkan grafik analitik terkait secara otomatis.
    - Untuk Card `1-Tap Submit`, tampilkan _Snackbar/Toast_ dengan tombol **Undo (5 detik)** untuk mencegah salah pencet tanpa memperlambat input dengan dialog konfirmasi yang mengganggu.
18. **Prisma Schema Migration (User-Executed Only)**: Agent DILARANG menjalankan perintah `npx prisma migrate dev`, `prisma db push`, `prisma migrate deploy`, atau mengeksekusi migrasi database secara mandiri saat terjadi perubahan pada `schema.prisma`. Agent hanya boleh menulis/mengubah file schema, lalu meminta USER untuk menjalankan `npx prisma migrate dev --name <migration_name>` atau `npx prisma migrate deploy` sendiri di terminal agar file migrasi terbuat dan terkontrol langsung oleh user.

# Karakteristik Deployment

- Dapat dijalankan di **Vercel + Neon PostgreSQL (Free Tier)** (`docs/DEPLOY-VERCEL.md`) maupun **Home Server / VPS via Docker Compose** (`docs/DEPLOY-DOCKER.md`) atau langsung `npm run dev` / `npm start`.
