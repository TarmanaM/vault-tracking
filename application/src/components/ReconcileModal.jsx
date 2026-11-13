"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  MenuItem,
  Stack,
  Divider,
  Grid,
} from "@mui/material";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatRupiah } from "@/lib/money";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ReconcileModal({ vaults = [] }) {
  const { reconcileDialog, closeReconcileDialog } = useLedgerStore();
  const queryClient = useQueryClient();

  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [actualBalanceInput, setActualBalanceInput] = useState("");
  const [checkpointType, setCheckpointType] = useState("AUDIT_SYNC");

  // Sub-containers for Cash (D1 and D2)
  const [d1Balance, setD1Balance] = useState("");
  const [d2Balance, setD2Balance] = useState("");

  // Coin Denomination pieces (1000, 500, 200, 100)
  const [coin1000, setCoin1000] = useState("");
  const [coin500, setCoin500] = useState("");
  const [coin200, setCoin200] = useState("");
  const [coin100, setCoin100] = useState("");

  const activeVault = vaults.find((v) => v.id === parseInt(selectedVaultId, 10));

  useEffect(() => {
    if (reconcileDialog.vaultId) {
      setSelectedVaultId(String(reconcileDialog.vaultId));
    } else if (vaults.length > 0 && !selectedVaultId) {
      setSelectedVaultId(String(vaults[0].id));
    }
  }, [reconcileDialog.vaultId, vaults]);

  // Auto calculate sum if Cash sub-containers change
  useEffect(() => {
    if (activeVault?.code === "CASH") {
      const sum = (Number(d1Balance) || 0) + (Number(d2Balance) || 0);
      setActualBalanceInput(String(sum));
    }
  }, [d1Balance, d2Balance, activeVault]);

  // Auto calculate sum if Coin denominations change
  useEffect(() => {
    if (activeVault?.code === "COIN") {
      const sum =
        (Number(coin1000) || 0) * 1000 +
        (Number(coin500) || 0) * 500 +
        (Number(coin200) || 0) * 200 +
        (Number(coin100) || 0) * 100;
      setActualBalanceInput(String(sum));
    }
  }, [coin1000, coin500, coin200, coin100, activeVault]);

  const reconcileMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      closeReconcileDialog();
      alert("Vault reconciled successfully!");
    },
    onError: (err) => {
      alert(`Reconciliation error: ${err.message}`);
    },
  });

  const handleSubmit = () => {
    const counted = Number(actualBalanceInput) || 0;
    const denominations = [];
    const subContainers = [];

    if (activeVault?.code === "CASH") {
      subContainers.push({ code: "D1", name: "Dompet D1 (Utama)", balance: Number(d1Balance) || 0 });
      subContainers.push({ code: "D2", name: "Dompet D2 (Cadangan)", balance: Number(d2Balance) || 0 });
    }

    if (activeVault?.code === "COIN") {
      denominations.push({ label: "Koin 1000", unitValue: 1000, quantity: Number(coin1000) || 0 });
      denominations.push({ label: "Koin 500", unitValue: 500, quantity: Number(coin500) || 0 });
      denominations.push({ label: "Koin 200", unitValue: 200, quantity: Number(coin200) || 0 });
      denominations.push({ label: "Koin 100", unitValue: 100, quantity: Number(coin100) || 0 });
    }

    reconcileMutation.mutate({
      vaultId: activeVault.id,
      checkpointType,
      actualCountedAmount: counted,
      denominations,
      subContainers,
    });
  };

  const countedNum = Number(actualBalanceInput) || 0;
  const bookNum = Number(activeVault?.currentBalance) || 0;
  const diffNum = countedNum - bookNum;

  return (
    <Dialog open={reconcileDialog.open} onClose={closeReconcileDialog} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Audit &amp; Reconcile Vault Balance</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            select
            label="Select Storage Vault"
            value={selectedVaultId}
            onChange={(e) => setSelectedVaultId(e.target.value)}
            fullWidth
            size="small"
          >
            {vaults.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {v.name} (Current: {formatRupiah(v.currentBalance)})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Audit Type"
            value={checkpointType}
            onChange={(e) => setCheckpointType(e.target.value)}
            fullWidth
            size="small"
          >
            <MenuItem value="AUDIT_SYNC">Periodic Physical Audit (Cek Fisik Rutin)</MenuItem>
            <MenuItem value="INITIAL_FUND">Baseline Initial Fund (Dana Awal)</MenuItem>
          </TextField>

          {/* Cash Sub-Containers (D1 and D2) */}
          {activeVault?.code === "CASH" && (
            <Box sx={{ bgcolor: "#F8FAFC", p: 2, borderRadius: 2, border: "1px solid #E2E8F0" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Count Physical Cash Wallets:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Dompet D1 (Utama)"
                    type="number"
                    size="small"
                    fullWidth
                    value={d1Balance}
                    onChange={(e) => setD1Balance(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Dompet D2 (Cadangan)"
                    type="number"
                    size="small"
                    fullWidth
                    value={d2Balance}
                    onChange={(e) => setD2Balance(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Coin Denominations (1000, 500, 200, 100) */}
          {activeVault?.code === "COIN" && (
            <Box sx={{ bgcolor: "#F8FAFC", p: 2, borderRadius: 2, border: "1px solid #E2E8F0" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Count Coin Pieces (Keping):
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField
                    label="Koin 1.000 (Pcs)"
                    type="number"
                    size="small"
                    fullWidth
                    value={coin1000}
                    onChange={(e) => setCoin1000(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Koin 500 (Pcs)"
                    type="number"
                    size="small"
                    fullWidth
                    value={coin500}
                    onChange={(e) => setCoin500(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Koin 200 (Pcs)"
                    type="number"
                    size="small"
                    fullWidth
                    value={coin200}
                    onChange={(e) => setCoin200(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Koin 100 (Pcs)"
                    type="number"
                    size="small"
                    fullWidth
                    value={coin100}
                    onChange={(e) => setCoin100(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Total Physical Count Input */}
          <TextField
            label="Total Actual Physical Balance (Rp)"
            type="number"
            value={actualBalanceInput}
            onChange={(e) => setActualBalanceInput(e.target.value)}
            fullWidth
            required
          />

          {/* Discrepancy Card */}
          <Box sx={{ bgcolor: "#F1F5F9", p: 2, borderRadius: 2 }}>
            <Stack spacing={0.5}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  System Book Balance:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatRupiah(bookNum)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Physical Counted:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatRupiah(countedNum)}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Calculated Discrepancy:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: diffNum < 0 ? "#DC2626" : diffNum > 0 ? "#10B981" : "#0F172A",
                  }}
                >
                  {diffNum < 0
                    ? `${formatRupiah(diffNum)} (Uang Hilang)`
                    : diffNum > 0
                    ? `+${formatRupiah(diffNum)} (Bunga / Surplus)`
                    : "Rp 0 (100% Synced)"}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={closeReconcileDialog} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={reconcileMutation.isPending || !actualBalanceInput}
        >
          {reconcileMutation.isPending ? "Syncing..." : "Confirm & Sync Balance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

