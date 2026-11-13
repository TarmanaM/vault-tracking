"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  LinearProgress,
  Stack,
  IconButton,
  Popover,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockClockOutlinedIcon from "@mui/icons-material/LockClockOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import LocalCafeOutlinedIcon from "@mui/icons-material/LocalCafeOutlined";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { formatRupiah } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function LayerConsumptionOverview({ currentMonth }) {
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);
  const [anchorEl, setAnchorEl] = useState(null);

  if (!currentMonth) return null;

  const totalConsume = Number(currentMonth.totalConsume) || 0;
  const totalIncome = Number(currentMonth.totalIncome) || 0;
  const pacingPercent = totalIncome > 0 ? Math.min(100, Math.round((totalConsume / totalIncome) * 100)) : 0;

  const layers = [
    {
      key: "FIXED_MANDATORY",
      title: "Mandatory (Wajib)",
      amount: currentMonth.mandatoryExpense,
      icon: <LockClockOutlinedIcon sx={{ color: "#2563EB" }} />,
      desc: "Parkir, Bensin, Tagihan Rutin",
      color: "#2563EB",
    },
    {
      key: "VARIABLE_ESSENTIAL",
      title: "Essential (Tidak Tetap)",
      amount: currentMonth.variableEssentialExpense,
      icon: <ShoppingBagOutlinedIcon sx={{ color: "#F97316" }} />,
      desc: "Makan Utama, Servis Motor, Dokumen",
      color: "#F97316",
    },
    {
      key: "DISCRETIONARY_JAJAN",
      title: "Discretionary (Jajan)",
      amount: currentMonth.discretionaryExpense,
      icon: <LocalCafeOutlinedIcon sx={{ color: "#D97706" }} />,
      desc: "Kopi, Kuliner Malam, Warnet, Rokok",
      color: "#D97706",
    },
    {
      key: "SOCIAL_CHARITY",
      title: "Social & Charity (Sedekah)",
      amount: currentMonth.socialCharityExpense,
      icon: <VolunteerActivismOutlinedIcon sx={{ color: "#10B981" }} />,
      desc: "Sedekah, Sumbangan, Piutang Ikhlas",
      color: "#10B981",
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header with (i) Info Button (Rule 11) */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E293B" }}>
            Monthly Consumption by Layer ({currentMonth.monthTag})
          </Typography>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: "#64748B" }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563EB" }}>
          Total: {formatRupiah(totalConsume)}
        </Typography>
      </Box>

      {/* Income vs Consumption Pacing Bar */}
      {totalIncome > 0 && (
        <Card sx={{ p: 2, mb: 2, bgcolor: "#F8FAFC" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
              MONTHLY BUDGET PACING
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: pacingPercent > 80 ? "#DC2626" : "#2563EB" }}>
              {pacingPercent}% of Income ({formatRupiah(totalIncome)})
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pacingPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "#E2E8F0",
              "& .MuiLinearProgress-bar": {
                bgcolor: pacingPercent > 80 ? "#DC2626" : "#2563EB",
                borderRadius: 4,
              },
            }}
          />
        </Card>
      )}

      {/* Layer Cards (Clickable for Instant Charts - Rule 17) */}
      <Grid container spacing={2}>
        {layers.map((layer) => (
          <Grid item xs={12} sm={6} md={3} key={layer.key}>
            <Card sx={{ borderLeft: `4px solid ${layer.color}` }}>
              <CardActionArea
                onClick={() => openChartDrawer("LAYER", layer.key, layer.title)}
                sx={{ p: 2 }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  {layer.icon}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                    {layer.title}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.3 }}>
                  {formatRupiah(layer.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                  {layer.desc}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}

        {/* Cash Shortage Warning Card if detected */}
        {Number(currentMonth.cashShortageLost) > 0 && (
          <Grid item xs={12}>
            <Card sx={{ borderLeft: "4px solid #DC2626", bgcolor: "#FEF2F2" }}>
              <CardActionArea
                onClick={() => openChartDrawer("LAYER", "RECONCILIATION_LOST", "Unaccounted Cash Shortage")}
                sx={{ p: 2 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon sx={{ color: "#DC2626" }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#991B1B" }}>
                      Unaccounted Cash Shortage (Uang Hilang / Belum Tercatat): {formatRupiah(currentMonth.cashShortageLost)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#B91C1C" }}>
                      Click to resolve with backdated transactions without throwing off your ending balance.
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Info Popover for 3-Tier Taxonomy (Rule 11) */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { p: 2.5, maxWidth: 380, borderRadius: 2 } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          3-Tier Financial Taxonomy
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem", mb: 1.5 }}>
          Separates consumption from transfers and debts:
        </Typography>
        <Stack spacing={1} sx={{ fontSize: "0.8rem" }}>
          <Box>
            <strong>• Mandatory (Wajib):</strong> Fixed commitments that occur routinely (parking, fuel, bills).
          </Box>
          <Box>
            <strong>• Essential (Tidak Tetap):</strong> Unavoidable variable costs (primary meals, vehicle servicing).
          </Box>
          <Box>
            <strong>• Discretionary (Jajan):</strong> Flexible lifestyle choices (coffee, snacks, gaming, cigarettes).
          </Box>
          <Box>
            <strong>• Strict Consume Invariant:</strong> Talangan, Transfers, and PayLater repayments have <code>Consume = 0</code> to prevent artificial budget spikes.
          </Box>
        </Stack>
      </Popover>
    </Box>
  );
}

