import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useDebtsLogic() {
  const queryClient = useQueryClient();
  const { openTransactionDialog, openAddPartyDialog, enqueueToast } = useLedgerStore();

  const [infoAnchor, setInfoAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [writeOffModal, setWriteOffModal] = useState({
    open: false,
    debtEntry: null,
    partyName: "",
    maxAmount: 0,
    amount: "",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await fetch("/api/debts");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/debt/write-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (createdTx) => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setWriteOffModal({
        open: false,
        debtEntry: null,
        partyName: "",
        maxAmount: 0,
        amount: "",
        notes: "",
      });
      enqueueToast("Receivable written off (Ikhlaskan)", {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
    },
    onError: (err) => {
      enqueueToast(`Write-off failed: ${err.message}`, { severity: "error" });
    },
  });

  const summary = data?.summary || {};
  const externalParties = (data?.parties || []).filter(
    (p) => p.code !== "SELF" && p.partyType !== "SELF"
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredParties = externalParties.filter((p) => {
    if (!normalizedQuery) return true;
    const matchName = p.name?.toLowerCase().includes(normalizedQuery);
    const matchType = p.partyType?.toLowerCase().includes(normalizedQuery);
    const matchAliases = p.aliasesJson?.toLowerCase().includes(normalizedQuery);
    const matchAccounts = (p.externalAccounts || []).some((acc) =>
      acc.toLowerCase().includes(normalizedQuery)
    );
    return matchName || matchType || matchAliases || matchAccounts;
  });

  return {
    data,
    isLoading,
    error,
    summary,
    filteredParties,
    infoAnchor,
    setInfoAnchor,
    searchQuery,
    setSearchQuery,
    writeOffModal,
    setWriteOffModal,
    writeOffMutation,
    openTransactionDialog,
    openAddPartyDialog,
  };
}
