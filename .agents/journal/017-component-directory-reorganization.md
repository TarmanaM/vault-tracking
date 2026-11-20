# 017 — UI Components Directory Reorganization (Option A)

**Date:** 2026-11-16  
**Scope:** Frontend Architecture & Component Directory Reorganization

---

## 1. Context & Motivation
Previously, 25 diverse UI components were stored directly under `application/src/components/`, mixing small atomic widgets, domain action cards, transaction forms, charts, ribbons, and modals in a single flat directory. This created friction for developers when navigating the codebase.

---

## 2. Reorganized Directory Structure

Components have been organized into clear, intuitive subdirectories under `application/src/components/`:

```text
src/components/
├── common/             # Reusable atomic UI & utility providers
│   ├── MoneyValue.jsx
│   ├── CurrencyTextField.jsx
│   ├── ToastProvider.jsx
│   ├── UndoSnackbar.jsx
│   └── Providers.js
│
├── cards/              # Smart Action Cards & habit recommendation modals
│   ├── SmartActionCards.jsx
│   ├── ManageCardsModal.jsx
│   ├── PromoteToCardModal.jsx
│   └── CardSuggestionModal.jsx
│
├── vaults/             # Vault cards, avatars, and sub-vault split dialogs
│   ├── VaultRibbon.jsx
│   ├── VaultAvatar.jsx
│   ├── VaultProfileModal.jsx
│   └── SubVaultSyncModal.jsx
│
├── transactions/       # Transaction modals & input controls
│   ├── CustomTransactionModal.jsx
│   └── CoinExpenseControls.jsx
│
├── modals/             # Global system modals (Reconciliation, Export, FX, Parties)
│   ├── ReconcileModal.jsx
│   ├── ExportModal.jsx
│   ├── FxSettingsModal.jsx
│   └── AddPartyModal.jsx
│
├── charts/             # Chart drawers & header action menus
│   ├── AutoChartDrawer.jsx
│   └── ChartCardHeaderMenu.jsx
│
├── dashboard/          # Dashboard summary widgets & banners
│   ├── HeaderSummary.jsx
│   ├── LayerConsumptionOverview.jsx
│   ├── PendingRemindersBanner.jsx
│   └── RecentTransactionsList.jsx
│
├── Navigation/         # AppLayout and shell navigation (preserved)
│   └── AppLayout.jsx
│
└── index.js            # Barrel re-export file for clean/legacy import fallback
```

---

## 3. Verification
- All 32 dependent files across `src/app/`, `src/features/`, and `src/components/` had their import paths updated.
- Created `application/src/components/index.js` as a centralized re-export barrel.
- Executed `npm --prefix application run lint` — passed cleanly with exit code `0`.
