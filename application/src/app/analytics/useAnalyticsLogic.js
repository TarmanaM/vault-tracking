import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatNativeMoney } from "@/shared/currencyHelpers";
import { useChartLabelVisibility } from "@/components/charts/ChartCardHeaderMenu";

export const PRESET_RANGES = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "ALL", label: "ALL" },
  { value: "CUSTOM", label: "Custom" },
];

export function useAnalyticsLogic() {
  const isPrivacyHidden = useLedgerStore((s) => s.isPrivacyHidden);
  const storeBaseCurrency = useLedgerStore((s) => s.baseCurrency);
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);
  const analyticsGlobalLabelsMode = useLedgerStore(
    (s) => s.analyticsGlobalLabelsMode,
  );
  const setAnalyticsGlobalLabelsMode = useLedgerStore(
    (s) => s.setAnalyticsGlobalLabelsMode,
  );

  const [preset, setPreset] = useState("3M");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [infoState, setInfoState] = useState({
    anchorEl: null,
    title: "",
    text: "",
  });

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["analytics", "WEALTH_JOURNEY", preset, customStart, customEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "WEALTH_JOURNEY", preset });
      if (preset === "CUSTOM") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      }
      const res = await fetch(`/api/analytics?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  const baseCurrency =
    dashboardData?.appSettings?.baseCurrency || storeBaseCurrency || "IDR";

  const moneyTooltipFormatter = (val) =>
    formatNativeMoney(val, baseCurrency, { compact: false, hidden: isPrivacyHidden });

  const openInfo = (e, title, text) => {
    setInfoState({ anchorEl: e.currentTarget, title, text });
  };

  const closeInfo = () => {
    setInfoState({ anchorEl: null, title: "", text: "" });
  };

  const waterfallPtsCount = analytics?.waterfallData?.length || 0;
  const dailyPtsCount = analytics?.dailyConsumption?.length || 0;
  const monthlyPtsCount = analytics?.monthlyConsumption?.length || 0;
  const wealthPtsCount = analytics?.wealthTimeline?.length || 0;

  const { showLabels: showWaterfallLabels } = useChartLabelVisibility(
    "waterfall",
    waterfallPtsCount,
  );
  const { showLabels: showDailyLabels } = useChartLabelVisibility(
    "daily-consume",
    dailyPtsCount,
  );
  const { showLabels: showMonthlyLabels } = useChartLabelVisibility(
    "monthly-consume",
    monthlyPtsCount,
  );
  const { showLabels: showWealthLabels } = useChartLabelVisibility(
    "wealth-timeline",
    wealthPtsCount,
  );

  const cycleGlobalLabelsMode = () => {
    const next =
      analyticsGlobalLabelsMode === "AUTO"
        ? "SHOW"
        : analyticsGlobalLabelsMode === "SHOW"
          ? "HIDE"
          : "AUTO";
    setAnalyticsGlobalLabelsMode(next);
  };

  return {
    analytics,
    dashboardData,
    baseCurrency,
    isLoading,
    error,
    isPrivacyHidden,
    openChartDrawer,
    analyticsGlobalLabelsMode,
    preset,
    setPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    infoState,
    openInfo,
    closeInfo,
    moneyTooltipFormatter,
    showWaterfallLabels,
    showDailyLabels,
    showMonthlyLabels,
    showWealthLabels,
    cycleGlobalLabelsMode,
  };
}
