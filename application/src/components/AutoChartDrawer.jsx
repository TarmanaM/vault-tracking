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
import { formatRupiah } from "@/lib/money";

export default function AutoChartDrawer() {
  const { chartDrawer, closeChartDrawer } = useLedgerStore();
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
          {/* 1. Action Card Analytics */}
          {type === "CARD" && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Spending History (Total Uses: {data.totalUses || 0})
                </Typography>
                {data.timeSeries && data.timeSeries.length > 0 ? (
                  <Box sx={{ width: "100%", height: 260 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.timeSeries.map((t) => t.date) }]}
                      series={[{ data: data.timeSeries.map((t) => t.amount), color: "#2563EB" }]}
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Time-of-Day Routine Heatmap (24 Hours)
                  </Typography>
                  <Box sx={{ width: "100%", height: 200 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.hourlyData.map((h) => h.hour) }]}
                      series={[{ data: data.hourlyData.map((h) => h.count), color: "#F59E0B" }]}
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
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Running Balance Timeline (Current: {formatRupiah(data.currentBalance)})
              </Typography>
              {data.balanceTimeline && data.balanceTimeline.length > 0 ? (
                <Box sx={{ width: "100%", height: 280 }}>
                  <LineChart
                    xAxis={[{ scaleType: "point", data: data.balanceTimeline.map((b) => b.date) }]}
                    series={[{ data: data.balanceTimeline.map((b) => b.runningBalance), color: "#10B981" }]}
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
                  <Box sx={{ width: "100%", height: 240, display: "flex", justifyContent: "center" }}>
                    <PieChart
                      series={[
                        {
                          data: data.pieData,
                          innerRadius: 30,
                          paddingAngle: 2,
                          cornerRadius: 4,
                        },
                      ]}
                      height={220}
                    />
                  </Box>
                </Box>
              )}

              {data.timeSeries && data.timeSeries.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Expenditure Timeline
                  </Typography>
                  <Box sx={{ width: "100%", height: 240 }}>
                    <BarChart
                      xAxis={[{ scaleType: "band", data: data.timeSeries.map((t) => t.date) }]}
                      series={[{ data: data.timeSeries.map((t) => t.amount), color: "#F97316" }]}
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
                Net Balance: {formatRupiah(data.netReceivableBalance)}
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
                        {formatRupiah(item.amount)}
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

