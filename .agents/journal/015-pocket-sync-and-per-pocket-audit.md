# 015 — Sub-Vault Pocket Auto-Carry, Main Vault Sync Choice & Per-Pocket Audit

**Date:** 2026-11-15  
**Scope:** Sub-Vault Pocket UX, Out-of-Sync Main Vault Adjustment, & Per-Pocket Checkpoint Reconciliation

---

## 1. Design Decisions

1. **Auto-Carry Main Vault Balance to First Base-Currency Pocket (`#1`)**
   - When a Vault already holds a base-currency opening balance (e.g. `Rp 60,000,000` from onboarding) and has `0` sub-vaults, creating its **first base-currency pocket** without an explicit `initialBalance` automatically carries `Vault.currentBalance` into that first pocket (`isSynced = true`).
   - Subsequent base-currency pockets start at `0` (or accept an explicit split).

2. **Explicit Main Vault Adjustment vs Keep Main Vault in Sub-Vault Sync (`#1`)**
   - When synced base-currency pockets exceed `Vault.currentBalance` (e.g. Pocket 1 `60M` + Pocket 2 `10M` = `70M` vs Main Vault `60M`), `SubVaultSyncModal` now presents two explicit choices:
     - **Adjust Main Vault to Match Pockets (`adjustMainVaultToMatch: true`)**: Records the difference (`+10M`) as a clean `INITIAL_FUND` checkpoint & transaction (`incomeAmount = 0`, `consumeAmount = 0`) so analytics remain unpolluted, and updates `Vault.currentBalance` + ledger running balances atomically.
     - **Keep Main Vault & Flag Out-of-Sync (`adjustMainVaultToMatch: false`)**: Leaves `Vault.currentBalance` untouched and flags the vault as Out-of-Sync for manual re-allocation.

3. **Per-Pocket Checkpoint Audit & Clean `INITIAL_FUND` Semantics (`#2`, `#3`)**
   - **`checkpointType = "INITIAL_FUND"`**: Positive discrepancies in `recordVaultReconciliation` now record `nature = "INITIAL_FUND"` (`incomeAmount = 0`, `consumeAmount = 0`, category `SYS_INITIAL_FUND`) instead of `RECONCILIATION_FOUND` (`incomeAmount > 0`), preventing opening/baseline funds from inflating monthly income analytics. `AUDIT_SYNC` continues to record `RECONCILIATION_FOUND` / `RECONCILIATION_LOST`.
   - **Per-Pocket Audit**: When a vault has custom pockets (non-`CASH` D1/D2, non-`COIN`), `ReconcileModal` switches to a per-pocket checklist where the user can audit 1, several, or all pockets:
     - Base-currency pockets update both the pocket balance and `Vault.currentBalance` by the discrepancy, recording a ledger adjustment linked to `subContainerId`.
     - Foreign-currency (`Valas`) pockets update their native `VaultSubContainer.currentBalance` without corrupting the base-currency `Vault.currentBalance`, AND now also record a ledger `Transaction` (`RECONCILIATION_LOST` / `RECONCILIATION_FOUND` / `INITIAL_FUND`) with `currency`, `originalGrossAmount`, `fxRateApplied`, and converted `grossAmount` (so Cashflow Waterfall & Ledger track foreign pocket discrepancies using the cached FX rate, while keeping `TransactionLeg.netMutation = 0` so `Vault.currentBalance` in base currency stays clean).

---

## 2. Files Modified
- `application/src/server/modules/vaults/vaults.service.js`
- `application/src/lib/subVaultService.js`
- `application/src/components/SubVaultSyncModal.jsx`
- `application/src/server/modules/reconcile/reconcile.service.js`
- `application/src/components/ReconcileModal.jsx`
