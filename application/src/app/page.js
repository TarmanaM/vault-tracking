"use client";

import React from "react";
import { Container, Box, CircularProgress, Typography, Button } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useQuery } from "@tanstack/react-query";
import HeaderSummary from "@/components/HeaderSummary";
import VaultRibbon from "@/components/VaultRibbon";
import SmartActionCards from "@/components/SmartActionCards";
import RecentTransactionsList from "@/components/RecentTransactionsList";
import AutoChartDrawer from "@/components/AutoChartDrawer";
import ReconcileModal from "@/components/ReconcileModal";
import ExportModal from "@/components/ExportModal";
import UndoSnackbar from "@/components/UndoSnackbar";
import PendingRemindersBanner from "@/components/PendingRemindersBanner";
import CustomTransactionModal from "@/components/CustomTransactionModal";
import { useLedgerStore } from "@/store/useLedgerStore";

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
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <Typography color="error" variant="h6">
          Failed to load dashboard: {error.message}
        </Typography>
      </Container>
    );
  }

  const { summary, vaults, actionCards, parties, categories, pendingReminders } = data || {};

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1, sm: 2 } }}>
      {/* 1. Header & Total Net Wealth Overview */}
      <HeaderSummary summary={summary} />

      {/* 2. Draft Notes & Pending Reminders Banner */}
      <PendingRemindersBanner reminders={pendingReminders} />

      {/* 3. Horizontal Scrollable Vault Accounts */}
      <VaultRibbon vaults={vaults} />

      {/* 4. Action Row for Custom Input */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => openTransactionDialog(null)}
          sx={{ borderColor: "#CBD5E1", color: "#334155", fontWeight: 700 }}
        >
          + Custom / Backdated Entry
        </Button>
      </Box>

      {/* 5. Recommended Smart Action Cards (In-House Routine Ranking) */}
      <SmartActionCards actionCards={actionCards} vaults={vaults} />

      {/* 6. Live Activity Ledger */}
      <RecentTransactionsList />

      {/* 7. Drawers & Modals */}
      <AutoChartDrawer />
      <ReconcileModal vaults={vaults} />
      <ExportModal />
      <UndoSnackbar />
      <CustomTransactionModal vaults={vaults} parties={parties} categories={categories} />
    </Container>
  );
}
