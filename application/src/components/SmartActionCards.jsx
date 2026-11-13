"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
} from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { formatRupiah } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function SmartActionCards({ actionCards = [], vaults = [] }) {
  const queryClient = useQueryClient();
  const openChartDrawer = useLedgerStore((s) => s.openChartDrawer);
  const showUndoSnackbar = useLedgerStore((s) => s.showUndoSnackbar);

  // Selected Vault override state per card (Rule 16: Fluid Vaults)
  const [selectedVaultOverrides, setSelectedVaultOverrides] = useState({});
  // Selected Amount override state per card
  const [selectedAmountOverrides, setSelectedAmountOverrides] = useState({});
  // Optional Tax/Fee input visibility & state
  const [taxFeeInputs, setTaxFeeInputs] = useState({});
  // Vault Switcher anchorEl state
  const [vaultMenuAnchor, setVaultMenuAnchor] = useState({ cardId: null, anchorEl: null });

  // Mutation to submit transaction
  const submitTxMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (createdTx, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      showUndoSnackbar(`Recorded "${variables.title}" (${formatRupiah(variables.grossAmount)})`, createdTx.id);
    },
    onError: (err) => {
      alert(`Transaction failed: ${err.message}`);
    },
  });

  const handleVaultSelect = (cardId, vaultId) => {
    setSelectedVaultOverrides((prev) => ({ ...prev, [cardId]: vaultId }));
    setVaultMenuAnchor({ cardId: null, anchorEl: null });
  };

  const handleAmountChipClick = (cardId, amt) => {
    setSelectedAmountOverrides((prev) => ({ ...prev, [cardId]: amt }));
  };

  const handleCardSubmit = (card) => {
    const activeVaultId = selectedVaultOverrides[card.id] || card.defaultVaultId;
    const activeAmount = selectedAmountOverrides[card.id] || card.defaultAmount || 0;
    const taxFee = Number(taxFeeInputs[card.id] || 0);

    submitTxMutation.mutate({
      title: card.title,
      nature: card.cardActionType === "INCOME" ? "INCOME" : "EXPENSE",
      categoryId: card.defaultCategoryId,
      commitmentType: card.defaultCategory?.commitmentType || "NONE",
      priorityTier: card.defaultCategory?.priorityTier || "NONE",
      partyId: card.defaultPartyId,
      actionCardId: card.id,
      sourceVaultId: activeVaultId,
      grossAmount: activeAmount,
      taxFeeAmount: taxFee,
    });
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FlashOnIcon sx={{ color: "#F59E0B" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E293B" }}>
            Recommended Smart Actions
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 500 }}>
          Ranked by time &amp; routine (In-House Habit Engine)
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {actionCards.map((card) => {
          const activeVaultId = selectedVaultOverrides[card.id] || card.defaultVaultId;
          const activeVault = vaults.find((v) => v.id === activeVaultId) || card.defaultVault;
          const quickAmounts = card.quickAmountsJson ? JSON.parse(card.quickAmountsJson) : [];
          const activeAmount = selectedAmountOverrides[card.id] || card.defaultAmount || (quickAmounts[0] ?? 0);
          const showTaxInput = Boolean(taxFeeInputs[`${card.id}_open`]);

          return (
            <Grid item xs={12} sm={6} md={4} key={card.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "all 0.2s ease-in-out",
                  "&:hover": { borderColor: "#93C5FD", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)" },
                }}
              >
                <CardContent sx={{ p: 2, pb: 1 }}>
                  {/* Top Bar: Title & Auto-Chart Trigger */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
                        {card.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
                        {card.defaultCategory?.name || "Kategori"} • {card.dynamicScore || 0}% match
                      </Typography>
                    </Box>

                    <Tooltip title="View History &amp; Trend Chart">
                      <IconButton
                        size="small"
                        onClick={() => openChartDrawer("CARD", card.id, card.title, card.subtitle)}
                        sx={{ color: "#64748B", "&:hover": { color: "#2563EB" } }}
                      >
                        <ShowChartIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Vault Switcher Pill (Rule 16: Fluid Vaults) */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <Chip
                      icon={<SwapHorizIcon sx={{ fontSize: "14px !important" }} />}
                      label={activeVault?.name || "Select Vault"}
                      size="small"
                      onClick={(e) => setVaultMenuAnchor({ cardId: card.id, anchorEl: e.currentTarget })}
                      sx={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        bgcolor: "#EFF6FF",
                        color: "#1D4ED8",
                        border: "1px solid #BFDBFE",
                        cursor: "pointer",
                      }}
                    />
                  </Stack>

                  {/* Quick Amount Chips if configured */}
                  {quickAmounts.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}>
                      {quickAmounts.map((amt) => {
                        const isSelected = activeAmount === amt;
                        return (
                          <Chip
                            key={amt}
                            label={formatRupiah(amt)}
                            size="small"
                            onClick={() => handleAmountChipClick(card.id, amt)}
                            variant={isSelected ? "filled" : "outlined"}
                            color={isSelected ? "primary" : "default"}
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: isSelected ? 700 : 500,
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}

                  {/* Optional Tax/Fee Auto-Split Input (Section 11.2) */}
                  {showTaxInput ? (
                    <TextField
                      size="small"
                      label="+ Tax / Admin Fee"
                      type="number"
                      value={taxFeeInputs[card.id] || ""}
                      onChange={(e) => setTaxFeeInputs((prev) => ({ ...prev, [card.id]: e.target.value }))}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                      }}
                      sx={{ mb: 1.5, width: "100%" }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
                      onClick={() => setTaxFeeInputs((prev) => ({ ...prev, [`${card.id}_open`]: true }))}
                      sx={{ fontSize: "0.7rem", color: "#64748B", p: 0, mb: 1, minWidth: "auto" }}
                    >
                      + Add Tax / Admin Fee
                    </Button>
                  )}
                </CardContent>

                {/* 1-Tap Action Button */}
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    disabled={submitTxMutation.isPending || !activeAmount}
                    onClick={() => handleCardSubmit(card)}
                    startIcon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      bgcolor: card.cardActionType === "INCOME" ? "#059669" : "#2563EB",
                      "&:hover": {
                        bgcolor: card.cardActionType === "INCOME" ? "#047857" : "#1D4ED8",
                      },
                      py: 1,
                    }}
                  >
                    {card.cardActionType === "INCOME" ? "Receive" : "Pay"} {formatRupiah(activeAmount)}
                  </Button>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Fluid Vault Selector Menu */}
      <Menu
        anchorEl={vaultMenuAnchor.anchorEl}
        open={Boolean(vaultMenuAnchor.anchorEl)}
        onClose={() => setVaultMenuAnchor({ cardId: null, anchorEl: null })}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: "#64748B", fontWeight: 700, display: "block" }}>
          SWITCH PAYMENT VAULT
        </Typography>
        {vaults.map((v) => (
          <MenuItem
            key={v.id}
            onClick={() => handleVaultSelect(vaultMenuAnchor.cardId, v.id)}
            sx={{ fontSize: "0.85rem", fontWeight: 600 }}
          >
            {v.name} ({formatRupiah(v.currentBalance)})
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

