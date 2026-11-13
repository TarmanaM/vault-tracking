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
  Stack,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
} from "@mui/material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";
import ReconcileModal from "@/components/ReconcileModal";

export default function CheckpointsPage() {
  const openReconcileDialog = useLedgerStore((s) => s.openReconcileDialog);

  const { data, isLoading } = useQuery({
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

  const { checkpoints = [], vaults = [] } = data || {};

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Title & Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
            Vaults &amp; Physical Checkpoint Audits
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Perform physical count audits, reconcile Cash D1/D2 and Coin pieces, and manage baseline initial funds.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<SyncAltIcon />}
          onClick={() => openReconcileDialog(null)}
          sx={{ bgcolor: "#2563EB" }}
        >
          New Checkpoint Audit
        </Button>
      </Box>

      {/* Vaults Grid */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569", mb: 1.5, letterSpacing: 0.5 }}>
        ACTIVE STORAGE VAULTS &amp; WALLETS
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {vaults.map((vault) => (
          <Grid item xs={12} sm={6} md={4} key={vault.id}>
            <Card sx={{ height: "100%", borderTop: `4px solid ${vault.colorHex || "#2563EB"}` }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                      {vault.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {vault.vaultType.replace("_", " ")}
                    </Typography>
                  </Box>

                  <Chip label={vault.code} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem" }} />
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 800, color: Number(vault.currentBalance) < 0 ? "#EF4444" : "#0F172A", mb: 1 }}>
                  {formatRupiah(vault.currentBalance)}
                </Typography>

                {/* Sub-containers */}
                {vault.subContainers && vault.subContainers.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    {vault.subContainers.map((sc) => (
                      <Chip
                        key={sc.id}
                        label={`${sc.name}: ${formatRupiah(sc.lastCountedBalance)}`}
                        size="small"
                        sx={{ fontSize: "0.7rem", bgcolor: "#F1F5F9" }}
                      />
                    ))}
                  </Stack>
                )}

                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<SyncAltIcon />}
                  onClick={() => openReconcileDialog(vault.id)}
                  sx={{ borderColor: "#CBD5E1", color: "#334155" }}
                >
                  Audit This Vault
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Historical Checkpoints Log */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#475569", mb: 1.5, letterSpacing: 0.5 }}>
        PAST AUDIT CHECKPOINTS &amp; DISCREPANCY LOGS
      </Typography>

      <Card>
        <Box sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Period / Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vault</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Physical Count</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">System Book</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Raw Discrepancy</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checkpoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center", py: 4, color: "#64748B" }}>
                    No audit checkpoints recorded yet. Tap &quot;New Checkpoint Audit&quot; above to perform your first physical count!
                  </TableCell>
                </TableRow>
              ) : (
                checkpoints.map((cp) => {
                  const diff = Number(cp.rawDiscrepancyAmount);
                  return (
                    <TableRow key={cp.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {cp.periodLabel || "Audit"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cp.checkpointDate?.split("T")[0]}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{cp.vault.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={cp.checkpointType === "INITIAL_FUND" ? "Dana Awal" : "Periodic Audit"}
                          size="small"
                          sx={{ fontSize: "0.65rem", height: 20 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatRupiah(cp.originalCountedAmount)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#64748B" }}>
                        {formatRupiah(cp.systemBookBalanceBefore)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 800,
                          color: diff < 0 ? "#DC2626" : diff > 0 ? "#16A34A" : "#0F172A",
                        }}
                      >
                        {diff < 0 ? formatRupiah(diff) : diff > 0 ? `+${formatRupiah(diff)}` : "Rp 0"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={diff === 0 ? "Synced" : diff < 0 ? "Shortage Handled" : "Surplus Handled"}
                          size="small"
                          color={diff === 0 ? "default" : diff < 0 ? "error" : "success"}
                          variant="outlined"
                          sx={{ fontSize: "0.65rem", height: 20 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <ReconcileModal vaults={vaults} />
    </Container>
  );
}
