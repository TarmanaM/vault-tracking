"use client";

import React from "react";
import { Card, CardContent, Box, Stack, Typography, Chip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { BarChart } from "@mui/x-charts/BarChart";
import { formatShortAxis, formatMoneyDisplay } from "@/shared/money";
import { ChartCardHeaderMenu } from "@/components/ChartCardHeaderMenu";

export default function CashflowWaterfallCard({
  waterfallData,
  showWaterfallLabels,
  isPrivacyHidden,
  openInfo,
}) {
  return (
    <Card sx={{ mb: { xs: 2, sm: 2.5 } }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Cashflow Waterfall (Daily Net)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label="Uang Masuk"
                sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 700 }}
              />
              <Chip
                size="small"
                label="Uang Keluar"
                sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }}
              />
            </Stack>
          </Stack>
          <Stack direction="row" spacing={0.25} alignItems="center">
            <ChartCardHeaderMenu chartKey="waterfall" pointCount={waterfallData.length} />
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
          </Stack>
        </Box>
        <Box sx={{ width: "100%", minWidth: 0, height: { xs: 240, sm: 290 } }}>
          {waterfallData.length > 0 ? (
            <BarChart
              xAxis={[{ scaleType: "band", data: waterfallData.map((d) => d.date.slice(5)) }]}
              yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
              margin={{ top: 24, bottom: 28 }}
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
                  barLabelPlacement: "outside",
                  barLabel: (item) => {
                    if (!showWaterfallLabels || isPrivacyHidden || !item.value) return null;
                    const row = waterfallData[item.dataIndex];
                    return row ? `+${formatShortAxis(Math.abs(row.delta), false)}` : null;
                  },
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
                  barLabelPlacement: "outside",
                  barLabel: (item) => {
                    if (!showWaterfallLabels || isPrivacyHidden || !item.value) return null;
                    const row = waterfallData[item.dataIndex];
                    return row ? `+${formatShortAxis(Math.abs(row.delta), false)}` : null;
                  },
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
                  barLabelPlacement: "outside",
                  barLabel: (item) => {
                    if (!showWaterfallLabels || isPrivacyHidden || !item.value) return null;
                    const row = waterfallData[item.dataIndex];
                    return row ? formatShortAxis(row.delta, false) : null;
                  },
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
                  barLabelPlacement: "outside",
                  barLabel: (item) => {
                    if (!showWaterfallLabels || isPrivacyHidden || !item.value) return null;
                    const row = waterfallData[item.dataIndex];
                    return row ? formatShortAxis(row.delta, false) : null;
                  },
                  valueFormatter: (v, ctx) => {
                    if (!v) return null;
                    const row = waterfallData[ctx.dataIndex];
                    if (isPrivacyHidden) return "Rp ••••••";
                    return `${formatMoneyDisplay(row.delta, { compact: false })} (Run: ${formatMoneyDisplay(row.runningSubtotal, { compact: false })})`;
                  },
                },
              ]}
              height={230}
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
  );
}
