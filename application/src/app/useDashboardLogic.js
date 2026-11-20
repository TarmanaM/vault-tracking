import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useDashboardLogic() {
  const openTransactionDialog = useLedgerStore((s) => s.openTransactionDialog);

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const reminders = data?.pendingReminders || [];
  const baseCurrency = data?.appSettings?.baseCurrency || authData?.baseCurrency || "IDR";
  const user = authData?.user || null;

  return {
    data,
    user,
    isLoading,
    error,
    reminders,
    baseCurrency,
    openTransactionDialog,
  };
}
