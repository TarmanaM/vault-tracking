"use client";

import React from "react";
import {
  Grid,
  Card,
  CardContent,
  Box,
  Stack,
  Typography,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { formatShortAxis } from "@/shared/money";
import MoneyValue from "@/components/MoneyValue";
import {
  ChartCardHeaderMenu,
  ChartDotLabelMark,
} from "@/components/ChartCardHeaderMenu";

export default function WealthDistributionAndTimelineSection({
  wealthDistributionPie,
  vaultFrequency,
  wealthTimeline,
  topConsumptiveTransactions,
  showWealthLabels,
  isPrivacyHidden,
  moneyTooltipFormatter,
  openChartDrawer,
  openInfo,
}) {
  return (
    <>
      <Grid container spacing={{ xs: 1.5, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                Current Wealth Distribution
              </Typography>
              {wealthDistributionPie.length > 0 ? (
                <Box sx={{ width: "100%", minWidth: 0, height: 295 }}>
                  <PieChart
                    series={[
                      {
                        data: wealthDistributionPie,
                        innerRadius: 38,
                        paddingAngle: 2,
                        cornerRadius: 4,
                        valueFormatter: (item) => moneyTooltipFormatter(item.value),
                      },
                    ]}
                    slotProps={{
                      legend: {
                        direction: "horizontal",
                        position: { vertical: "bottom", horizontal: "center" },
                      },
                    }}
                    height={285}
                  />
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No positive vault assets yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccountBalanceWalletIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Vault Breakdown &amp; Usage Frequency
                  </Typography>
                </Stack>
                <IconButton
                  size="small"
                  onClick={(e) =>
                    openInfo(
                      e,
                      "Vault Balance & Usage Summary",
                      "Lists all active vaults sorted from highest current balance along with how many non-initial transactions used each vault in the selected date window. Tap any vault row to inspect its chart."
                    )
                  }
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#F1F5F9" }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: "0.74rem", py: 0.85, px: 1 }}>
                        Vault
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", py: 0.85, px: 1 }}>
                        Current Balance
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", py: 0.85, px: 1 }}>
                        Uses
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vaultFrequency.map((vf) => (
                      <TableRow
                        key={vf.vaultId}
                        hover
                        onClick={() => openChartDrawer("VAULT", vf.vaultId, vf.name, vf.vaultType)}
                        sx={{
                          cursor: "pointer",
                          "&:nth-of-type(even)": { bgcolor: "#F8FAFC" },
                        }}
                      >
                        <TableCell sx={{ py: 0.85, px: 1 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: vf.color || "#2563EB",
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: "0.76rem", sm: "0.84rem" } }}>
                              {vf.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.85, px: 1, fontWeight: 700, fontSize: { xs: "0.76rem", sm: "0.84rem" } }}>
                          <MoneyValue value={vf.currentBalance} includeCents allowTapToggle />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.85, px: 1, fontWeight: 800, color: "#1E293B", fontSize: { xs: "0.76rem", sm: "0.84rem" } }}>
                          {vf.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Wealth Trajectory Timeline
                </Typography>
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <ChartCardHeaderMenu chartKey="wealth-timeline" pointCount={wealthTimeline.length} />
                  <IconButton
                    size="small"
                    onClick={(e) =>
                      openInfo(
                        e,
                        "Wealth Trajectory Timeline",
                        "Chronological curve of Net Wealth. 'Book / Locked Basis' reflects transaction-time FX rates; 'Mark-to-Market (Live FX)' reflects daily FX rate movements even on days without transactions."
                      )
                    }
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0, height: { xs: 240, sm: 285 } }}>
                {wealthTimeline.length > 0 ? (
                  <LineChart
                    xAxis={[{ scaleType: "point", data: wealthTimeline.map((p) => p.date.slice(5)) }]}
                    yAxis={[{ valueFormatter: (v) => formatShortAxis(v, isPrivacyHidden) }]}
                    margin={{ top: 24, right: 16, bottom: 24 }}
                    slots={{ mark: ChartDotLabelMark }}
                    slotProps={{
                      mark: {
                        showLabels: showWealthLabels,
                        isPrivacyHidden,
                      },
                    }}
                    series={[
                      {
                        id: "book-wealth",
                        label: "Book / Locked Basis",
                        data: wealthTimeline.map((p) => p.wealth),
                        color: "#2563EB",
                        area: false,
                        shape: "circle",
                        showMark: showWealthLabels,
                        valueFormatter: moneyTooltipFormatter,
                      },
                      ...(wealthTimeline.some(
                        (p) =>
                          p.marketWealth !== undefined &&
                          Math.abs(p.marketWealth - p.wealth) > 0.01
                      )
                        ? [
                            {
                              id: "market-wealth",
                              label: "Mark-to-Market (Live FX)",
                              data: wealthTimeline.map((p) => p.marketWealth ?? p.wealth),
                              color: "#10B981",
                              area: false,
                              shape: "diamond",
                              showMark: showWealthLabels,
                              valueFormatter: moneyTooltipFormatter,
                            },
                          ]
                        : []),
                    ]}
                    height={235}
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

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
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
      </Grid>
    </>
  );
}
