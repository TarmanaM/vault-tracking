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
  Divider,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatShortAxis, formatMoneyDisplay } from "@/lib/money";
import MoneyValue from "@/components/MoneyValue";
import LayerConsumptionOverview from "@/components/LayerConsumptionOverview";

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

  // Also read dashboard summary so monthly layer overview works smoothly on Journey page
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

  const isUp = wealthComparison.direction === "UP";
  const isDown = wealthComparison.direction === "DOWN";

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 } }}>
      {/* Header & Date Filter Bar (#xx) */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { md: "center" }, flexDirection: { xs: "column", md: "row" }, gap: 1.5, mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShowChartIcon color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
              Wealth Journey &amp; Analytics
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Showing {dateRangeApplied.preset || preset} window
            {dateRangeApplied.startDate ? ` (${dateRangeApplied.startDate} to ${dateRangeApplied.endDate})` : " (All Time)"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
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

      {/* Custom Date Inputs when CUSTOM selected */}
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

      {/* Top KPI Cards with MoM Delta & % Badge (#24) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "#0F172A", color: "#FFFFFF", height: "100%" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700 }}>
                NET TOTAL WEALTH
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, my: 0.5 }}>
                <MoneyValue value={analytics.netTotalWealth} includeCents allowTapToggle />
              </Typography>
              {wealthComparison.comparisonLabel && (
                <Chip
                  size="small"
                  icon={
                    isUp ? (
                      <TrendingUpIcon sx={{ fontSize: "0.9rem !important", color: "#10B981 !important" }} />
                    ) : isDown ? (
                      <TrendingDownIcon sx={{ fontSize: "0.9rem !important", color: "#F87171 !important" }} />
                    ) : undefined
                  }
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>
                        {isUp ? "+" : ""}
                        {wealthComparison.deltaPercent}% (
                        <MoneyValue value={wealthComparison.deltaAmount} />)
                      </span>
                      <span>{wealthComparison.comparisonLabel}</span>
                    </Stack>
                  }
                  sx={{
                    mt: 0.5,
                    height: 22,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    bgcolor: isUp
                      ? "rgba(16, 185, 129, 0.16)"
                      : isDown
                      ? "rgba(239, 68, 68, 0.18)"
                      : "rgba(148, 163, 184, 0.16)",
                    color: isUp ? "#34D399" : isDown ? "#FCA5A5" : "#CBD5E1",
                  }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                LIQUID &amp; HELD VAULTS
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#10B981", mt: 0.5 }}>
                <MoneyValue value={analytics.totalLiquid} includeCents allowTapToggle />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Banks, Cash, Coin, E-Wallets
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                OPEN RECEIVABLES
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#2563EB", mt: 0.5 }}>
                <MoneyValue value={analytics.totalReceivables} allowTapToggle />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Piutang / Money owed to you
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                PAYABLES &amp; PAYLATER
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#DC2626", mt: 0.5 }}>
                <MoneyValue value={analytics.totalPayables} allowTapToggle />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Liabilities owed to others
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Analytics Charts Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* 1. Wealth Trajectory Timeline (#5) */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Wealth Trajectory Timeline
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) =>
                    openInfo(
                      e,
                      "Wealth Trajectory Timeline",
                      "Chronological curve of total Net Wealth (Liquid Vaults + Receivables - Payables) across the selected date range."
                    )
                  }
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: 290 }}>
                {wealthTimeline.length > 0 ? (
                  <LineChart
                    xAxis={[{ scaleType: "point", data: wealthTimeline.map((p) => p.date.slice(5)) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    series={[
                      {
                        label: "Net Wealth",
                        data: wealthTimeline.map((p) => p.wealth),
                        color: "#2563EB",
                        area: false,
                        showMark: wealthTimeline.length <= 35,
                        valueFormatter: moneyTooltipFormatter,
                      },
                    ]}
                    height={280}
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No wealth points in selected range.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Cashflow Waterfall Chart (#4, 4.png) */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Cashflow Waterfall (Daily Net)
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label="Uang Masuk" sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 700 }} />
                    <Chip size="small" label="Uang Keluar" sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }} />
                  </Stack>
                </Stack>
                <IconButton
                  size="small"
                  onClick={(e) =>
                    openInfo(
                      e,
                      "Cashflow Waterfall Chart",
                      "Plots daily net cashflow delta (Debit - Kredit) cumulatively, rising green on inflow days and stepping red on outflow days. Excludes Initial Funds and internal Vault Transfers."
                    )
                  }
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: 290 }}>
                {waterfallData.length > 0 ? (
                  <BarChart
                    xAxis={[{ scaleType: "band", data: waterfallData.map((d) => d.date.slice(5)) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    slotProps={{ legend: { hidden: true } }}
                    series={[
                      {
                        data: waterfallData.map((d) => d.posBase),
                        stack: "wf",
                        color: "transparent",
                        valueFormatter: () => null,
                      },
                      {
                        data: waterfallData.map((d) => d.negBase),
                        stack: "wf",
                        color: "transparent",
                        valueFormatter: () => null,
                      },
                      {
                        data: waterfallData.map((d) => d.inflowPos),
                        stack: "wf",
                        label: "Inflow (+)",
                        color: "#16A34A",
                        valueFormatter: (v, ctx) => {
                          if (!v) return null;
                          const row = waterfallData[ctx.dataIndex];
                          if (isPrivacyHidden) return "Rp ••••••";
                          return `+${formatMoneyDisplay(row.delta, { compact: false })} (Run: ${formatMoneyDisplay(row.runningSubtotal, { compact: false })})`;
                        },
                      },
                      {
                        data: waterfallData.map((d) => d.inflowNeg),
                        stack: "wf",
                        label: "Inflow (Below Zero)",
                        color: "#16A34A",
                        valueFormatter: (v, ctx) => {
                          if (!v) return null;
                          const row = waterfallData[ctx.dataIndex];
                          if (isPrivacyHidden) return "Rp ••••••";
                          return `+${formatMoneyDisplay(row.delta, { compact: false })} (Run: ${formatMoneyDisplay(row.runningSubtotal, { compact: false })})`;
                        },
                      },
                      {
                        data: waterfallData.map((d) => d.outflowPos),
                        stack: "wf",
                        label: "Outflow (-)",
                        color: "#DC2626",
                        valueFormatter: (v, ctx) => {
                          if (!v) return null;
                          const row = waterfallData[ctx.dataIndex];
                          if (isPrivacyHidden) return "Rp ••••••";
                          return `${formatMoneyDisplay(row.delta, { compact: false })} (Run: ${formatMoneyDisplay(row.runningSubtotal, { compact: false })})`;
                        },
                      },
                      {
                        data: waterfallData.map((d) => d.outflowNeg),
                        stack: "wf",
                        label: "Outflow (Below Zero)",
                        color: "#DC2626",
                        valueFormatter: (v, ctx) => {
                          if (!v) return null;
                          const row = waterfallData[ctx.dataIndex];
                          if (isPrivacyHidden) return "Rp ••••••";
                          return `${formatMoneyDisplay(row.delta, { compact: false })} (Run: ${formatMoneyDisplay(row.runningSubtotal, { compact: false })})`;
                        },
                      },
                    ]}
                    height={280}
                  />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <Typography variant="caption" color="text.secondary">
                      No cashflow movement in selected date range.
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Daily Consumption Line Chart (#1, 1..png) */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Daily Consumption &amp; Trendline
                </Typography>
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
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: 290 }}>
                {dailyConsumption.length > 0 ? (
                  <LineChart
                    xAxis={[{ scaleType: "point", data: dailyConsumption.map((d) => d.date.slice(5)) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    series={[
                      {
                        id: "daily-consume",
                        label: "Consume",
                        data: dailyConsumption.map((d) => d.consume),
                        color: "#EF4444",
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
                    height={280}
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

        {/* 4. Monthly Consumption Bar Chart (#2, 2.png) */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Monthly Consumption
                </Typography>
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
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: 290 }}>
                {monthlyConsumption.length > 0 ? (
                  <BarChart
                    xAxis={[{ scaleType: "band", data: monthlyConsumption.map((m) => m.month) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    series={[
                      {
                        label: "Monthly Consume",
                        data: monthlyConsumption.map((m) => m.consume),
                        color: "#DC2626",
                        valueFormatter: moneyTooltipFormatter,
                      },
                    ]}
                    height={280}
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

        {/* 5. Top Consumptive Transactions (#3, 3.png) */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <ReceiptLongOutlinedIcon color="error" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Top Consumptive Expenses
                </Typography>
              </Stack>

              {topConsumptiveTransactions.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No consumptive transactions in range.
                </Typography>
              ) : (
                <Stack spacing={1} divider={<Divider />}>
                  {topConsumptiveTransactions.slice(0, 10).map((tx) => (
                    <Box key={tx.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {tx.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tx.date} • {tx.categoryName} • {tx.vaultName}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "#DC2626", flexShrink: 0 }}>
                        <MoneyValue value={tx.amount} allowTapToggle />
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 6. Vault Usage Frequency (#6) + Wealth Pie Chart */}
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5} sx={{ height: "100%" }}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AccountBalanceWalletIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Vault Usage Frequency
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={(e) =>
                      openInfo(
                        e,
                        "Vault Usage Frequency",
                        "Counts how many transactions used each vault in the selected range (excluding baseline INITIAL_FUND entries)."
                      )
                    }
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>

                {vaultFrequency.length > 0 ? (
                  <>
                    <Box sx={{ width: "100%", minWidth: 0, height: 190 }}>
                      <BarChart
                        xAxis={[{ scaleType: "band", data: vaultFrequency.map((v) => v.name) }]}
                        series={[
                          {
                            label: "Uses",
                            data: vaultFrequency.map((v) => v.count),
                            color: "#2563EB",
                          },
                        ]}
                        height={180}
                      />
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {vaultFrequency.map((vf) => (
                        <Chip
                          key={vf.vaultId}
                          size="small"
                          label={`${vf.name}: ${vf.count}x (${vf.percent}%)`}
                          variant="outlined"
                          sx={{ fontSize: "0.7rem", fontWeight: 600 }}
                        />
                      ))}
                    </Stack>
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No vault transactions recorded yet.
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  Current Wealth Distribution
                </Typography>
                {wealthDistributionPie.length > 0 ? (
                  <Box sx={{ width: "100%", minWidth: 0, display: "flex", justifyContent: "center" }}>
                    <PieChart
                      series={[
                        {
                          data: wealthDistributionPie,
                          innerRadius: 36,
                          paddingAngle: 2,
                          cornerRadius: 4,
                          valueFormatter: (item) => moneyTooltipFormatter(item.value),
                        },
                      ]}
                      width={300}
                      height={220}
                    />
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No positive vault assets yet.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Current Month 3-Tier Consumption Layer Summary */}
      <LayerConsumptionOverview currentMonth={dashboardData?.summary?.currentMonth} />

      {/* Shared Info Popover */}
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
