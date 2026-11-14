"use client";

import React from "react";
import { Container, Box, CircularProgress, Alert, Paper, Button, Typography, Stack } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import HeaderSummary from "@/components/HeaderSummary";
import VaultRibbon from "@/components/VaultRibbon";
import PendingRemindersBanner from "@/components/PendingRemindersBanner";
import SmartActionCards from "@/components/SmartActionCards";
import LayerConsumptionOverview from "@/components/LayerConsumptionOverview";

export default function DashboardPage() {
  const openTransactionDialog = useLedgerStore((s) => s.openTransactionDialog);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

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

  const reminders = data.pendingReminders || [];
  const baseCurrency = data.appSettings?.baseCurrency || "IDR";

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <HeaderSummary summary={data.summary} baseCurrency={baseCurrency} />

      <LayerConsumptionOverview currentMonth={data.summary?.currentMonth} />

      {reminders.length > 0 && <PendingRemindersBanner reminders={reminders} />}

      {/* Dedicated Primary + Transaction CTA Hierarchy positioned above Smart Action Cards (#8) */}
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
