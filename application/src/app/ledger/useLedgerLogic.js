import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export const PRESET_RANGES = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "ALL", label: "ALL" },
  { value: "CUSTOM", label: "Custom" },
];

export const NATURE_FILTERS = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "RECEIVABLE_LEND",
  "RECEIVABLE_COLLECT",
  "PAYABLE_BORROW",
  "PAYABLE_REPAY",
  "DEBT_OFFSET",
  "INITIAL_FUND",
  "RECONCILIATION_LOST",
  "RECONCILIATION_GAIN",
];

export function useLedgerLogic() {
  const queryClient = useQueryClient();
  const {
    openExportDialog,
    openTransactionDialog,
    openConfirmDialog,
    openPromoteCardDialog,
    enqueueToast,
  } = useLedgerStore();

  const [preset, setPreset] = useState("3M");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [nature, setNature] = useState("");
  const [search, setSearch] = useState("");

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: txData, isLoading, error } = useQuery({
    queryKey: ["transactions", preset, startDate, endDate, vaultId, nature, search],
    queryFn: async () => {
      const params = new URLSearchParams({ preset, limit: "150" });
      if (preset === "CUSTOM") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      if (vaultId) params.set("vaultId", vaultId);
      if (nature) params.set("nature", nature);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
      enqueueToast(`Reversed transaction "${deleted.title}"`, { severity: "info" });
    },
    onError: (err) => {
      enqueueToast(`Failed to reverse transaction: ${err.message}`, { severity: "error" });
    },
  });

  const vaults = dashboardData?.vaults || [];
  const transactions = txData?.transactions || [];
  const appliedRange = txData?.appliedRange || {};
  const baseCurrency = dashboardData?.appSettings?.baseCurrency || "IDR";

  return {
    txData,
    isLoading,
    error,
    vaults,
    transactions,
    appliedRange,
    baseCurrency,
    preset,
    setPreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    vaultId,
    setVaultId,
    nature,
    setNature,
    search,
    setSearch,
    deleteTxMutation,
    openExportDialog,
    openTransactionDialog,
    openConfirmDialog,
    openPromoteCardDialog,
  };
}
