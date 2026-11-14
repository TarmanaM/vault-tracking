# Journal 002: Version 1 Core Implementation Complete

- **Date**: 2026-11-13
- **Status**: Implemented & Verified
- **Reference Files**:
  - [`../ListFeature.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/ListFeature.md)
  - [`../DataSchema.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/DataSchema.md)
  - [`../BusinessLogic.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/BusinessLogic.md)
  - [`../../AGENTS.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/AGENTS.md)

---

## 1. Implementasi Selesai (Versi 1)

1. **Database & Seed (`Prisma ^6.10` + `SQLite`)**:
   - 12 tabel relasional di `data-server/main.db` berhasil dimigrasi oleh user (`20261113151943_init_vault_tracking`).
   - Seeding mencakup 11 Vaults, Sub-containers (D1 & D2), 7 Parties, 17 Kategori 3-Tier lengkap dengan kode COA, dan 10 Action Cards awal dengan Habit Stats.

2. **Core In-House Services (`application/src/lib/`)**:
   - `money.js`: Presisi matematika `decimal.js` tanpa floating-point bug (Rule 14).
   - `habitEngine.js`: Algoritma skor kebiasaan 100% in-house berbasis jam (0–23), hari (Sen–Min), interval hari, dan cooldown penalty (Rule 12).
   - `ledgerService.js`: Buku besar atomik `prisma.$transaction` (Rule 13), Strict Consume Invariant (Rule 15), multi-leg mutasi, auto-split pajak 2 baris terpisah, dan write-off piutang.

3. **Backend API Endpoints (`application/src/app/api/`)**:
   - `GET /api/dashboard`: Aggregasi kekayaan bersih (Liquid + Piutang - Utang), daftar vault berjalan, action card terurut ranking skor, dan breakdown pengeluaran bulanan.
   - `GET & POST /api/transactions`: Double-entry transaction creation & filtered ledger.
   - `DELETE /api/transactions/[id]`: Reversal transaksi atomik untuk tombol Undo 5 detik.
   - `POST /api/reconcile`: Sesi audit fisik dompet D1/D2 & kalkulator keping koin + deteksi selisih uang hilang / surplus.
   - `GET /api/analytics`: Data tren waktu, heatmap 24 jam, dan pie chart untuk Drawer grafik.
   - `GET /api/export`: Ekspor Double-Entry Journal (COA 1xxx–6xxx) dan Flat CSV.
   - `POST /api/debt/write-off`: Ikhlaskan sisa piutang teman menjadi sedekah.

4. **Front-End & UI Components (`Material UI v7`, `@mui/x-charts`)**:
   - `HeaderSummary.jsx`: Kartu Net Wealth dengan popover info `(i)` (Rule 11).
   - `VaultRibbon.jsx`: Scrollable ribbon saldo per penyimpanan (klik untuk auto-chart).
   - `SmartActionCards.jsx`: Kartu aksi cepat dengan Fluid Vault Switcher (Rule 16), chip nominal, dan opsi `+ Tax/Admin Fee`.
   - `LayerConsumptionOverview.jsx`: Kartu pengeluaran Wajib, Tidak Tetap, Jajan, dan Sedekah + peringatan Uang Hilang.
   - `AutoChartDrawer.jsx`: Drawer grafik interaktif saat card/vault/layer diklik (Rule 17).
   - `ReconcileModal.jsx`: Modal cek fisik kas D1/D2 dan keping koin.
   - `ExportModal.jsx`: Dialog unduh jurnal akuntan.
   - `UndoSnackbar.jsx`: Notifikasi pop-up 5 detik dengan tombol UNDO untuk membatalkan transaksi salah pencet (Rule 17).

