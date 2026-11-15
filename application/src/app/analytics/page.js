"use client";

import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  Popover,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatShortAxis, formatMoneyDisplay } from "@/shared/money";
import LayerConsumptionOverview from "@/components/LayerConsumptionOverview";
import {
  useChartLabelVisibility,
  ChartCardHeaderMenu,
  ChartDotLabelMark,
} from "@/components/ChartCardHeaderMenu";
import WealthKpiGrid from "@/features/analytics/WealthKpiGrid";
import CashflowWaterfallCard from "@/features/analytics/CashflowWaterfallCard";
import WealthDistributionAndTimelineSection from "@/features/analytics/WealthDistributionAndTimelineSection";

const PRESET_RANGES = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "ALL", label: "ALL" },
  { value: "CUSTOM", label: "Custom" },
];

export default function AnalyticsPage() {
  const isPrivacyHidden = useLedgerStore((s) => s.isPrivacyHidden);
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);
  const analyticsGlobalLabelsMode = useLedgerStore((s) => s.analyticsGlobalLabelsMode);
  const setAnalyticsGlobalLabelsMode = useLedgerStore((s) => s.setAnalyticsGlobalLabelsMode);

  const [preset, setPreset] = useState("3M");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [infoState, setInfoState] = useState({ anchorEl: null, title: "", text: "" });

  const { data: analytics, isLoading, error } = useQuery({
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

  const moneyTooltipFormatter = (val) =>
    formatMoneyDisplay(val, { compact: false, hidden: isPrivacyHidden });

  const openInfo = (e, title, text) => {
    setInfoState({ anchorEl: e.currentTarget, title, text });
  };

  const waterfallPtsCount = analytics?.waterfallData?.length || 0;
  const dailyPtsCount = analytics?.dailyConsumption?.length || 0;
  const monthlyPtsCount = analytics?.monthlyConsumption?.length || 0;
  const wealthPtsCount = analytics?.wealthTimeline?.length || 0;

  const { showLabels: showWaterfallLabels } = useChartLabelVisibility("waterfall", waterfallPtsCount);
  const { showLabels: showDailyLabels } = useChartLabelVisibility("daily-consume", dailyPtsCount);
  const { showLabels: showMonthlyLabels } = useChartLabelVisibility("monthly-consume", monthlyPtsCount);
  const { showLabels: showWealthLabels } = useChartLabelVisibility("wealth-timeline", wealthPtsCount);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !analytics) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load analytics: {error?.message || "Unknown error"}</Alert>
      </Container>
    );
  }

  const {
    wealthTimeline = [],
    waterfallData = [],
    dailyConsumption = [],
    monthlyConsumption = [],
    topConsumptiveTransactions = [],
    vaultFrequency = [],
    wealthComparison = {},
    wealthDistributionPie = [],
    dateRangeApplied = {},
  } = analytics;

  const cycleGlobalLabelsMode = () => {
    const next =
      analyticsGlobalLabelsMode === "AUTO"
        ? "SHOW"
        : analyticsGlobalLabelsMode === "SHOW"
        ? "HIDE"
        : "AUTO";
    setAnalyticsGlobalLabelsMode(next);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 1.25,
          mb: { xs: 2, sm: 3 },
        }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShowChartIcon color="primary" />
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: "#0F172A", fontSize: { xs: "1.2rem", sm: "1.5rem" } }}
            >
              Wealth Journey &amp; Analytics
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Showing {dateRangeApplied.preset || preset} window
            {dateRangeApplied.startDate
              ? ` (${dateRangeApplied.startDate} to ${dateRangeApplied.endDate})`
              : " (All Time)"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            label={
              analyticsGlobalLabelsMode === "SHOW"
                ? "Labels: All ON"
                : analyticsGlobalLabelsMode === "HIDE"
                ? "Labels: All OFF"
                : "Labels: Auto (≤31)"
            }
            size="small"
            clickable
            onClick={cycleGlobalLabelsMode}
            color={analyticsGlobalLabelsMode === "SHOW" ? "secondary" : "default"}
            variant={analyticsGlobalLabelsMode === "AUTO" ? "outlined" : "filled"}
            sx={{ fontWeight: 700, mr: 0.5 }}
          />
          {PRESET_RANGES.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              clickable
              color={preset === opt.value ? "primary" : "default"}
              variant={preset === opt.value ? "filled" : "outlined"}
              onClick={() => setPreset(opt.value)}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>
      </Box>

      {preset === "CUSTOM" && (
        <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "#FFFFFF" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField
              label="Start Date"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              fullWidth
            />
          </Stack>
        </Card>
      )}

      <WealthKpiGrid analytics={analytics} wealthComparison={wealthComparison} />

      <CashflowWaterfallCard
        waterfallData={waterfallData}
        showWaterfallLabels={showWaterfallLabels}
        isPrivacyHidden={isPrivacyHidden}
        openInfo={openInfo}
      />

      <Grid container spacing={{ xs: 1.5, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Daily Consumption &amp; Trendline
                </Typography>
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <ChartCardHeaderMenu chartKey="daily-consume" pointCount={dailyConsumption.length} />
                  <IconButton
                    size="small"
                    onClick={(e) =>
                      openInfo(
                        e,
                        "Daily Consumption Curve",
                        "Plots genuine personal consumption days (skipping zero-consume days) with downward negative spikes below Rp 0 and an in-house linear regression trendline."
                      )
                    }
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: { xs: 240, sm: 285 } }}>
                {dailyConsumption.length > 0 ? (
                  <LineChart
                    xAxis={[{ scaleType: "point", data: dailyConsumption.map((d) => d.date.slice(5)) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    margin={{ top: 24, right: 16, bottom: 24 }}
                    slots={{ mark: ChartDotLabelMark }}
                    slotProps={{
                      mark: {
                        showLabels: showDailyLabels,
                        isPrivacyHidden,
                        skipSeriesIds: ["consume-trend"],
                      },
                    }}
                    series={[
                      {
                        id: "daily-consume",
                        label: "Consume",
                        data: dailyConsumption.map((d) => d.consume),
                        color: "#EF4444",
                        shape: "circle",
                        showMark: showDailyLabels,
                        valueFormatter: moneyTooltipFormatter,
                      },
                      {
                        id: "consume-trend",
                        label: "Linear Trend",
                        data: dailyConsumption.map((d) => d.trend),
                        color: "#64748B",
                        showMark: false,
                        valueFormatter: moneyTooltipFormatter,
                      },
                    ]}
                    sx={{
                      "& .MuiLineElement-series-consume-trend": {
                        strokeDasharray: "6 4",
                        strokeWidth: 2,
                      },
                    }}
                    height={235}
                  />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <Typography variant="caption" color="text.secondary">
                      No consumptive expenses in selected range.
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Monthly Consumption
                </Typography>
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <ChartCardHeaderMenu chartKey="monthly-consume" pointCount={monthlyConsumption.length} />
                  <IconButton
                    size="small"
                    onClick={(e) =>
                      openInfo(
                        e,
                        "Monthly Consumption Bar",
                        "Monthly aggregate personal consumption drawn downward from Rp 0. Transfers, lending, and debt repayments are strictly excluded (Consume = 0)."
                      )
                    }
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: { xs: 240, sm: 285 } }}>
                {monthlyConsumption.length > 0 ? (
                  <BarChart
                    xAxis={[{ scaleType: "band", data: monthlyConsumption.map((m) => m.month) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    margin={{ top: 18, bottom: 32 }}
                    series={[
                      {
                        label: "Monthly Consume",
                        data: monthlyConsumption.map((m) => m.consume),
                        color: "#DC2626",
                        barLabelPlacement: "outside",
                        barLabel: (item) =>
                          showMonthlyLabels && !isPrivacyHidden && item.value
                            ? formatShortAxis(item.value, false)
                            : null,
                        valueFormatter: moneyTooltipFormatter,
                      },
                    ]}
                    height={235}
                  />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <Typography variant="caption" color="text.secondary">
                      No monthly consumption data yet.
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <LayerConsumptionOverview currentMonth={dashboardData?.summary?.currentMonth} />

      <WealthDistributionAndTimelineSection
        wealthDistributionPie={wealthDistributionPie}
        vaultFrequency={vaultFrequency}
        wealthTimeline={wealthTimeline}
        topConsumptiveTransactions={topConsumptiveTransactions}
        showWealthLabels={showWealthLabels}
        isPrivacyHidden={isPrivacyHidden}
        moneyTooltipFormatter={moneyTooltipFormatter}
        openChartDrawer={openChartDrawer}
        openInfo={openInfo}
      />

      <Popover
        open={Boolean(infoState.anchorEl)}
        anchorEl={infoState.anchorEl}
        onClose={() => setInfoState({ anchorEl: null, title: "", text: "" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Box sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
            {infoState.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {infoState.text}
          </Typography>
        </Box>
      </Popover>
    </Container>
  );
}
