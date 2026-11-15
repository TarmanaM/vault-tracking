# Data Schema & Taxonomy Blueprint (`Vault Tracking` v2.1 — PostgreSQL)

Dokumen ini menjadi pegangan utama Agent saat membuat schema Prisma, migrasi PostgreSQL, atau query analitik. Referensi historis rancangan awal dapat dilihat di [`../desain-data-vault-tracking.txt`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/desain-data-vault-tracking.txt), keputusan arsitektur v2.0 di [`./journal/013-backlog-04-v2-architecture.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/journal/013-backlog-04-v2-architecture.md), dan keputusan Going Public v2.1 di [`./journal/014-backlog-05-going-public-decisions.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/journal/014-backlog-05-going-public-decisions.md).

---

## 1. Simplified User Taxonomy & Automatic Accounting Layer

Untuk memudahkan semua pengguna baru (`v2.0`), antarmuka pengguna menggunakan **model 2 langkah** (**Transaction Type** -> **Category**), sementara layer akuntansi tetap terjaga otomatis di backend:

### Layer 1: `Transaction Nature` (System Enum — Pengendali Rumus Buku Besar)
- `EXPENSE`: Pengeluaran konsumsi pribadi (`consume_amount = -gross_amount`).
- `INCOME`: Pemasukan bersih (`income_amount = +gross_amount`, `consume_amount = 0`).
- `TRANSFER`: Mutasi antar penyimpanan, termasuk tarik tunai, topup e-wallet, dan kembalian koin (`consume_amount = 0`).
- `RECEIVABLE_LEND`: Uang keluar untuk meminjamkan/menalangi pihak lain (`consume_amount = 0`, menambah saldo Piutang).
- `RECEIVABLE_COLLECT`: Uang masuk dari pelunasan piutang pihak lain (`consume_amount = 0`, mengurangi saldo Piutang).
- `RECEIVABLE_WRITEOFF`: Mengikhlaskan sisa piutang teman (`consume_amount = -forgiven_amount`, mengurangi saldo Piutang menjadi 0 tanpa mutasi kas baru).
- `PAYABLE_BORROW`: Timbul utang baru / belanja via PayLater/kredit.
- `PAYABLE_REPAY`: Pelunasan pokok utang / pokok tagihan PayLater (`consume_amount = 0`).
- `INITIAL_FUND`: Pencatatan Dana Awal (Baseline Anchor) saat mulai atau checkpoint (`consume_amount = 0`).
- `RECONCILIATION_LOST`: Selisih kurang ("Unaccounted Cash Loss") saat cek fisik.
- `RECONCILIATION_FOUND`: Selisih lebih ("Bank Interest & Surplus") saat cek fisik.

### Layer 2: Spending Layers (`commitment_type`) & Silent `priority_tier` / `coa_code`
- Di UI (`/`, `/ledger`, `/settings`), user mengenal **4 Spending Layers** dalam bahasa netral:
  1. `FIXED_MANDATORY` -> **Fixed & Bills** (Kewajiban rutin, BBM, parkir, sewa, utilitas, langganan).
  2. `VARIABLE_ESSENTIAL` -> **Everyday Needs** (Makan utama/groceries, transportasi umum, kesehatan, kebutuhan harian).
  3. `DISCRETIONARY_JAJAN` -> **Lifestyle & Wants** (Kopi, jajan/kuliner, hiburan, hobi).
  4. `SOCIAL_CHARITY` -> **Giving & Gifts** (Sedekah, donasi, hadiah, piutang yang diikhlaskan).
  5. `NONE` -> Transaksi non-konsumsi (Transfer, Income, Dana Awal, Pelunasan Pokok Utang/Piutang).
- **`priority_tier`** (`PRIMER` | `SEKUNDER` | `TERSIER` | `NONE`) dan **`coa_code`** (`1xxx`–`6xxx`) dipetakan otomatis di backend sesuai Nature & Spending Layer sehingga dropdown transaksi bebas kode teknis sementara Accounting CSV Export tetap seimbang.

### Layer 3: Personalized `Category` & `ActionCard`
Kategori dimiliki penuh oleh masing-masing user (di-instantiate dari `MasterCategoryTemplate` saat onboarding atau dibuat sendiri di `/settings`) dan dapat dihubungkan ke `action_cards`.

---

## 2. Relational Database Tables (15 Multi-User Tables)

### Global / Master Tables
1. **`users`**: Akun user (`username`, `password_hash`, `full_name`, `role`: `USER` | `ADMIN`, `is_active`, `must_change_password`, `onboarding_completed`, `onboarding_skipped`, `onboarding_profile_json`).
2. **`master_category_templates`**: Katalog master kategori per modul onboarding (`CORE_SYSTEM`, `CORE_ESSENTIAL`, `VEHICLE`, `HOUSING_BILLS`, `SUBSCRIPTIONS`, `COFFEE_LIFESTYLE`, `CHARITY_SOCIAL`).
3. **`exchange_rate_cache`**: Cache kurs valas global bersama (`base_currency` -> `quote_currency`, `rate`, `rate_date`, `source`, `fetched_at`).

### User-Personalized Tables (`user_id` Scoped)
4. **`vaults`**: Daftar sumber dana milik user (`@@unique([userId, code])`), tipe `BANK`, `EWALLET`, `PHYSICAL_CASH`, `PHYSICAL_COIN`, `LIABILITY_CREDIT_LINE` (`HELD_POOL` telah dihapus). Mendukung profil visual & avatar WebP terisolasi di tabel `media_assets` (`/api/media/vaults/<id>.webp`).
5. **`vault_sub_containers`**: Kantong / sub-vault (termasuk dukungan multi-currency & default routing).
6. **`parties`**: Peran & kontak transaksi milik user (`@@unique([userId, code])`, termasuk `SELF` otomatis dibuat saat onboarding dan `is_debt_contact`).
7. **`categories`**: Kategori milik user (`@@unique([userId, code])`, `template_code`, `is_system_locked`, `coa_code` tersimpan senyap).
8. **`action_cards`**: Template kartu cepat milik user (`user_id`).
9. **`card_habit_stats`**: Profil statistik habit skor in-house per `ActionCard`.
10. **`vault_checkpoints`**: Sesi Dana Awal dan audit cek fisik berkala (`user_id`).
11. **`checkpoint_denominations`**: Rincian pecahan keping koin & sub-dompet checkpoint.
12. **`transactions`**: Header buku besar (`user_id`, snapshot FX, `gross_amount`, `consume_amount`, `income_amount`, `is_backdated`, `sub_vault_warning`).
13. **`transaction_legs`**: Baris mutasi (`debit_in`, `credit_out`, `running_vault_balance`, `running_total_wealth` terisolasi per `user_id`).
14. **`debt_ledger_entries`**: Sub-buku besar `RECEIVABLE` & `PAYABLE` milik user (`user_id`).
15. **`pending_reminders`**: Antrean pengingat/draft transaksi milik user (`user_id`).
16. **`app_settings`**: Pengaturan personal per user (`user_id @unique`) untuk `base_currency`, `fx_sync_interval_days`, status FX sync, dan `dismissed_card_suggestions_json`.
17. **`media_assets`**: Penyimpanan binary (`data Bytes` / PostgreSQL `bytea`) untuk avatar vault yang telah di-crop & dikompres ke WebP (`user_id`, `file_name`, `mime_type`, `byte_size`, `data`, `created_at`).

*(Catatan: total 17 model Prisma mencakup `User`, `MasterCategoryTemplate`, `ExchangeRateCache`, serta 14 tabel domain/setting/media milik user.)*
