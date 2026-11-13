"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
} from "@mui/material";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function CustomTransactionModal({ vaults = [], parties = [], categories = [] }) {
  const { transactionDialog, closeTransactionDialog, showUndoSnackbar } = useLedgerStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [nature, setNature] = useState("EXPENSE");
  const [grossAmount, setGrossAmount] = useState("");
  const [sourceVaultId, setSourceVaultId] = useState("");
  const [targetVaultId, setTargetVaultId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [taxFeeAmount, setTaxFeeAmount] = useState("");
  const [isBackdated, setIsBackdated] = useState(false);
  const [notes, setNotes] = useState("");

  const preset = transactionDialog.presetCard;

  useEffect(() => {
    if (preset) {
      setTitle(preset.title || "");
      setGrossAmount(preset.grossAmount ? String(preset.grossAmount) : "");
      if (preset.sourceVaultId) setSourceVaultId(String(preset.sourceVaultId));
      if (preset.partyId) setPartyId(String(preset.partyId));
      if (preset.categoryId) setCategoryId(String(preset.categoryId));
    } else {
      if (vaults.length > 0 && !sourceVaultId) setSourceVaultId(String(vaults[0].id));
      if (parties.length > 0 && !partyId) {
        const selfParty = parties.find((p) => p.partyType === "SELF") || parties[0];
        setPartyId(String(selfParty.id));
      }
      if (categories.length > 0 && !categoryId) setCategoryId(String(categories[0].id));
    }
  }, [preset, vaults, parties, categories, sourceVaultId, partyId, categoryId]);

  const createTxMutation = useMutation({
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
    onSuccess: (createdTx, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      closeTransactionDialog();
      showUndoSnackbar(`Transaction "${vars.title}" saved!`, createdTx.id);
      // Reset form
      setTitle("");
      setGrossAmount("");
      setTaxFeeAmount("");
      setNotes("");
      setIsBackdated(false);
    },
    onError: (err) => {
      alert(`Error creating transaction: ${err.message}`);
    },
  });

  const handleSubmit = () => {
    const selectedCategory = categories.find((c) => c.id === parseInt(categoryId, 10));

    createTxMutation.mutate({
      title,
      nature,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      commitmentType: selectedCategory?.commitmentType || "NONE",
      priorityTier: selectedCategory?.priorityTier || "NONE",
      partyId: parseInt(partyId, 10),
      sourceVaultId: parseInt(sourceVaultId, 10),
      targetVaultId: targetVaultId ? parseInt(targetVaultId, 10) : null,
      grossAmount: Number(grossAmount) || 0,
      taxFeeAmount: Number(taxFeeAmount) || 0,
      isBackdated,
      notes,
    });
  };

  return (
    <Dialog open={transactionDialog.open} onClose={closeTransactionDialog} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Record Custom Transaction</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Transaction Title / Description"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
            required
          />

          <TextField
            select
            label="Transaction Nature"
            value={nature}
            onChange={(e) => setNature(e.target.value)}
            fullWidth
            size="small"
          >
            <MenuItem value="EXPENSE">Expense (Pengeluaran Konsumsi)</MenuItem>
            <MenuItem value="INCOME">Income (Pemasukan Bersih)</MenuItem>
            <MenuItem value="TRANSFER">Transfer (Pindah Saldo Antar Bank/Cash/Koin)</MenuItem>
            <MenuItem value="RECEIVABLE_LEND">Lend / Talangi Teman (Piutang)</MenuItem>
            <MenuItem value="RECEIVABLE_COLLECT">Collect / Teman Bayar Utang (Terima Piutang)</MenuItem>
          </TextField>

          <TextField
            label="Gross Amount (Rp)"
            type="number"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
            fullWidth
            size="small"
            required
          />

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={nature === "TRANSFER" ? "From Vault (Sumber)" : "Vault (Penyimpanan)"}
              value={sourceVaultId}
              onChange={(e) => setSourceVaultId(e.target.value)}
              fullWidth
              size="small"
            >
              {vaults.map((v) => (
                <MenuItem key={v.id} value={String(v.id)}>
                  {v.name}
                </MenuItem>
              ))}
            </TextField>

            {nature === "TRANSFER" && (
              <TextField
                select
                label="To Vault (Tujuan)"
                value={targetVaultId}
                onChange={(e) => setTargetVaultId(e.target.value)}
                fullWidth
                size="small"
                required
              >
                {vaults.map((v) => (
                  <MenuItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          {nature !== "TRANSFER" && (
            <TextField
              select
              label="Functional Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              fullWidth
              size="small"
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name} ({c.commitmentType})
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            select
            label="Party / Role (Counterparty)"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            fullWidth
            size="small"
          >
            {parties.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name} ({p.partyType})
              </MenuItem>
            ))}
          </TextField>

          {nature === "EXPENSE" && (
            <TextField
              label="Optional Tax / Admin Fee (+ Rp)"
              type="number"
              value={taxFeeAmount}
              onChange={(e) => setTaxFeeAmount(e.target.value)}
              fullWidth
              size="small"
              helperText="Will auto-split into a separate Admin Fee line in the general ledger."
            />
          )}

          <TextField
            label="Notes / Keterangan"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
          />

          {/* Backdated transaction absorption check (Prompt requirement) */}
          <Box sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: 2, border: "1px solid #E2E8F0" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isBackdated}
                  onChange={(e) => setIsBackdated(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Retroactive / Baru Ingat Transaksi Masa Lalu
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Otomatis menyerap ke Dana Awal / Uang Hilang agar saldo akhir dompet saat ini tetap 100% sinkron.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={closeTransactionDialog} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={createTxMutation.isPending || !title || !grossAmount}
        >
          {createTxMutation.isPending ? "Saving..." : "Save Transaction"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

