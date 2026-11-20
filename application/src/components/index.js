// Central re-export barrel for @/components to ensure backwards compatibility
// and clean import paths across the application.

// Common UI
export { default as MoneyValue } from "./common/MoneyValue";
export { default as CurrencyTextField } from "./common/CurrencyTextField";
export { default as ToastProvider } from "./common/ToastProvider";
export { default as UndoSnackbar } from "./common/UndoSnackbar";
export { default as Providers } from "./common/Providers";

// Cards
export { default as SmartActionCards } from "./cards/SmartActionCards";
export { default as ManageCardsModal } from "./cards/ManageCardsModal";
export { default as PromoteToCardModal } from "./cards/PromoteToCardModal";
export { default as CardSuggestionModal } from "./cards/CardSuggestionModal";

// Vaults
export { default as VaultRibbon } from "./vaults/VaultRibbon";
export { default as VaultAvatar } from "./vaults/VaultAvatar";
export { default as VaultProfileModal } from "./vaults/VaultProfileModal";
export { default as SubVaultSyncModal } from "./vaults/SubVaultSyncModal";

// Modals
export { default as ReconcileModal } from "./modals/ReconcileModal";
export { default as ExportModal } from "./modals/ExportModal";
export { default as FxSettingsModal } from "./modals/FxSettingsModal";
export { default as AddPartyModal } from "./modals/AddPartyModal";

// Transactions
export { default as CustomTransactionModal } from "./transactions/CustomTransactionModal";
export { default as CoinExpenseControls } from "./transactions/CoinExpenseControls";

// Charts
export { default as AutoChartDrawer } from "./charts/AutoChartDrawer";
export { default as ChartCardHeaderMenu } from "./charts/ChartCardHeaderMenu";

// Dashboard
export { default as HeaderSummary } from "./dashboard/HeaderSummary";
export { default as LayerConsumptionOverview } from "./dashboard/LayerConsumptionOverview";
export { default as PendingRemindersBanner } from "./dashboard/PendingRemindersBanner";
export { default as RecentTransactionsList } from "./dashboard/RecentTransactionsList";
