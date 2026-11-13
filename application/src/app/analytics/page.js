"use client";

import React from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PieChartIcon from "@mui/icons-material/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/money";
import LayerConsumptionOverview from "@/components/LayerConsumptionOverview";
import AutoChartDrawer from "@/components/AutoChartDrawer";

export default function AnalyticsPage() {
  const { data: journeyData, isLoading: journeyLoading } = useQuery({
    queryKey: ["analytics", "WEALTH_JOURNEY"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=WEALTH_JOURNEY");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  if (journeyLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const { wealthTimeline = [], wealthDistributionPie = [], netTotalWealth, totalLiquid, totalReceivables } = journeyData || {};

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Top Title & Net Wealth Cards */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
          Wealth Journey &amp; Portfolio Distribution
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time double-entry trajectory tracking your net wealth over time.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: "#1E293B", color: "#FFFFFF" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700 }}>
                CURRENT NET WEALTH
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "#38BDF8" }}>
                {formatRupiah(netTotalWealth, true)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                LIQUID FUNDS (CASH &amp; BANKS)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: "#10B981" }}>
                {formatRupiah(totalLiquid)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={4}>
          <Card>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                THIRD-PARTY RECEIVABLES
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: "#2563EB" }}>
                {formatRupiah(totalReceivables)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 1. STOCK-LIKE WEALTH JOURNEY CHART */}
      <Card sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <TrendingUpIcon sx={{ color: "#2563EB" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Wealth Trajectory Timeline (Stock-Like Chart)
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Cumulative net asset value plotted chronologically from initial anchor to present day.
        </Typography>

        {wealthTimeline.length > 0 ? (
          <Box sx={{ width: "100%", minWidth: 0, height: 320 }}>
            <LineChart
              xAxis={[{ scaleType: "point", data: wealthTimeline.map((w) => w.date) }]}
              series={[
                {
                  data: wealthTimeline.map((w) => w.wealth),
                  color: "#2563EB",
                  area: true,
                  showMark: true,
                },
              ]}
              height={300}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No trajectory data yet. Record your initial fund or first transaction to start plotting!
          </Typography>
        )}
      </Card>

      {/* 2. WEALTH DISTRIBUTION PIE CHART */}
      <Card sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <PieChartIcon sx={{ color: "#059669" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Where Is Your Money Located Right Now? (Vaults &amp; Receivables)
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Breakdown of total aggregate capital across Bank Accounts, Cash Wallets, Coins, and Loans Given.
        </Typography>

        {wealthDistributionPie.length > 0 ? (
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={7} sx={{ minWidth: 0 }}>
              <Box sx={{ width: "100%", minWidth: 0, height: 280, display: "flex", justifyContent: "center" }}>
                <PieChart
                  series={[
                    {
                      data: wealthDistributionPie,
                      innerRadius: 50,
                      paddingAngle: 3,
                      cornerRadius: 5,
                    },
                  ]}
                  width={280}
                  height={260}
                />
              </Box>
            </Grid>

            {/* Legend / Breakdown Table */}
            <Grid item xs={12} md={5}>
              <Stack spacing={1}>
                {wealthDistributionPie.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 1.2,
                      bgcolor: "#F8FAFC",
                      borderRadius: 1.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderLeft: `4px solid ${item.color}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {formatRupiah(item.value)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            All vaults are currently empty.
          </Typography>
        )}
      </Card>

      {/* 3. 3-TIER LAYER CONSUMPTION OVERVIEW */}
      <LayerConsumptionOverview currentMonth={dashData?.summary?.currentMonth} />

      <AutoChartDrawer />
    </Container>
  );
}

