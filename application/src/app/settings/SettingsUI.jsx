"use client";

import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import AccountSecurityCard from "@/features/settings/AccountSecurityCard";
import PersonalCategoriesPanel from "@/features/settings/PersonalCategoriesPanel";
import { useSettingsLogic } from "./useSettingsLogic";

export default function SettingsUI() {
  const logic = useSettingsLogic();

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
            Settings &amp; Personalize
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B", mt: 0.25 }}>
            Customize your personal transaction categories, spending layers, currency, and account security.
          </Typography>
        </Box>

        <AccountSecurityCard {...logic} />

        <PersonalCategoriesPanel {...logic} />
      </Stack>
    </Box>
  );
}
