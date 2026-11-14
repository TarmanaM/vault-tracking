"use client";

import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Popover,
} from "@mui/material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useQuery } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import MoneyValue from "@/components/MoneyValue";

export default function CheckpointsPage() {
  const { openReconcileDialog } = useLedgerStore();
  const [infoAnchor, setInfoAnchor] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checkpoints"],
    queryFn: async () => {
      const res = await fetch("/api/reconcile");
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load checkpoints: {error?.message || "Unknown error"}</Alert>
      </Container>
    );
  }

  const vaults = data.vaults || [];
  const checkpoints = data.checkpoints || [];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AccountBalanceWalletIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
            Vaults &amp; Physical Checkpoints
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Button
          variant="contained"
          startIcon={<SyncAltIcon />}
          onClick={() => openReconcileDialog(null)}
          sx={{ fontWeight: 700 }}
        >
          Audit &amp; Reconcile Vault
        </Button>
      </Box>

      {/* Info Popover (Rule 11) */}
      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 320 }}>
          <strong>Physical Audit Checkpoints:</strong> Anchor your live cash/coin/bank balances whenever counting manually. Any backdated transactions recorded before the latest checkpoint automatically absorb into unexplained discrepancies without corrupting your current balance.
        </Typography>
      </Popover>

      {/* Vaults Overview Grid */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569", mb: 1.5 }}>
        ACTIVE VAULTS ({vaults.length})
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {vaults.map((v) => {
          const isNegative = Number(v.currentBalance) < 0;
          return (
            <Grid item xs={12} sm={6} md={4} key={v.id}>
              <Card sx={{ height: "100%", borderTop: `3px solid ${v.colorHex || "#2563EB"}` }}>
                <CardContent sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%", gap: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {v.name}
                    </Typography>
                    <Chip label={v.vaultType} size="small" sx={{ fontSize: "0.65rem", height: 20 }} />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 800, color: isNegative ? "#DC2626" : "#0F172A" }}>
                    <MoneyValue value={v.currentBalance} includeCents allowTapToggle />
                  </Typography>

                  {v.subContainers && v.subContainers.length > 0 && (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {v.subContainers.map((sc) => (
                        <Chip
                          key={sc.id}
                          size="small"
                          label={
                            <>
                              {sc.code}: <MoneyValue value={sc.lastCountedBalance} />
                            </>
                          }
                          sx={{ fontSize: "0.68rem", height: 22, bgcolor: "#F1F5F9" }}
                        />
                      ))}
                    </Stack>
                  )}

                  <Box sx={{ mt: "auto", pt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      startIcon={<SyncAltIcon />}
                      onClick={() => openReconcileDialog(v.id)}
                      sx={{ fontWeight: 700 }}
                    >
                      Audit {v.name}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Checkpoint History Timeline */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <HistoryOutlinedIcon color="action" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569" }}>
          RECENT AUDIT CHECKPOINTS &amp; COIN COUNTS ({checkpoints.length})
        </Typography>
      </Stack>

      {checkpoints.length === 0 ? (
        <Alert severity="info">No audit checkpoints recorded yet. Click Audit Vault to create your first checkpoint.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {checkpoints.map((cp) => {
            const unexplained = Number(cp.unexplainedDiscrepancyAmount || 0);
            const rawDiff = Number(cp.rawDiscrepancyAmount || 0);
            const hasShortage = unexplained < 0;

            return (
              <Card
                key={cp.id}
                sx={{
                  borderLeft: hasShortage
                    ? "4px solid #D97706"
                    : rawDiff > 0
                    ? "4px solid #10B981"
                    : "4px solid #2563EB",
                  bgcolor: hasShortage ? "#FFFBEB" : "#FFFFFF",
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1 }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {cp.vault?.name} — {cp.periodLabel}
                        </Typography>
                        <Chip label={cp.checkpointType} size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                        {hasShortage ? (
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: "0.85rem !important", color: "#B45309 !important" }} />}
                            label="Unresolved Shortage"
                            size="small"
                            sx={{ height: 20, fontSize: "0.65rem", bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: "0.85rem !important" }} />}
                            label="Synced"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(cp.checkpointTimestamp).toLocaleString()}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        Counted: <MoneyValue value={cp.originalCountedAmount} includeCents allowTapToggle />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Book Before: <MoneyValue value={cp.systemBookBalanceBefore} includeCents />
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: rawDiff < 0 ? "#D97706" : rawDiff > 0 ? "#10B981" : "#475569" }}>
                      Raw Diff: {rawDiff > 0 ? "+" : ""}
                      <MoneyValue value={rawDiff} includeCents />
                    </Typography>

                    <Typography variant="caption" sx={{ fontWeight: 700, color: unexplained < 0 ? "#B45309" : "#475569" }}>
                      Unexplained Left: <MoneyValue value={unexplained} includeCents />
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Effective Anchor: <MoneyValue value={cp.effectiveAnchorAmount} includeCents />
                    </Typography>

                    {cp.linkedTransactions && cp.linkedTransactions.length > 0 && (
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                        Absorbed Entries: {cp.linkedTransactions.length}
                      </Typography>
                    )}
                  </Stack>

                  {cp.denominations && cp.denominations.length > 0 && (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {cp.denominations.map((d) => (
                        <Chip
                          key={d.id}
                          size="small"
                          label={`${d.label}: ${d.quantity} pcs`}
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.66rem", bgcolor: "#F8FAFC" }}
                        />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
