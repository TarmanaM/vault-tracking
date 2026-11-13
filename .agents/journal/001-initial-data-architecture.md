# Journal 001: Initial Data Architecture & Real-Case Decisions

- **Date**: 2026-11-10
- **Status**: Approved by User (via `/grill-me` sessions)
- **Reference Files**:
  - [`../../desain-data-vault-tracking.txt`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/desain-data-vault-tracking.txt)
  - [`../DataSchema.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/DataSchema.md)
  - [`../BusinessLogic.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/BusinessLogic.md)

---

## 1. Latar Belakang Masalah (Dari Spreadsheet `Financial Management.xlsx`)
User sebelumnya mencatat keuangan menggunakan Google Form yang masuk ke Excel (`Buku Besar Update`, `Month Checkpoint`, `Draft Transaksi`, `Preprocess`, `Sheet6 Koin`). Kendala utama di spreadsheet:
1. Input manual memakan waktu; user membutuhkan **Action Cards** yang muncul otomatis berdasarkan kebiasaan jam & hari (misal pulang kerja bayar parkir, siang makan/kopi, mingguan isi bensin) **100% in-house tanpa OCR atau AI**.
2. Kolom `Jenis` di Excel masih mencampuradukkan tingkat kebutuhan (`Primer/Sekunder/Tersier`), kategori (`Transportasi/Jajan`), dan sifat buku (`Dana Awal/Piutang`).
3. Saat pengecekan `Dana Awal` / audit fisik, user harus membongkar buku besar untuk mencari "uang hilang" atau "uang masuk tak terduga", serta harus mengurangi `Dana Awal` secara manual jika baru ingat ada transaksi sebelum perhitungan dana awal.
4. Utang-piutang (termasuk kasus dana Taspen tertahan & utang Dada) harus ditulis Debit/Kredit manual.
5. Sering lupa kapan uang kertas (`CASH` D1/D2) dipakai dan kembaliannya berubah menjadi koin (`COIN`).

---

## 2. Keputusan Desain Hasil Diskusi (`/grill-me`)

1. **Tidak Ada Pengkotakan Uang Dingin (Fluid Vaults)**:
   - Semua sumber dana (`BCA`, `NOBU`, `MANDIRI`, `JAGO`, `CASH`, dll.) bersifat likuid agar user bisa bertransaksi langsung dari rekening yang bebas biaya admin tanpa perlu transfer antar-bank.
2. **Pajak/Admin Transaksi vs Bunga Bank**:
   - Pajak/biaya admin saat beli sesuatu (misal beli kopi Rp 30.000 + admin Rp 3.000) diinput melalui field opsional di dalam Card yang sama, namun **otomatis dipecah menjadi 2 baris transaksi terpisah** di Buku Besar (`parent_transaction_id`).
   - Bunga tabungan/deposito tidak perlu dicatat rutin manual; langsung dianggap sebagai *keuntungan tidak tercatat* (`RECONCILIATION_FOUND`) saat sesi Checkpoint.
3. **Refund / Pembatalan / Diskon**:
   - Langsung mengedit nominal atau menghapus baris transaksi aslinya (diikuti auto-recalculation saldo berjalan), tanpa membuat jurnal balik yang memperumit daftar transaksi.
4. **Write-Off / Mengikhlaskan Piutang Teman**:
   - Disediakan fitur *Write-Off* pada piutang yang otomatis mengonversi sisa piutang menjadi kategori **`Sedekah / Sosial`** atau **`Pengeluaran Tak Terduga`** agar masuk ke grafik pengeluaran (`Consume`).
5. **Alur PayLater (Contoh: `Shopee PayLater`)**:
   - Diperlakukan sebagai sumber dana hutang (`LIABILITY`). Saat beli barang langsung masuk ke grafik `Consume` + timbul utang ke `Shopee PayLater`. Saat bayar tagihan dari Bank, pokok utang dicatat sebagai pelunasan (`Consume = 0` agar tidak dobel hitung) dan bunganya otomatis terpecah jadi baris pengeluaran bunga/admin.
6. **Pending Reminders / Draft Cards**:
   - Tabel `pending_reminders` untuk menampung pengingat sementara di atas layar ketika nominal belum pasti (misal tanya teman harga kopi atau pengingat jatuh tempo PayLater).
7. **Ekspor Jurnal Akuntansi Standar (Human & Accountant Friendly)**:
   - Dilengkapi kode akun COA (`1xxx`–`6xxx`) otomatis untuk mengekspor tabel **Double-Entry Accounting Journal** maupun **Single-Row Flat Table**.
8. **Aturan Agent & Konvensi Bahasa**:
   - Seluruh operasi tulis database wajib atomik (`prisma.$transaction`), presisi sen (`.21`, `.67`) terjaga, UI sistem berbahasa Inggris dengan tombol info `(i)`, sedangkan nama data milik user tetap menggunakan bahasa sehari-hari user.

