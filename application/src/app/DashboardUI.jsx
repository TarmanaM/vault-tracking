"use client";

import React from "react";
import { Container, Box, CircularProgress, Alert, Paper, Button, Typography } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HeaderSummary from "@/components/dashboard/HeaderSummary";
import VaultRibbon from "@/components/vaults/VaultRibbon";
import PendingRemindersBanner from "@/components/dashboard/PendingRemindersBanner";
import SmartActionCards from "@/components/cards/SmartActionCards";
import LayerConsumptionOverview from "@/components/dashboard/LayerConsumptionOverview";
import { useDashboardLogic } from "./useDashboardLogic";

export default function DashboardUI() {
  const { data, user, isLoading, error, reminders, baseCurrency, openTransactionDialog } =
    useDashboardLogic();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load Vault Tracking dashboard: {error?.message || "Unknown error"}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <HeaderSummary summary={data.summary} baseCurrency={baseCurrency} user={user} />

      <LayerConsumptionOverview currentMonth={data.summary?.currentMonth} />

      {reminders.length > 0 && <PendingRemindersBanner reminders={reminders} />}

      <Paper
        elevation={0}
        sx={{
          mb: { xs: 2, sm: 2.5 },
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          border: "1px solid #BFDBFE",
          background: "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E3A8A", lineHeight: 1.2 }}>
            Record New Transaction
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Custom expense, income, vault transfer, Valas entry, or split/loan with full details
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => openTransactionDialog(null)}
          sx={{
            fontWeight: 800,
            borderRadius: 2.5,
            px: 3,
            py: { xs: 1.1, sm: 1 },
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          }}
        >
          + Transaction
        </Button>
      </Paper>

      <SmartActionCards
        actionCards={data.actionCards || []}
        searchableCards={data.searchableCards || []}
        vaults={data.vaults || []}
        parties={data.parties || []}
        defaultMonthlyVaultId={data.defaultMonthlyVaultId || null}
        defaultCashVaultId={data.defaultCashVaultId || null}
        baseCurrency={baseCurrency}
      />

      {reminders.length === 0 && <PendingRemindersBanner reminders={reminders} />}

      <VaultRibbon vaults={data.vaults || []} baseCurrency={baseCurrency} />
    </Container>
  );
}
