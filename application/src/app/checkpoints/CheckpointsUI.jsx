"use client";

import React from "react";
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
  Collapse,
} from "@mui/material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import MoneyValue from "@/components/common/MoneyValue";
import VaultAvatar from "@/components/vaults/VaultAvatar";
import { useCheckpointsLogic } from "./useCheckpointsLogic";

export default function CheckpointsUI() {
  const {
    data,
    isLoading,
    error,
    vaults,
    checkpoints,
    baseCurrency,
    infoAnchor,
    setInfoAnchor,
    showAuditHistory,
    setShowAuditHistory,
    openReconcileDialog,
    openVaultProfileDialog,
    openSubVaultSyncDialog,
  } = useCheckpointsLogic();

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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.25, mb: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AccountBalanceWalletIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", fontSize: { xs: "1.18rem", sm: "1.5rem" } }}>
            Vaults &amp; Physical Checkpoints
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => openVaultProfileDialog(null)}
            sx={{ fontWeight: 700 }}
          >
            + Add Vault
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SyncAltIcon />}
            onClick={() => openReconcileDialog(null)}
            sx={{ fontWeight: 700 }}
          >
            Audit Vault
          </Button>
        </Stack>
      </Box>

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

      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569", mb: 1.25 }}>
        ACTIVE VAULTS ({vaults.length})
      </Typography>
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: { xs: 2.5, sm: 3.5 } }}>
        {vaults.map((v) => {
          const pSum = v.partitionSummary;
          const totalDisplay = pSum?.totalEstimatedBase ?? v.currentBalance;
          const isNegative = Number(totalDisplay) < 0;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={v.id}>
              <Card sx={{ height: "100%", borderTop: `3px solid ${v.colorHex || "#2563EB"}` }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, display: "flex", flexDirection: "column", height: "100%", gap: 0.75 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <VaultAvatar vault={v} size={32} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                        {v.name}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {v.subVaultOutOfSync && (
                        <Chip label="Out of Sync" size="small" color="warning" sx={{ fontSize: "0.62rem", height: 20, fontWeight: 700 }} />
                      )}
                      <Chip label={v.vaultType} size="small" sx={{ fontSize: "0.65rem", height: 20 }} />
                    </Stack>
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 800, color: isNegative ? "#DC2626" : "#0F172A" }}>
                    <MoneyValue value={totalDisplay} currency={baseCurrency} includeCents allowTapToggle />
                  </Typography>

                  {pSum?.hasForeignSubVaults && (
                    <Typography variant="caption" color="text.secondary">
                      Base Book: <MoneyValue value={v.currentBalance} currency={baseCurrency} forceExact />
                    </Typography>
                  )}

                  {v.subContainers && v.subContainers.length > 0 && (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {v.subContainers.map((sc) => {
                        const bal = sc.effectiveBalance ?? sc.currentBalance ?? sc.lastCountedBalance;
                        return (
                          <Chip
                            key={sc.id}
                            size="small"
                            color={sc.isDefault ? "primary" : "default"}
                            variant={sc.isDefault ? "outlined" : "filled"}
                            label={
                              <>
                                {sc.name}: <MoneyValue value={bal} currency={sc.currency || baseCurrency} />
                              </>
                            }
                            sx={{ fontSize: "0.68rem", height: 22, bgcolor: sc.isDefault ? "#EFF6FF" : "#F1F5F9" }}
                          />
                        );
                      })}
                    </Stack>
                  )}

                  <Stack direction="row" spacing={0.75} sx={{ mt: "auto", pt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => openVaultProfileDialog(v)}
                      sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                    >
                      Profile
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LayersOutlinedIcon />}
                      onClick={() => openSubVaultSyncDialog(v.id)}
                      sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                    >
                      Pockets
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SyncAltIcon />}
                      onClick={() => openReconcileDialog(v.id)}
                      sx={{ fontWeight: 700, fontSize: "0.72rem", flexGrow: 1 }}
                    >
                      Audit
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryOutlinedIcon color="action" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569" }}>
            RECENT AUDIT CHECKPOINTS &amp; COIN COUNTS ({checkpoints.length})
          </Typography>
        </Stack>

        <Button
          size="small"
          variant="outlined"
          endIcon={showAuditHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAuditHistory((prev) => !prev)}
          sx={{ fontWeight: 700, borderColor: "#CBD5E1", color: "#334155" }}
        >
          {showAuditHistory ? "Hide Audit History" : `Show Audit History (${checkpoints.length})`}
        </Button>
      </Box>

      <Collapse in={showAuditHistory} timeout="auto" unmountOnExit>
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
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
      </Collapse>
    </Container>
  );
}
