import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export function usePartyDebtDetailLogic() {
  const params = useParams();
  const partyId = params?.id;
  const queryClient = useQueryClient();

  const { openTransactionDialog, openConfirmDialog, enqueueToast } = useLedgerStore();

  const [selectedRecIds, setSelectedRecIds] = useState([]);
  const [selectedPayIds, setSelectedPayIds] = useState([]);
  const [offsetAmount, setOffsetAmount] = useState("");
  const [offsetNotes, setOffsetNotes] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const [writeOffModal, setWriteOffModal] = useState({
    open: false,
    debtEntryId: null,
    title: "",
    maxAmount: 0,
    amount: "",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["debt-detail", String(partyId)],
    queryFn: async () => {
      const res = await fetch(`/api/debts/${partyId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: Boolean(partyId),
  });

  const offsetMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/debt/offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (createdTx) => {
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setSelectedRecIds([]);
      setSelectedPayIds([]);
      setOffsetAmount("");
      setOffsetNotes("");
      enqueueToast("Merged receivable & payable balances", {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
    },
    onError: (err) => {
      enqueueToast(`Offset failed: ${err.message}`, { severity: "error" });
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
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setWriteOffModal({
        open: false,
        debtEntryId: null,
        title: "",
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

  const deleteTxMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      enqueueToast(`Reversed "${deleted.title}"`, { severity: "info" });
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const party = data?.party;
  const openReceivables = useMemo(() => data?.openReceivables || [], [data?.openReceivables]);
  const openPayables = useMemo(() => data?.openPayables || [], [data?.openPayables]);
  const transactions = data?.transactions || [];

  const effectiveRecPool = useMemo(() => {
    const items =
      selectedRecIds.length > 0
        ? openReceivables.filter((r) => selectedRecIds.includes(r.id))
        : openReceivables;
    return items.reduce((sum, item) => sum + Number(item.remainingOpenAmount || 0), 0);
  }, [openReceivables, selectedRecIds]);

  const effectivePayPool = useMemo(() => {
    const items =
      selectedPayIds.length > 0
        ? openPayables.filter((p) => selectedPayIds.includes(p.id))
        : openPayables;
    return items.reduce((sum, item) => sum + Number(item.remainingOpenAmount || 0), 0);
  }, [openPayables, selectedPayIds]);

  const maxOffsetPossible = Math.min(effectiveRecPool, effectivePayPool);

  const toggleId = (setter, id) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return {
    party,
    isLoading,
    error,
    openReceivables,
    openPayables,
    transactions,
    selectedRecIds,
    setSelectedRecIds,
    selectedPayIds,
    setSelectedPayIds,
    offsetAmount,
    setOffsetAmount,
    offsetNotes,
    setOffsetNotes,
    infoAnchor,
    setInfoAnchor,
    writeOffModal,
    setWriteOffModal,
    offsetMutation,
    writeOffMutation,
    deleteTxMutation,
    effectiveRecPool,
    effectivePayPool,
    maxOffsetPossible,
    toggleId,
    openTransactionDialog,
    openConfirmDialog,
  };
}
