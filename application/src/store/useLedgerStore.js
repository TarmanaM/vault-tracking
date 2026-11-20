// Zustand global state for UI drawers, dialogs, display toggles, toast queue, and undo actions
import { create } from "zustand";

let nextToastId = 1;

export const useLedgerStore = create((set) => ({
  // Active user's Base Currency (#2 Dynamic Base Currency across all UI components)
  baseCurrency: "IDR",
  setBaseCurrency: (currency) =>
    set({
      baseCurrency: String(currency || "IDR").trim().toUpperCase() || "IDR",
    }),

  // Display preferences (#7 Compact numbers, #8 Privacy mode default unhide)
  isCompactNumbers: true,
  toggleCompactNumbers: () =>
    set((state) => ({ isCompactNumbers: !state.isCompactNumbers })),

  isPrivacyHidden: false,
  togglePrivacyHidden: () =>
    set((state) => ({ isPrivacyHidden: !state.isPrivacyHidden })),

  // Auto-chart drawer state
  chartDrawer: {
    open: false,
    type: null, // "CARD", "VAULT", "LAYER", "PARTY"
    id: null,
    title: "",
    subtitle: "",
  },
  openChartDrawer: (type, id, title = "", subtitle = "") =>
    set({
      chartDrawer: { open: true, type, id, title, subtitle },
    }),
  closeChartDrawer: () =>
    set((state) => ({
      chartDrawer: { ...state.chartDrawer, open: false },
    })),

  // Reconcile / Audit dialog state
  reconcileDialog: {
    open: false,
    vaultId: null,
  },
  openReconcileDialog: (vaultId = null) =>
    set({
      reconcileDialog: { open: true, vaultId },
    }),
  closeReconcileDialog: () =>
    set({
      reconcileDialog: { open: false, vaultId: null },
    }),

  // Export accounting dialog state
  exportDialog: {
    open: false,
  },
  openExportDialog: () => set({ exportDialog: { open: true } }),
  closeExportDialog: () => set({ exportDialog: { open: false } }),

  // Custom transaction modal state
  transactionDialog: {
    open: false,
    presetCard: null,
  },
  openTransactionDialog: (presetCard = null) =>
    set({ transactionDialog: { open: true, presetCard } }),
  closeTransactionDialog: () =>
    set({ transactionDialog: { open: false, presetCard: null } }),

  // Manage Smart Action Cards dialog state (#23)
  manageCardsDialog: {
    open: false,
  },
  openManageCardsDialog: () => set({ manageCardsDialog: { open: true } }),
  closeManageCardsDialog: () => set({ manageCardsDialog: { open: false } }),

  // Save/Promote Transaction as Action Card dialog state
  promoteCardDialog: {
    open: false,
    transaction: null,
  },
  openPromoteCardDialog: (transaction) =>
    set({ promoteCardDialog: { open: true, transaction } }),
  closePromoteCardDialog: () =>
    set({ promoteCardDialog: { open: false, transaction: null } }),

  // Persistent save-time Action Card suggestion dialog state
  cardSuggestionDialog: {
    open: false,
    suggestion: null,
  },
  openCardSuggestionDialog: (suggestion) =>
    set({ cardSuggestionDialog: { open: true, suggestion } }),
  closeCardSuggestionDialog: () =>
    set({ cardSuggestionDialog: { open: false, suggestion: null } }),

  // Add Contact / Party dialog state (#17 & Backlog 02 #8)
  addPartyDialog: {
    open: false,
    onCreated: null,
    isDebtContact: false,
  },
  openAddPartyDialog: (onCreated = null, options = {}) =>
    set({
      addPartyDialog: {
        open: true,
        onCreated,
        isDebtContact: Boolean(options?.isDebtContact),
      },
    }),
  closeAddPartyDialog: () =>
    set({ addPartyDialog: { open: false, onCreated: null, isDebtContact: false } }),

  // Vault Add / Edit Profile dialog state (#5, #7)
  vaultProfileDialog: {
    open: false,
    mode: "CREATE", // CREATE | EDIT
    vault: null,
  },
  openVaultProfileDialog: (vault = null) =>
    set({
      vaultProfileDialog: {
        open: true,
        mode: vault ? "EDIT" : "CREATE",
        vault,
      },
    }),
  closeVaultProfileDialog: () =>
    set({
      vaultProfileDialog: { open: false, mode: "CREATE", vault: null },
    }),

  // Dynamic Sub-Vault & Sync Split dialog state (#3)
  subVaultSyncDialog: {
    open: false,
    vaultId: null,
  },
  openSubVaultSyncDialog: (vaultId = null) =>
    set({
      subVaultSyncDialog: { open: true, vaultId },
    }),
  closeSubVaultSyncDialog: () =>
    set({
      subVaultSyncDialog: { open: false, vaultId: null },
    }),

  // Global Currency & Frankfurter v2 FX Settings dialog state (#4)
  fxSettingsDialog: {
    open: false,
  },
  openFxSettingsDialog: () => set({ fxSettingsDialog: { open: true } }),
  closeFxSettingsDialog: () => set({ fxSettingsDialog: { open: false } }),

  // Chart data-point & value-label overrides (#1: AUTO follows <= 31 points rule; true/false forces visibility)
  analyticsGlobalLabelsMode: "AUTO", // AUTO | SHOW | HIDE
  setAnalyticsGlobalLabelsMode: (mode) =>
    set({
      analyticsGlobalLabelsMode: mode,
      chartLabelOverrides: {},
    }),
  chartLabelOverrides: {},
  setChartLabelOverride: (chartKey, nextBool) =>
    set((state) => ({
      chartLabelOverrides: {
        ...state.chartLabelOverrides,
        [chartKey]: nextBool,
      },
    })),

  // In-house Toast Queue (#14 & #20) replacing native alert()
  toasts: [],
  enqueueToast: (message, options = {}) =>
    set((state) => {
      const id = nextToastId++;
      const hasQuickAction = Boolean(options.undoTransactionId || options.promoteTransaction);
      const newToast = {
        id,
        title: options.title || null,
        message,
        severity: options.severity || "success", // success, info, warning, error
        variant: options.variant || "default", // default | welcome
        duration: options.duration ?? (options.variant === "welcome" ? 6500 : hasQuickAction ? 5000 : 4000),
        undoTransactionId: options.undoTransactionId || null,
        promoteTransaction: options.promoteTransaction || null,
      };
      // Keep max 4 stacked toasts visible
      return { toasts: [...state.toasts.slice(-3), newToast] };
    }),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Legacy helper mapped directly to Toast Queue so existing callers get stacked undo toasts
  showUndoSnackbar: (message, transactionId) =>
    set((state) => {
      const id = nextToastId++;
      const newToast = {
        id,
        message,
        severity: "success",
        duration: 5000,
        undoTransactionId: transactionId || null,
      };
      return { toasts: [...state.toasts.slice(-3), newToast] };
    }),

  // Global MUI Confirm Dialog (#14) replacing native confirm()
  confirmDialog: {
    open: false,
    title: "Confirm Action",
    message: "",
    confirmLabel: "Confirm",
    confirmColor: "primary",
    onConfirm: null,
  },
  openConfirmDialog: ({
    title = "Confirm Action",
    message = "",
    confirmLabel = "Confirm",
    confirmColor = "primary",
    onConfirm = null,
  }) =>
    set({
      confirmDialog: {
        open: true,
        title,
        message,
        confirmLabel,
        confirmColor,
        onConfirm,
      },
    }),
  closeConfirmDialog: () =>
    set((state) => ({
      confirmDialog: { ...state.confirmDialog, open: false, onConfirm: null },
    })),
}));
