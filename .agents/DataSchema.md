# Data Schema & Taxonomy Blueprint (`Vault Tracking`)

Dokumen ini menjadi pegangan utama Agent saat membuat schema Prisma, migrasi SQLite, atau query analitik. Referensi lengkap dan simulasi kasus dapat dilihat di [`../desain-data-vault-tracking.txt`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/desain-data-vault-tracking.txt).

---

## 1. Three-Tier Transaction Taxonomy (Layer Jenis Transaksi)

Di spreadsheet lama, kolom `Jenis` mencampur sifat kebutuhan, kategori, dan status buku. Di sistem ini, setiap transaksi dipetakan ke 3 Layer otomatis:

### Layer 1: `Transaction Nature` (System Enum — Pengendali Rumus Buku Besar)
- `EXPENSE`: Pengeluaran konsumsi pribadi (`consume_amount = -gross_amount`).
- `INCOME`: Pemasukan bersih (`income_amount = +gross_amount`, `consume_amount = 0`).
- `TRANSFER`: Mutasi antar penyimpanan, termasuk tarik tunai, topup e-wallet, dan kembalian koin (`consume_amount = 0`).
- `RECEIVABLE_LEND`: Uang keluar untuk meminjamkan/menalangi pihak lain (`consume_amount = 0`, menambah saldo Piutang).
- `RECEIVABLE_COLLECT`: Uang masuk dari pelunasan piutang pihak lain (`consume_amount = 0`, mengurangi saldo Piutang).
- `RECEIVABLE_WRITEOFF`: Mengikhlaskan sisa piutang teman (`consume_amount = -forgiven_amount`, mengurangi saldo Piutang menjadi 0 tanpa mutasi kas baru).
- `PAYABLE_BORROW`: Timbul utang baru / belanja via PayLater.
- `PAYABLE_REPAY`: Pelunasan pokok utang / pokok tagihan PayLater (`consume_amount = 0`).
- `INITIAL_FUND`: Pencatatan Dana Awal (Baseline Anchor) saat mulai atau checkpoint (`consume_amount = 0`).
- `RECONCILIATION_LOST`: Selisih kurang ("Uang Hilang / Lupa Tercatat") saat cek fisik.
- `RECONCILIATION_FOUND`: Selisih lebih ("Uang Masuk Tak Terduga / Bunga Bank") saat cek fisik.

### Layer 2: `Commitment Type` & `Priority Tier` (Dimensi Analisis Bulanan)
Terisi otomatis dari default `Category` atau `ActionCard` tanpa perlu diinput manual oleh user:
1. **`commitment_type`**:
   - `FIXED_MANDATORY`: Pengeluaran wajib rutin (Parkir kantor, Bensin mingguan, Kuota internet).
   - `VARIABLE_ESSENTIAL`: Kebutuhan penting namun fluktuatif (Makan siang/sarapan, Servis motor/oli, Dokumen/Paspor).
   - `DISCRETIONARY_JAJAN`: Jajan & gaya hidup yang fleksibel (Kopi FM/Nescafe, Sate/Cafe, Warnet, Rokok).
   - `SOCIAL_CHARITY`: Sosial, sedekah, sumbangan, atau piutang yang diikhlaskan.
   - `NONE`: Untuk transaksi non-pengeluaran (Transfer, Gaji, Dana Awal, Pelunasan Pokok Utang/Piutang).
2. **`priority_tier`**:
   - `PRIMER` | `SEKUNDER` | `TERSIER` | `NONE`.

### Layer 3: `Functional Category` & `Action Card`
Kategori fungsional (*Parkir*, *BBM/Bensin*, *Makan Utama*, *Kopi & Minuman*, *Jajan & Kuliner*, *Hiburan*, *Admin & Pajak*, *Gaji*, dll.) yang dihubungkan ke kartu aksi cepat (`action_cards`).

---

## 2. Relational Database Tables (14 Core Tables)

1. **`vaults`**: Daftar sumber dana (`BCA`, `NOBU`, `MANDIRI`, `JAGO`, `GOPAY`, `SPAY`, `DANA`, `CASH`, `COIN`, `TASPEN`, serta akun kewajiban seperti `SPAYLATER`, maupun Vault baru buatan user).
   - Mendukung presisi desimal sen (`Decimal(18,2)`), flag `has_sub_containers`, `has_denominations` (untuk `COIN`: keping 1000, 500, 200, 100), konfigurasi profil (`symbol_mode`: `INITIALS` | `ICON` | `IMAGE`, `icon_name`, `profile_image_url` via `/api/media/vaults/...`, `color_hex`), serta status sekat (`sub_vault_out_of_sync`, `sub_vault_sync_note`).
2. **`vault_sub_containers`**: Menyimpan sub-vault / kantong untuk Vault apa pun (`D1`/`D2` pada `CASH`, sub-vault bebas nama di bank/dompet, maupun sub-vault valas seperti `USD`/`SGD`/`EUR`).
   - Menyimpan `currency` (default `IDR`), `is_default` (fallback routing otomatis bila user tidak memilih sub-vault), `current_balance`, `last_counted_balance`, `is_synced`, `color_hex`, dan `sort_order`.
3. **`parties`**: Menyimpan subjek/peran transaksi (`ISA` sebagai `SELF`, `IBRAHIM` / Dada, `FERNANDO` / Nando, `SLAMET` / Amet, `DDV`, `TASPEN`, `SHOPEE_PAYLATER`).
   - Menyimpan cache `receivable_balance`, `payable_balance`, `net_receivable_balance`, `held_fund_balance`, serta flag `is_debt_contact` (`true` hanya untuk kontak sub-ledger `/debts` atau yang memiliki histori utang/piutang).
4. **`categories`**: Master kategori beserta mapping default Layer 1, Layer 2, dan kode akun akuntansi (`coa_code`).
5. **`action_cards`**: Template kartu input cepat tanpa OCR/AI. Menyimpan `default_vault_id`, `default_sub_container_id`, `target_vault_id`, `target_sub_container_id`, `default_amount`, `quick_amounts_json`, `one_tap_submit`, `pin_priority`, dan `expected_cadence`.
6. **`card_habit_stats`**: Profil statistik penggunaan per Card (`hour_counts_json` [24 slot], `dow_counts_json` [7 slot], `avg_interval_days`, `std_interval_days`, `last_used_timestamp`).
7. **`vault_checkpoints`**: Sesi pencatatan `Dana Awal` dan audit/cek fisik berkala.
   - Menyimpan `original_counted_amount`, `retroactive_deduction_total` (total potongan dari transaksi lama yang baru diingat), `effective_anchor_amount`, `system_book_balance_before`, `raw_discrepancy_amount`, `resolved_discrepancy_amount`, dan `unexplained_discrepancy_amount`.
8. **`checkpoint_denominations`**: Rincian perhitungan keping koin (`1000`, `500`, `200`, `100`) dan sub-dompet (`D1`, `D2`) saat sesi checkpoint.
9. **`transactions`**: Header buku besar.
   - Menyimpan `created_at` (waktu input sebenarnya), `transaction_date`, `transaction_time`, `title`, `nature`, `category_id`, `commitment_type`, `priority_tier`, `party_id`, `action_card_id`, snapshot mata uang (`currency`, `original_gross_amount`, `fx_rate_applied`), `gross_amount`, `consume_amount`, `income_amount`, `is_backdated`, `sub_vault_warning`, `linked_checkpoint_id`, dan `parent_transaction_id` (untuk relasi transaksi utama dengan baris Pajak/Admin yang di-split otomatis).
10. **`transaction_legs`**: Baris mutasi masuk (`debit_in`) dan keluar (`credit_out`) per penyimpanan (`vault_id` dan opsional `sub_container_id`), lengkap dengan `currency`, `fx_rate_applied`, `original_mutation`, `running_vault_balance`, dan `running_total_wealth`.
11. **`debt_ledger_entries`**: Sub-buku besar untuk melacak piutang teman (`RECEIVABLE`), utang pribadi/PayLater (`PAYABLE`), dan dana hak tertahan (`HELD_RIGHT` seperti kasus Taspen/Dada), lengkap dengan metode penyelesaian (`CASH_OR_BANK`, `OFFSET_DEDUCTION`, `WRITEOFF_FORGIVEN`).
12. **`pending_reminders`**: Antrean pengingat/draft ringan di bagian atas layar (misal *"Tanya Nando kopi berapa"* atau *"Tagihan SPayLater tgl 5"*) sebelum dikonversi menjadi transaksi penuh.
13. **`app_settings`**: Pengaturan aplikasi singleton (`id = 1`) untuk `base_currency` (default `IDR`), `fx_sync_interval_days` (default `3`), `last_fx_synced_at`, `last_fx_status`, `last_fx_error`, dan `dismissed_card_suggestions_json` (daftar pasangan `nature::title` yang di-mute dari pop-up saran card).
14. **`exchange_rate_cache`**: Cache kurs valas lokal (`base_currency` -> `quote_currency`, `rate`, `rate_date`, `source`, `fetched_at`) yang disinkronisasi berkala dari `https://api.frankfurter.dev/v2/`.

---

## 3. Standard Chart of Accounts (COA) Mapping for Accounting Export

Setiap kategori, vault, dan party dipetakan ke kode akun standar agar sistem dapat mengekspor tabel **Double-Entry Accounting Journal** maupun **Single-Row Flat Table**:

- **`1xxx` ASSETS (Aset & Piutang)**
  - `1101`: Cash in Wallet (`CASH` - D1/D2)
  - `1102`: Coin Stash (`COIN`)
  - `1111`: Bank BCA | `1112`: Bank Nobu | `1113`: Bank Mandiri | `1114`: Bank Jago
  - `1121`: E-Wallets (`GOPAY`, `SPAY`, `DANA`)
  - `1201`: Accounts Receivable - Friends/Family (`Piutang Pihak Ketiga`)
  - `1209`: Held/Pending Benefit Receivable (`Piutang Dana Tertahan - Taspen`)
- **`2xxx` LIABILITIES (Kewajiban / Utang)**
  - `2101`: PayLater Payable (`Utang Shopee PayLater`)
  - `2102`: Personal Loans Payable (`Utang Pihak Ketiga`)
- **`3xxx` EQUITY (Modal / Dana Awal)**
  - `3101`: Opening Balance Equity (`Modal Dana Awal`)
  - `3201`: Retroactive Opening Adjustment (`Koreksi Dana Awal Transaksi Susulan`)
- **`4xxx` REVENUE / INCOME (Pemasukan)**
  - `4101`: Salary Income (`Pendapatan Gaji - DDV`)
  - `4201`: Family & Benefit Grant (`Penerimaan Taspen / Keluarga`)
  - `4901`: Unaccounted Surplus / Bank Interest (`Pendapatan Bunga & Selisih Lebih Checkpoint`)
- **`5xxx` MANDATORY & ESSENTIAL EXPENSES (Beban Pokok / Wajib & Tidak Tetap Penting)**
  - `5101`: Parking Expense (`Beban Parkir`)
  - `5102`: Fuel / BBM Expense (`Beban Bensin`)
  - `5103`: Public Transport & Ride-Hailing (`Beban Transportasi Umum/Ojol`)
  - `5104`: Vehicle Maintenance (`Beban Perawatan Kendaraan`)
  - `5201`: Primary Meals (`Beban Makan Utama - Sarapan/Siang/Malam`)
  - `5301`: Communication & Internet (`Beban Kuota & Komunikasi`)
  - `5401`: Education & Official Admin (`Beban Pendidikan & Dokumen`)
- **`6xxx` DISCRETIONARY, SOCIAL & FINANCIAL FEES (Beban Jajan, Gaya Hidup, Sosial & Admin)**
  - `6101`: Coffee & Beverages (`Beban Jajan Kopi & Minuman`)
  - `6102`: Snacks, Street Food & Cafe (`Beban Jajan Kuliner & Nongkrong`)
  - `6201`: Entertainment & Personal Habit (`Beban Hiburan, Warnet & Rokok`)
  - `6301`: Charity, Gifts & Forgiven Debt (`Beban Sedekah, Sosial & Write-Off Piutang`)
  - `6401`: Transaction Tax, Admin Fee & PayLater Interest (`Beban Pajak Transaksi, Admin & Bunga PayLater`)
  - `6901`: Unexplained Cash Shortage (`Beban Selisih Kas / Uang Hilang Checkpoint`)

