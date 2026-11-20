import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useCheckpointsLogic() {
  const { openReconcileDialog, openVaultProfileDialog, openSubVaultSyncDialog } = useLedgerStore();
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checkpoints"],
    queryFn: async () => {
      const res = await fetch("/api/reconcile");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const vaults = data?.vaults || [];
  const checkpoints = data?.checkpoints || [];
  const baseCurrency = data?.baseCurrency || "IDR";

  return {
    data,
    isLoading,
    error,
    vaults,
    checkpoints,
    baseCurrency,
    infoAnchor,
    setInfoAnchor,
    showAuditHistory,
    setShowAuditHistory,
    openReconcileDialog,
    openVaultProfileDialog,
    openSubVaultSyncDialog,
  };
}
