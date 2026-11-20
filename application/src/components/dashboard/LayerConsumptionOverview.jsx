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
import MoneyValue from "@/components/common/MoneyValue";
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
      title: "Fixed & Bills",
      amount: currentMonth.mandatoryExpense,
      icon: <LockClockOutlinedIcon sx={{ color: "#2563EB" }} />,
      desc: "Fuel, parking, utilities, subscriptions",
      color: "#2563EB",
    },
    {
      key: "VARIABLE_ESSENTIAL",
      title: "Everyday Needs",
      amount: currentMonth.variableEssentialExpense,
      icon: <ShoppingBagOutlinedIcon sx={{ color: "#F97316" }} />,
      desc: "Groceries, daily meals, health, commuting",
      color: "#F97316",
    },
    {
      key: "DISCRETIONARY_JAJAN",
      title: "Lifestyle & Wants",
      amount: currentMonth.discretionaryExpense,
      icon: <LocalCafeOutlinedIcon sx={{ color: "#D97706" }} />,
      desc: "Coffee, dining out, entertainment, hobbies",
      color: "#D97706",
    },
    {
      key: "SOCIAL_CHARITY",
      title: "Giving & Gifts",
      amount: currentMonth.socialCharityExpense,
      icon: <VolunteerActivismOutlinedIcon sx={{ color: "#10B981" }} />,
      desc: "Charity, donations, gifts, debt write-offs",
      color: "#10B981",
    },
  ];

  return (
    <Box sx={{ mb: { xs: 2.5, sm: 3.5 } }}>
      {/* Header with (i) Info Button (Rule 11) */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5, mb: { xs: 1, sm: 1.5 } }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E293B", fontSize: { xs: "0.92rem", sm: "1rem" } }}>
            Monthly Consumption ({currentMonth.monthTag})
          </Typography>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: "#64748B", p: 0.25 }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "#2563EB", fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
          Total: <MoneyValue value={totalConsume} allowTapToggle />
        </Typography>
      </Box>

      {/* Income vs Consumption Pacing Bar */}
      {totalIncome > 0 && (
        <Card sx={{ p: { xs: 1.25, sm: 2 }, mb: { xs: 1.5, sm: 2 }, bgcolor: "#F8FAFC" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
              MONTHLY BUDGET PACING
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: pacingPercent > 80 ? "#DC2626" : "#2563EB" }}>
              {pacingPercent}% of Income (<MoneyValue value={totalIncome} />)
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

      {/* Layer Cards (2x2 compact grid on mobile, 4-col on desktop; Clickable for Instant Charts - Rule 17) */}
      <Grid container spacing={{ xs: 1, sm: 2 }}>
        {layers.map((layer) => (
          <Grid size={{ xs: 6, md: 3 }} key={layer.key}>
            <Card sx={{ borderLeft: `4px solid ${layer.color}`, height: "100%" }}>
              <CardActionArea
                onClick={() => openChartDrawer("LAYER", layer.key, layer.title)}
                sx={{ p: { xs: 1.25, sm: 2 }, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start" }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: { xs: 0.5, sm: 1 }, width: "100%", minWidth: 0 }}>
                  {layer.icon}
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, fontSize: { xs: "0.74rem", sm: "0.85rem" } }}
                    noWrap
                  >
                    {layer.title}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.25, fontSize: { xs: "0.98rem", sm: "1.2rem" } }}>
                  <MoneyValue value={layer.amount} allowTapToggle />
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: "block", width: "100%", fontSize: { xs: "0.64rem", sm: "0.7rem" } }}
                >
                  {layer.desc}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}

        {/* Cash Shortage Amber Warning Card (#13) */}
        {Number(currentMonth.cashShortageLost) > 0 && (
          <Grid size={12}>
            <Card sx={{ borderLeft: "4px solid #D97706", bgcolor: "#FFFBEB" }}>
              <CardActionArea
                onClick={() => openChartDrawer("LAYER", "RECONCILIATION_LOST", "Unaccounted Cash Shortage")}
                sx={{ p: 2 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon sx={{ color: "#D97706" }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#92400E" }}>
                      Unaccounted Cash Shortage: <MoneyValue value={currentMonth.cashShortageLost} allowTapToggle />
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#B45309" }}>
                      Click to review or resolve with backdated transactions without throwing off your ending balance.
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Info Popover for 4 Spending Layers (Rule 11) */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { p: 2.5, maxWidth: 380, borderRadius: 2 } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          4 Spending Layers &amp; Consume Rule
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem", mb: 1.5 }}>
          Categories organize daily expenses cleanly into four neutral layers while protecting budget accuracy:
        </Typography>
        <Stack spacing={1} sx={{ fontSize: "0.8rem" }}>
          <Box>
            <strong>• Fixed &amp; Bills:</strong> Recurring obligations (fuel, parking, rent, utilities, subscriptions).
          </Box>
          <Box>
            <strong>• Everyday Needs:</strong> Variable essentials (groceries, meals, health, upkeep).
          </Box>
          <Box>
            <strong>• Lifestyle &amp; Wants:</strong> Flexible personal spending (coffee, dining out, entertainment).
          </Box>
          <Box>
            <strong>• Giving &amp; Gifts:</strong> Charity, donations, gifts, and forgiven receivables.
          </Box>
          <Box>
            <strong>• Strict Consume Invariant:</strong> Transfers, lent money, and debt repayments have <code>Consume = 0</code> to prevent artificial budget spikes.
          </Box>
        </Stack>
      </Popover>
    </Box>
  );
}

