"use client";

import React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Stack,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatShortAxis, formatMoneyDisplay } from "@/lib/money";
import MoneyValue from "@/components/MoneyValue";
import {
  useChartLabelVisibility,
  ChartCardHeaderMenu,
  ChartDotLabelMark,
} from "@/components/ChartCardHeaderMenu";

export default function AutoChartDrawer() {
  const { chartDrawer, closeChartDrawer, isPrivacyHidden } = useLedgerStore();
  const { open, type, id, title, subtitle } = chartDrawer;

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", type, id],
    queryFn: async () => {
      if (!type || !id) return null;
      const res = await fetch(`/api/analytics?type=${type}&id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: open && Boolean(type) && Boolean(id),
  });

  const moneyValueFormatter = (val) =>
    formatMoneyDisplay(val, { compact: false, hidden: isPrivacyHidden });

  const cardPtsCount = data?.timeSeries?.length || 0;
  const hourlyPtsCount = data?.hourlyData?.length || 0;
  const vaultPtsCount = data?.balanceTimeline?.length || 0;

  const { showLabels: showCardSpendLabels } = useChartLabelVisibility(`drawer-${type}-${id}-spend`, cardPtsCount);
  const { showLabels: showCardHourlyLabels } = useChartLabelVisibility(`drawer-${type}-${id}-hourly`, hourlyPtsCount);
  const { showLabels: showVaultLabels } = useChartLabelVisibility(`drawer-${type}-${id}-vault`, vaultPtsCount);
  const { showLabels: showLayerLabels } = useChartLabelVisibility(`drawer-${type}-${id}-layer`, cardPtsCount);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={closeChartDrawer}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "85vh",
          p: { xs: 2, sm: 3 },
          maxWidth: 900,
          mx: "auto",
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title || "Analytics Overview"}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={closeChartDrawer} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error" variant="body2" sx={{ py: 4, textAlign: "center" }}>
          Failed to load chart: {error.message}
        </Typography>
      ) : !data ? null : (
        <Box sx={{ pb: 3 }}>
          {/* 1. Action Card History */}
          {type === "CARD" && (
            <Stack spacing={3}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Spending History (Total Uses: {data.totalUses || 0})
                  </Typography>
                  <ChartCardHeaderMenu chartKey={`drawer-${type}-${id}-spend`} pointCount={cardPtsCount} />
                </Box>
                {data.timeSeries && data.timeSeries.length > 0 ? (
                  <Box sx={{ width: "100%", minWidth: 0, height: 260 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.timeSeries.map((t) => t.date) }]}
                      yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                      margin={{ top: 24, bottom: 24 }}
                      series={[
                        {
                          data: data.timeSeries.map((t) => t.amount),
                          color: "#2563EB",
                          barLabelPlacement: "outside",
                          barLabel: (item) =>
                            showCardSpendLabels && !isPrivacyHidden && item.value
                              ? formatShortAxis(item.value, false)
                              : null,
                          valueFormatter: moneyValueFormatter,
                        },
                      ]}
                      height={250}
                    />
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No transactions recorded for this card yet.
                  </Typography>
                )}
              </Box>

              {data.hourlyData && data.hourlyData.length > 0 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Time-of-Day Routine Heatmap (24 Hours)
                    </Typography>
                    <ChartCardHeaderMenu chartKey={`drawer-${type}-${id}-hourly`} pointCount={hourlyPtsCount} />
                  </Box>
                  <Box sx={{ width: "100%", minWidth: 0, height: 200 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.hourlyData.map((h) => h.hour) }]}
                      margin={{ top: 20, bottom: 22 }}
                      series={[
                        {
                          data: data.hourlyData.map((h) => h.count),
                          color: "#F59E0B",
                          barLabelPlacement: "outside",
                          barLabel: (item) =>
                            showCardHourlyLabels && !isPrivacyHidden && item.value > 0
                              ? String(item.value)
                              : null,
                        },
                      ]}
                      height={190}
                    />
                  </Box>
                </Box>
              )}
            </Stack>
          )}

          {/* 2. Vault Balance History */}
          {type === "VAULT" && (
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Running Balance Timeline (Current:{" "}
                  <MoneyValue
                    value={data.totalEstimatedBase ?? data.currentBalance}
                    currency={data.baseCurrency || "IDR"}
                    includeCents
                    allowTapToggle
                  />
                  )
                </Typography>
                <ChartCardHeaderMenu chartKey={`drawer-${type}-${id}-vault`} pointCount={vaultPtsCount} />
              </Box>
              {data.balanceTimeline && data.balanceTimeline.length > 0 ? (
                <Box sx={{ width: "100%", minWidth: 0, height: 280 }}>
                  <LineChart
                    xAxis={[{ scaleType: "point", data: data.balanceTimeline.map((b) => b.date) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    margin={{ top: 24, right: 16, bottom: 24 }}
                    slots={{ mark: ChartDotLabelMark }}
                    slotProps={{
                      mark: {
                        showLabels: showVaultLabels,
                        isPrivacyHidden,
                      },
                    }}
                    series={[
                      {
                        id: "vault-bal-line",
                        data: data.balanceTimeline.map((b) => b.runningBalance),
                        color: "#10B981",
                        shape: "circle",
                        showMark: showVaultLabels,
                        valueFormatter: moneyValueFormatter,
                      },
                    ]}
                    height={270}
                  />
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No balance history recorded yet.
                </Typography>
              )}
            </Box>
          )}

          {/* 3. Layer Breakdown */}
          {type === "LAYER" && (
            <Stack spacing={3}>
              {data.pieData && data.pieData.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Sub-Category Distribution
                  </Typography>
                  <Box sx={{ width: "100%", minWidth: 0, height: 240, display: "flex", justifyContent: "center" }}>
                    <PieChart
                      series={[
                        {
                          data: data.pieData,
                          innerRadius: 30,
                          paddingAngle: 2,
                          cornerRadius: 4,
                          valueFormatter: (item) => moneyValueFormatter(item.value),
                        },
                      ]}
                      width={260}
                      height={220}
                    />
                  </Box>
                </Box>
              )}

              {data.timeSeries && data.timeSeries.length > 0 && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Expenditure Timeline
                    </Typography>
                    <ChartCardHeaderMenu chartKey={`drawer-${type}-${id}-layer`} pointCount={cardPtsCount} />
                  </Box>
                  <Box sx={{ width: "100%", minWidth: 0, height: 240 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.timeSeries.map((t) => t.date) }]}
                      yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                      margin={{ top: 24, bottom: 24 }}
                      series={[
                        {
                          data: data.timeSeries.map((t) => t.amount),
                          color: "#F97316",
                          barLabelPlacement: "outside",
                          barLabel: (item) =>
                            showLayerLabels && !isPrivacyHidden && item.value
                              ? formatShortAxis(item.value, false)
                              : null,
                          valueFormatter: moneyValueFormatter,
                        },
                      ]}
                      height={230}
                    />
                  </Box>
                </Box>
              )}
            </Stack>
          )}

          {/* 4. Party Debt / Receivable History */}
          {type === "PARTY" && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Net Balance: <MoneyValue value={data.netReceivableBalance} allowTapToggle />
              </Typography>
              {data.debtHistory && data.debtHistory.length > 0 ? (
                <Stack spacing={1}>
                  {data.debtHistory.map((item, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.date} • {item.direction} ({item.status})
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 800, color: item.direction === "INCREASE" ? "#2563EB" : "#10B981" }}
                      >
                        <MoneyValue value={item.amount} allowTapToggle />
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No debt or loan history recorded with this person yet.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}
