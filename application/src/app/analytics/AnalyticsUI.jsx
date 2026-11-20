"use client";

import React from "react";
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
import { formatShortAxis } from "@/shared/money";
import { getCurrencySymbol } from "@/shared/currencyHelpers";
import LayerConsumptionOverview from "@/components/dashboard/LayerConsumptionOverview";
import { ChartCardHeaderMenu, ChartDotLabelMark } from "@/components/charts/ChartCardHeaderMenu";
import WealthKpiGrid from "@/features/analytics/WealthKpiGrid";
import CashflowWaterfallCard from "@/features/analytics/CashflowWaterfallCard";
import WealthDistributionAndTimelineSection from "@/features/analytics/WealthDistributionAndTimelineSection";
import { PRESET_RANGES, useAnalyticsLogic } from "./useAnalyticsLogic";

export default function AnalyticsUI() {
  const {
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
  } = useAnalyticsLogic();

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
                        `Plots genuine personal consumption days (skipping zero-consume days) with downward negative spikes below ${getCurrencySymbol(baseCurrency)} 0 and an in-house linear regression trendline.`
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
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden, baseCurrency) }]}
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
                        `Monthly aggregate personal consumption drawn downward from ${getCurrencySymbol(baseCurrency)} 0. Transfers, lending, and debt repayments are strictly excluded (Consume = 0).`
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
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden, baseCurrency) }]}
                    margin={{ top: 18, bottom: 32 }}
                    series={[
                      {
                        label: "Monthly Consume",
                        data: monthlyConsumption.map((m) => m.consume),
                        color: "#DC2626",
                        barLabelPlacement: "outside",
                        barLabel: (item) =>
                          showMonthlyLabels && !isPrivacyHidden && item.value
                            ? formatShortAxis(item.value, false, baseCurrency)
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
        onClose={closeInfo}
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
