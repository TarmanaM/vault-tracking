# Core Business Logic & Mathematical Rules (`Vault Tracking`)

Dokumen ini mendefinisikan aturan bisnis dan rumus algoritma yang wajib dipatuhi oleh Agent saat mengimplementasikan backend service maupun state di frontend.

---

## 1. Algoritma Rekomendasi Kebiasaan 100% In-House (Tanpa AI / OCR)

Saat aplikasi dibuka pada waktu `T_now` (memiliki `Hour_now` [0..23], `DayOfWeek_now` [1..7], dan selisih hari `Delta_Days` sejak Card terakhir kali dipakai), sistem mengurutkan `action_cards` berdasarkan rumus deterministik:

$$\text{Score}(\text{Card}) = (0.35 \times S_{\text{hour}}) + (0.20 \times S_{\text{dow}}) + (0.30 \times S_{\text{interval}}) + (0.15 \times S_{\text{freq}}) - P_{\text{cooldown}}$$

1. **Time-of-Day Score ($S_{\text{hour}}$)**:
   - Menghitung proporsi penggunaan Card pada window `Hour_now - 1`, `Hour_now`, dan `Hour_now + 1` dari `hour_counts_json`.
   - *Contoh*: Jam pulang kerja (17:00–19:30) otomatis mengangkat Card **Parkir Kantor (Rp 12.000)** ke urutan #1.
2. **Day-of-Week Score ($S_{\text{dow}}$)**:
   - Membedakan rutinitas Hari Kerja (Senin–Jumat) vs Akhir Pekan (Sabtu–Minggu) dari `dow_counts_json`.
3. **Interval Due Score ($S_{\text{interval}}$ — Detektor Siklus Mingguan/Bulanan)**:
   - Menggunakan kurva kedekatan terhadap rata-rata jeda hari `avg_interval_days`:
     $$S_{\text{interval}} = \exp\left(-\frac{(\Delta_{\text{days}} - \mu_{\text{interval}})^2}{2\sigma^2}\right)$$
   - *Contoh*: **Isi Bensin Skupi** yang rata-rata dibeli tiap 5–7 hari sekali akan memiliki skor rendah di hari ke-1 s/d ke-3, lalu otomatis naik ke urutan teratas ketika memasuki hari ke-5 s/d ke-7.
4. **Anti-Spam Cooldown Penalty ($P_{\text{cooldown}}$)**:
   - Jika Card bertipe harian (`DAILY_WORKDAY`) sudah diinput hari ini, berikan penalti skor agar Card tersebut turun dan digantikan oleh kebutuhan berikutnya yang belum diinput.

---

## 2. Mekanisme Dana Awal, Audit Fisik ("Uang Hilang/Tak Terduga"), & Transaksi Susulan (Backdated)

### A. Sesi Checkpoint & Deteksi Selisih Otomatis
Saat user melakukan pengecekan saldo riil per penyimpanan (`vault_checkpoints`):
- `raw_discrepancy = actual_counted_amount - system_book_balance_before`
  - Jika `raw_discrepancy < 0`: Otomatis tercatat sebagai **Uang Hilang / Lupa Tercatat** (`RECONCILIATION_LOST`).
  - Jika `raw_discrepancy > 0`: Otomatis tercatat sebagai **Uang Masuk Tak Terduga / Bunga Bank** (`RECONCILIATION_FOUND`).
- Bunga tabungan/deposito (termasuk desimal sen seperti `.21` atau `.67`) tidak memerlukan form khusus; langsung diakui sebagai keuntungan tidak tercatat saat sesi Checkpoint.

### B. Baru Ingat Transaksi Lama Sebelum Dana Awal / Checkpoint (Retroactive Absorption)
Ketika user baru ingat ada transaksi yang terjadi sebelum perhitungan Dana Awal (atau merupakan bagian dari uang hilang pada Checkpoint terakhir):
1. User menginput transaksi yang baru diingat dengan memilih opsi **Absorb into Initial Fund / Checkpoint** (`is_backdated = true`, `linked_checkpoint_id = target_id`).
2. Sistem secara atomik:
   - Menyisipkan baris transaksi baru tersebut ke Buku Besar (`transactions` & `transaction_legs`) sehingga grafik pengeluaran/kategori langsung ter-update.
   - Mengurangi `effective_anchor_amount` pada `Dana Awal` (atau mengurangi `unexplained_discrepancy_amount` pada Uang Hilang di Checkpoint terkait) sebesar nominal transaksi tersebut.
   - Menghitung ulang saldo berjalan (`running_vault_balance` & `running_total_wealth`) sehingga **saldo akhir dompet saat ini tetap 100% sinkron** tanpa berubah meleset.

---

## 3. Penanganan Uang Tunai (`CASH`: Dompet D1/D2) & Kembalian Koin (`COIN`)

User sering membayar dengan uang kertas (`CASH`) lalu menerima kembalian koin (`COIN`) dan lupa kapan pastinya konversi tersebut terjadi. Sistem menyediakan 2 jalur solusi:

1. **Saat Input Transaksi Tunai (`CASH` Only — 2 Mode Koin)**:
   - Opsi koin hanya tampil ketika sumber dana `EXPENSE` adalah Physical `CASH`.
   - **Cash + Coin Split Payment (`coinUsedAmount`)**: Contoh makan Rp 45.300 dibayar kertas Rp 44.000 (`CASH`) + koin Rp 1.300 (`COIN`) -> `CASH` berkurang `gross - coinUsed` (`-44.000`, `PRIMARY`), `COIN` berkurang `-coinUsed` (`-1.300`, `COIN_SPLIT`), `Consume = -45.300`.
   - **Got Coin Change (`coinChangeAmount`)**: Contoh harga Rp 47.400, bayar kertas Rp 50.000, kembali kertas Rp 2.000 + koin Rp 600 -> `CASH` berkurang `gross + coinChange` (`-48.000`, `PRIMARY`), `COIN` bertambah `+coinChange` (`+600`, `COIN_CHANGE`), `Consume = -47.400`.
   - **Dynamic Default Vault**: Action Card memakai vault tersering pada card tersebut -> `card.defaultVaultId` -> vault tersering bulan ini -> `CASH`; sedangkan `Custom Transaction` kosong memakai vault tersering bulan ini -> `CASH`.
2. **Saat Cek Fisik (Auto Cross-Vault Offset antara Cash & Coin)**:
   - Saat user menghitung fisik `CASH` (terbagi atas sub-dompet `D1` dan `D2`) serta kepingan `COIN` (`1000`, `500`, `200`, `100`):
   - Jika `CASH` mengalami selisih kurang (misal `-Rp 11.000`) dan `COIN` mengalami selisih lebih (`+Rp 11.000`), sistem otomatis mendeteksi pergeseran tersebut dan menawarkan 1-klik **Convert Cash Shortage to Coin Change (`TRANSFER`)** sehingga tidak dianggap sebagai uang hilang.

---

## 4. Auto-Split Pajak & Biaya Admin Transaksi (2 Baris Terpisah)

- Saat membeli sesuatu yang memiliki pajak atau biaya admin tambahan (contoh: *Beli Kopi di Cafe Rp 30.000* + *Admin/Pajak Rp 3.000*), user cukup mengisi field opsional `+ Tax / Admin Fee` di dalam Card yang sama.
- Saat disimpan, backend otomatis memecahnya menjadi **2 baris transaksi terpisah** di tabel `transactions`:
  1. **Baris Utama**: `Beli Kopi di Cafe` (`Rp 30.000`, Kategori: `Jajan > Kopi`).
  2. **Baris Pajak/Admin**: `Admin/Pajak - Beli Kopi di Cafe` (`Rp 3.000`, Kategori: `Biaya Admin & Pajak`, memiliki `parent_transaction_id` yang menunjuk ke Baris Utama).

---

## 5. Utang-Piutang, Dana Tertahan (Taspen/Dada), Write-Off, & PayLater

1. **Piutang Teman (`RECEIVABLE`)**:
   - Saat menalangi/meminjamkan uang ke teman (`Fernando`, `Ibrahim/Dada`, `Slamet`): Saldo Vault berkurang, Saldo Piutang teman bertambah, namun **`consume_amount = 0`**.
   - Saat teman membayar: Saldo Vault bertambah, Saldo Piutang teman berkurang (`consume_amount = 0`).
2. **Write-Off / Mengikhlaskan Piutang (`RECEIVABLE_WRITEOFF`)**:
   - Jika sisa piutang teman diikhlaskan, user klik tombol **Forgive / Write-Off** dan memilih kategori tujuan (**`Sedekah / Sosial`** atau **`Pengeluaran Tak Terduga`**).
   - Sistem menutup sisa piutang menjadi `Rp 0` tanpa mengubah saldo Bank/Cash, lalu mencatat nominal yang diikhlaskan ke dalam `consume_amount` agar masuk ke grafik pengeluaran/sedekah.
3. **Dana Hak Tertahan & Potong Utang (`HELD_RIGHT` & `OFFSET_DEDUCTION`)**:
   - Mendukung pencatatan dana yang belum cair penuh dari institusi (seperti kasus uang Taspen 9 juta yang baru cair sebagian ke Mandiri dan dipotong langsung untuk pelunasan utang Dada tanpa transfer terpisah).
4. **Alur PayLater (Contoh: `Shopee PayLater`) Tanpa Dobel Hitung**:
   - **Saat Belanja Pakai PayLater**: Langsung tercatat sebagai pengeluaran konsumsi (`consume_amount = -gross_amount`) pada tanggal beli + menambah saldo Utang `Shopee PayLater`.
   - **Saat Bayar Tagihan PayLater dari Bank**: Pokok tagihan dicatat sebagai pelunasan utang (`PAYABLE_REPAY`, **`consume_amount = 0`** agar tidak dobel di grafik pengeluaran), sedangkan selisih bunga/admin PayLater otomatis dipecah menjadi baris `EXPENSE` (`Bunga & Admin PayLater`).

---

## 6. Kebijakan Refund / Diskon / Koreksi Langsung

- Jika terjadi batal transaksi (refund) atau koreksi diskon, user langsung **mengedit nominal atau menghapus baris transaksi aslinya**.
- Setiap kali ada edit/hapus atau penyisipan transaksi backdated, sistem otomatis menjalankan fungsi rekalkulasi saldo berjalan (`running_vault_balance` dan `running_total_wealth`) secara berurutan berdasarkan `(transaction_date, transaction_time, id)`.

