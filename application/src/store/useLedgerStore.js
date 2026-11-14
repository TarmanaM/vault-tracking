// Zustand global state for UI drawers, dialogs, display toggles, toast queue, and undo actions
import { create } from "zustand";

let nextToastId = 1;

export const useLedgerStore = create((set) => ({
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

  // In-house Toast Queue (#14 & #20) replacing native alert()
  toasts: [],
  enqueueToast: (message, options = {}) =>
    set((state) => {
      const id = nextToastId++;
      const newToast = {
        id,
        message,
        severity: options.severity || "success", // success, info, warning, error
        duration: options.duration ?? (options.undoTransactionId ? 5000 : 4000),
        undoTransactionId: options.undoTransactionId || null,
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
