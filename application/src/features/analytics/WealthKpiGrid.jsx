"use client";

import React from "react";
import { Grid, Card, CardContent, Typography, Chip, Stack } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import MoneyValue from "@/components/common/MoneyValue";

export default function WealthKpiGrid({ analytics, wealthComparison }) {
  const isUp = wealthComparison?.direction === "UP";
  const isDown = wealthComparison?.direction === "DOWN";

  return (
    <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
      <Grid size={{ xs: 6, md: 3 }}>
        <Card sx={{ bgcolor: "#0F172A", color: "#FFFFFF", height: "100%" }}>
          <CardContent sx={{ p: { xs: 1.25, sm: 2 } }}>
            <Typography
              variant="caption"
              sx={{ color: "#94A3B8", fontWeight: 700, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
            >
              NET TOTAL WEALTH
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, my: 0.35, fontSize: { xs: "1.02rem", sm: "1.35rem" } }}
            >
              <MoneyValue value={analytics.netTotalWealth} includeCents allowTapToggle />
            </Typography>
            {wealthComparison?.comparisonLabel && (
              <Chip
                size="small"
                icon={
                  isUp ? (
                    <TrendingUpIcon sx={{ fontSize: "0.85rem !important", color: "#10B981 !important" }} />
                  ) : isDown ? (
                    <TrendingDownIcon sx={{ fontSize: "0.85rem !important", color: "#F87171 !important" }} />
                  ) : undefined
                }
                label={
                  <Stack direction="row" spacing={0.35} alignItems="center" flexWrap="wrap">
                    <span>
                      {isUp ? "+" : ""}
                      {wealthComparison.deltaPercent}% (<MoneyValue value={wealthComparison.deltaAmount} />)
                    </span>
                    <span>{wealthComparison.comparisonLabel}</span>
                  </Stack>
                }
                sx={{
                  mt: 0.25,
                  height: "auto",
                  "& .MuiChip-label": { whiteSpace: "normal", py: 0.25, px: 0.75 },
                  fontSize: { xs: "0.6rem", sm: "0.68rem" },
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

      <Grid size={{ xs: 6, md: 3 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: { xs: 1.25, sm: 2 } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
            >
              LIQUID &amp; HELD
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "#10B981", mt: 0.35, fontSize: { xs: "1.02rem", sm: "1.25rem" } }}
            >
              <MoneyValue value={analytics.totalLiquid} includeCents allowTapToggle />
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: "0.64rem", sm: "0.75rem" } }}
            >
              Banks, Cash, Coin, Wallets
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 6, md: 3 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: { xs: 1.25, sm: 2 } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
            >
              OPEN RECEIVABLES
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "#2563EB", mt: 0.35, fontSize: { xs: "1.02rem", sm: "1.25rem" } }}
            >
              <MoneyValue value={analytics.totalReceivables} allowTapToggle />
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: "0.64rem", sm: "0.75rem" } }}
            >
              Piutang owed to you
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 6, md: 3 }}>
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: { xs: 1.25, sm: 2 } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
            >
              PAYABLES &amp; PAYLATER
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: "#DC2626", mt: 0.35, fontSize: { xs: "1.02rem", sm: "1.25rem" } }}
            >
              <MoneyValue value={analytics.totalPayables} allowTapToggle />
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: "0.64rem", sm: "0.75rem" } }}
            >
              Liabilities owed
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
