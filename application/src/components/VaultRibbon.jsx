"use client";

import React from "react";
import { Box, Typography, Card, CardActionArea, Stack, Chip } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import MoneyValue from "@/components/MoneyValue";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function VaultRibbon({ vaults = [] }) {
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#475569", mb: 1, letterSpacing: 0.5 }}>
        STORAGE VAULTS (Click to View Balance History)
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#CBD5E1", borderRadius: 3 },
        }}
      >
        {vaults.map((vault) => {
          const isNegative = Number(vault.currentBalance) < 0;
          return (
            <Card
              key={vault.id}
              sx={{
                minWidth: 160,
                flexShrink: 0,
                borderTop: `3px solid ${vault.colorHex || "#3B82F6"}`,
                bgcolor: "#FFFFFF",
              }}
            >
              <CardActionArea
                onClick={() => openChartDrawer("VAULT", vault.id, vault.name, vault.vaultType)}
                sx={{ p: 1.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 18, color: vault.colorHex || "#3B82F6" }} />
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem", noWrap: true }}>
                    {vault.name}
                  </Typography>
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: isNegative ? "#EF4444" : "#0F172A",
                    fontSize: "0.95rem",
                  }}
                >
                  <MoneyValue value={vault.currentBalance} includeCents allowTapToggle />
                </Typography>

                {/* Sub-container pills if available (e.g. D1, D2 for Cash) */}
                {vault.subContainers && vault.subContainers.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {vault.subContainers.map((sc) => (
                      <Chip
                        key={sc.id}
                        label={
                          <>
                            {sc.code}: <MoneyValue value={sc.lastCountedBalance} />
                          </>
                        }
                        size="small"
                        sx={{ fontSize: "0.65rem", height: 18, bgcolor: "#F1F5F9" }}
                      />
                    ))}
                  </Stack>
                )}
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

