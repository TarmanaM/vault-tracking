# Journal 003: Multi-Page Navigation, Android Responsiveness & Wealth Trajectory

- **Date**: 2026-11-13
- **Status**: Implemented & Verified
- **Reference Files**:
  - [`../ListFeature.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/ListFeature.md)
  - [`../../application/src/components/Navigation/AppLayout.jsx`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/src/components/Navigation/AppLayout.jsx)

---

## 1. Latar Belakang & Permintaan User
User menginginkan tampilan tidak menumpuk di 1 halaman (*dedicated pages*), dilengkapi:
1. **Collapsible Sidebar (Buka/Tutup)** untuk desktop dan **Drawer/Hamburger + Bottom Navigation Bar** untuk Android mobile UX.
2. **Chart Perjalanan Keuangan (Stock-Like Chart)**: Grafik area/line naik-turun kekayaan bersih (*Net Wealth Trajectory*) dari waktu ke waktu.
3. **Pie Chart Alokasi Total Kekayaan**: Menampilkan portofolio dana dan di mana saja uang saat ini berada (Bank Nobu, BCA, Mandiri, Cash D1/D2, Koin, Piutang).
4. **Dedicated Checkpoint & Physical Audit Center**: Halaman khusus untuk manajemen saldo penyimpanan, audit kas D1/D2 & koin, serta log riwayat rekonsiliasi.

---

## 2. Struktur Halaman & Navigasi yang Dibangun

1. **`AppLayout.jsx`**:
   - Sidebar responsif: collapsible drawer di desktop, temporary drawer di mobile.
   - Bottom Navigation Bar khusus Android/Mobile untuk akses cepat 1-jempol (`Actions`, `Journey`, `Vaults`, `Ledger`).
   - Top Header dengan status bar kekayaan bersih real-time.

2. **Dedicated Pages**:
   - **`/` (Quick Actions)**: Fokus input harian cepat (Smart Action Cards, Draft Reminders, Activity feed, 5s Undo).
   - **`/analytics` (Wealth Journey & Distribution)**: Grafik saham naik-turun Net Wealth (`wealthTimeline`), Pie Chart alokasi uang (`wealthDistributionPie`), dan 3-tier layer breakdown.
   - **`/checkpoints` (Vaults & Physical Audit)**: Kartu saldo per penyimpanan (dengan Cash D1/D2 dan keping koin) + tabel riwayat audit checkpoint.
   - **`/ledger` (Activity Ledger & Export)**: Riwayat transaksi lengkap dengan filter per Vault & Nature, serta tombol unduh Jurnal Akuntansi Double-Entry / Flat CSV.
   - **`/debts` (Debt & PayLater Sub-Ledger)**: Pantauan piutang per orang (Dada, Fernando, Slamet) dengan tombol pelunasan dan 1-klik *Write-Off / Ikhlaskan ke Sedekah*.

