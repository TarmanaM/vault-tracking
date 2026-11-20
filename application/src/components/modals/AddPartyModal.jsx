"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  IconButton,
  Popover,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

const PARTY_TYPES = [
  { value: "FRIEND", label: "Friend / Peer" },
  { value: "FAMILY", label: "Family Member" },
  { value: "EMPLOYER", label: "Employer / Office" },
  { value: "INSTITUTION", label: "Bank / E-Wallet / Merchant" },
  { value: "LENDER", label: "Credit / PayLater Lender" },
];

export default function AddPartyModal() {
  const { addPartyDialog, closeAddPartyDialog, enqueueToast } = useLedgerStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [partyType, setPartyType] = useState("FRIEND");
  const [alias, setAlias] = useState("");
  const [externalAccount, setExternalAccount] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const resetForm = () => {
    setName("");
    setPartyType("FRIEND");
    setAlias("");
    setExternalAccount("");
    setErrorMsg("");
  };

  const handleClose = () => {
    resetForm();
    closeAddPartyDialog();
  };

  const createPartyMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to add contact");
      return data.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      enqueueToast(`Added contact "${created.name}"`, { severity: "success" });
      if (typeof addPartyDialog.onCreated === "function") {
        addPartyDialog.onCreated(created);
      }
      handleClose();
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!name.trim()) {
      setErrorMsg("Contact name is required.");
      return;
    }
    createPartyMutation.mutate({
      name: name.trim(),
      partyType,
      alias: alias.trim(),
      externalAccount: externalAccount.trim(),
      isDebtContact: Boolean(addPartyDialog.isDebtContact),
    });
  };

  return (
    <Dialog open={addPartyDialog.open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonAddAlt1OutlinedIcon color="primary" />
            <span>Add New Contact / Party</span>
          </Stack>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 260 }}>
            Add people, coworkers, family, or lenders so you can record lending (Receivables), borrowing (Payables), and counterparty transfer bank notes.
          </Typography>
        </Popover>

        <DialogContent dividers>
          <Stack spacing={2}>
            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

            <TextField
              label="Contact Name"
              placeholder='e.g. "Budi Kantor", "Ibu", "SPayLater"'
              size="small"
              fullWidth
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <TextField
              select
              label="Contact Type"
              size="small"
              fullWidth
              value={partyType}
              onChange={(e) => setPartyType(e.target.value)}
            >
              {PARTY_TYPES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Nickname / Alias (Optional)"
              placeholder='e.g. "Dada", "Mas Budi"'
              size="small"
              fullWidth
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />

            <TextField
              label="Their External Bank / E-Wallet Note (Optional)"
              placeholder='e.g. "BCA - Budi", "OVO 0812..."'
              size="small"
              fullWidth
              value={externalAccount}
              onChange={(e) => setExternalAccount(e.target.value)}
              helperText="Saved for quick selection when sending or receiving debt payments."
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={createPartyMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={createPartyMutation.isPending}>
            {createPartyMutation.isPending ? "Saving..." : "Save Contact"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

