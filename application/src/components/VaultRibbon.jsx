"use client";

import React from "react";
import { Box, Typography, Card, CardActionArea, Stack, Chip } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MoneyValue from "@/components/MoneyValue";
import VaultAvatar from "@/components/VaultAvatar";
import { useLedgerStore } from "@/store/useLedgerStore";
import { sortVaultsByBalanceDesc } from "@/lib/vaultHelpers";

export default function VaultRibbon({ vaults = [], baseCurrency = "IDR" }) {
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);
  const openVaultProfileDialog = useLedgerStore((s) => s.openVaultProfileDialog);
  const sortedVaults = sortVaultsByBalanceDesc(vaults);

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#475569", mb: 1, letterSpacing: 0.5 }}>
        STORAGE VAULTS (Sorted by Highest Value)
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#CBD5E1", borderRadius: 3 },
        }}
      >
        {sortedVaults.map((vault) => {
          const summary = vault.partitionSummary;
          const displayBalance = summary?.totalEstimatedBase ?? vault.currentBalance;
          const isNegative = Number(displayBalance) < 0;
          const hasForeign = Boolean(summary?.hasForeignSubVaults);

          return (
            <Card
              key={vault.id}
              sx={{
                minWidth: { xs: 158, sm: 174 },
                flexShrink: 0,
                borderTop: `3px solid ${vault.colorHex || "#3B82F6"}`,
                bgcolor: "#FFFFFF",
              }}
            >
              <CardActionArea
                onClick={() => openChartDrawer("VAULT", vault.id, vault.name, vault.vaultType)}
                sx={{ p: 1.5, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}
              >
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.75, width: "100%" }}>
                  <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0 }}>
                    <VaultAvatar vault={vault} size={26} />
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.84rem" }} noWrap>
                      {vault.name}
                    </Typography>
                  </Stack>

                  {vault.subVaultOutOfSync && (
                    <WarningAmberIcon sx={{ fontSize: 16, color: "#D97706", flexShrink: 0 }} />
                  )}
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: isNegative ? "#EF4444" : "#0F172A",
                    fontSize: "0.95rem",
                  }}
                >
                  <MoneyValue value={displayBalance} currency={baseCurrency} includeCents allowTapToggle />
                </Typography>

                {hasForeign && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
                    Base Book: <MoneyValue value={vault.currentBalance} currency={baseCurrency} />
                  </Typography>
                )}

                {vault.subContainers && vault.subContainers.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {vault.subContainers.slice(0, 3).map((sc) => {
                      const pocketBal = sc.effectiveBalance ?? sc.currentBalance ?? sc.lastCountedBalance;
                      const pocketCcy = sc.currency || baseCurrency;
                      return (
                        <Chip
                          key={sc.id}
                          label={
                            <>
                              {sc.name}: <MoneyValue value={pocketBal} currency={pocketCcy} />
                            </>
                          }
                          size="small"
                          sx={{ fontSize: "0.64rem", height: 18, bgcolor: sc.isDefault ? "#EFF6FF" : "#F1F5F9" }}
                        />
                      );
                    })}
                  </Stack>
                )}
              </CardActionArea>
            </Card>
          );
        })}

        {/* Quick + Add Vault shortcut card (#5) */}
        <Card
          variant="outlined"
          sx={{
            minWidth: 120,
            flexShrink: 0,
            borderStyle: "dashed",
            borderColor: "#CBD5E1",
            bgcolor: "#F8FAFC",
          }}
        >
          <CardActionArea
            onClick={() => openVaultProfileDialog(null)}
            sx={{
              p: 1.5,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              color: "#475569",
            }}
          >
            <AddCircleOutlineIcon color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              + Add Vault
            </Typography>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  );
}
