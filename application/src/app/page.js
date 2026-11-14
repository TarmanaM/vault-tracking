"use client";

import React from "react";
import { Container, Box, CircularProgress, Alert } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import HeaderSummary from "@/components/HeaderSummary";
import VaultRibbon from "@/components/VaultRibbon";
import PendingRemindersBanner from "@/components/PendingRemindersBanner";
import SmartActionCards from "@/components/SmartActionCards";
import LayerConsumptionOverview from "@/components/LayerConsumptionOverview";

export default function DashboardPage() {
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 } }}>
      <HeaderSummary summary={data.summary} />

      <VaultRibbon vaults={data.vaults || []} />

      <PendingRemindersBanner reminders={data.pendingReminders || []} />

      <SmartActionCards
        actionCards={data.actionCards || []}
        searchableCards={data.searchableCards || []}
        vaults={data.vaults || []}
        parties={data.parties || []}
      />

      <LayerConsumptionOverview currentMonth={data.summary?.currentMonth} />
    </Container>
  );
}
