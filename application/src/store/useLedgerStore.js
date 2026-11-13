// Zustand global state for UI drawers, dialogs, and undo snackbar
import { create } from "zustand";

export const useLedgerStore = create((set) => ({
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

  // 5-second Undo snackbar state (Rule 17)
  undoSnackbar: {
    open: false,
    message: "",
    transactionId: null,
  },
  showUndoSnackbar: (message, transactionId) =>
    set({
      undoSnackbar: { open: true, message, transactionId },
    }),
  closeUndoSnackbar: () =>
    set((state) => ({
      undoSnackbar: { ...state.undoSnackbar, open: false },
    })),
}));

