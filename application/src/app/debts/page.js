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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Popover,
  InputAdornment,
} from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import AddIcon from "@mui/icons-material/Add";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import MoneyValue from "@/components/MoneyValue";
import CurrencyTextField from "@/components/CurrencyTextField";

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const {
    openTransactionDialog,
    openAddPartyDialog,
    enqueueToast,
  } = useLedgerStore();

  const [infoAnchor, setInfoAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [writeOffModal, setWriteOffModal] = useState({
    open: false,
    debtEntry: null,
    partyName: "",
    maxAmount: 0,
    amount: "",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await fetch("/api/debts");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/debt/write-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (createdTx) => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setWriteOffModal({ open: false, debtEntry: null, partyName: "", maxAmount: 0, amount: "", notes: "" });
      enqueueToast("Receivable written off (Ikhlaskan)", {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
    },
    onError: (err) => {
      enqueueToast(`Write-off failed: ${err.message}`, { severity: "error" });
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
        <Alert severity="error">Failed to load Debt Ledger: {error?.message || "Unknown error"}</Alert>
      </Container>
    );
  }

  const summary = data.summary || {};
  const externalParties = (data.parties || []).filter(
    (p) => p.code !== "SELF" && p.partyType !== "SELF"
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredParties = externalParties.filter((p) => {
    if (!normalizedQuery) return true;
    const matchName = p.name?.toLowerCase().includes(normalizedQuery);
    const matchType = p.partyType?.toLowerCase().includes(normalizedQuery);
    const matchAliases = p.aliasesJson?.toLowerCase().includes(normalizedQuery);
    const matchAccounts = (p.externalAccounts || []).some((acc) =>
      acc.toLowerCase().includes(normalizedQuery)
    );
    return matchName || matchType || matchAliases || matchAccounts;
  });

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {/* Header Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.25, mb: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PeopleAltOutlinedIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", fontSize: { xs: "1.18rem", sm: "1.5rem" } }}>
            Debt &amp; PayLater Sub-Ledger
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PersonAddAlt1OutlinedIcon />}
            onClick={() => openAddPartyDialog(null, { isDebtContact: true })}
            sx={{ fontWeight: 700 }}
          >
            + Add Contact
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openTransactionDialog({ nature: "PAYABLE_BORROW" })}
            sx={{ fontWeight: 700 }}
          >
            Record Debt / Talangan
          </Button>
        </Stack>
      </Box>

      {/* Info Popover (Rule 11) */}
      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 320 }}>
          • <strong>Separate Totals:</strong> Receivables (Piutang) and Payables (Utang) stay cleanly separated without auto-netting.<br />
          • <strong>Two-Way Offset Merge:</strong> Click Details &amp; Merge on any party with both sides open to manually offset specific items.<br />
          • <strong>FIFO &amp; Partial Ikhlaskan:</strong> Settle whole balances or forgive partial amounts anytime.
        </Typography>
      </Popover>

      {/* 3 Compact Summary KPI Cards (#11 horizontal strip on mobile & desktop) */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
        <Grid size={4}>
          <Card sx={{ borderLeft: "3px solid #2563EB", height: "100%" }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ fontWeight: 800, display: "block", fontSize: { xs: "0.6rem", sm: "0.75rem" } }}
              >
                PIUTANG
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: "#2563EB",
                  mt: 0.25,
                  fontSize: { xs: "0.86rem", sm: "1.35rem" },
                }}
              >
                <MoneyValue value={summary.totalReceivables} allowTapToggle />
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                Money owed to you by friends/peers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={4}>
          <Card sx={{ borderLeft: "3px solid #DC2626", height: "100%" }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ fontWeight: 800, display: "block", fontSize: { xs: "0.6rem", sm: "0.75rem" } }}
              >
                UTANG
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: "#DC2626",
                  mt: 0.25,
                  fontSize: { xs: "0.86rem", sm: "1.35rem" },
                }}
              >
                <MoneyValue value={summary.totalPayables} allowTapToggle />
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                What you owe to contacts &amp; lenders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={4}>
          <Card sx={{ borderLeft: "3px solid #7C3AED", height: "100%" }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ fontWeight: 800, display: "block", fontSize: { xs: "0.6rem", sm: "0.75rem" } }}
              >
                HELD POOL
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: "#7C3AED",
                  mt: 0.25,
                  fontSize: { xs: "0.86rem", sm: "1.35rem" },
                }}
              >
                <MoneyValue value={summary.totalHeldFunds} allowTapToggle />
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                Designated held balances
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Contact Search Box (#12) */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search debt contact by name, alias, relationship, or bank note..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ bgcolor: "#FFFFFF", maxWidth: { sm: 520 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* Party Cards Grid */}
      {filteredParties.length === 0 ? (
        <Alert severity="info">
          {searchQuery
            ? `No debt contacts matching "${searchQuery}".`
            : "No debt or loan contacts yet. Click Record Debt / Talangan or + Add Contact to start."}
        </Alert>
      ) : (
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {filteredParties.map((party) => {
          const recBal = Number(party.receivableBalance) || 0;
          const payBal = Number(party.payableBalance) || 0;
          const canOffset = recBal > 0 && payBal > 0;
          const maxOffset = Math.min(recBal, payBal);

          const openReceivables = (party.debtLedgerEntries || []).filter(
            (e) =>
              e.entryCategory === "RECEIVABLE" &&
              e.direction === "INCREASE" &&
              Number(e.remainingOpenAmount) > 0
          );

          const openPayables = (party.debtLedgerEntries || []).filter(
            (e) =>
              e.entryCategory === "PAYABLE" &&
              e.direction === "INCREASE" &&
              Number(e.remainingOpenAmount) > 0
          );

          return (
            <Grid size={{ xs: 12, md: 6 }} key={party.id}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ p: 2.25, flexGrow: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {/* Party Title & Detail Link */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {party.name}
                        </Typography>
                        <Chip label={party.partyType} size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                      </Stack>
                      {party.externalAccounts && party.externalAccounts.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {party.externalAccounts.map((acc, i) => (
                            <Chip
                              key={i}
                              label={acc}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#F8FAFC" }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>

                    <Button
                      component={Link}
                      href={`/debts/${party.id}`}
                      size="small"
                      endIcon={<ArrowForwardIcon />}
                      sx={{ fontWeight: 700, flexShrink: 0 }}
                    >
                      Details
                    </Button>
                  </Box>

                  {/* Separate Receivable vs Payable Balances (#22-2) */}
                  <Grid container spacing={1.5}>
                    <Grid size={6}>
                      <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#1E40AF", display: "block" }}>
                          PIUTANG (Owes You)
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#2563EB" }}>
                          <MoneyValue value={recBal} allowTapToggle />
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={6}>
                      <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#FEF2F2", border: "1px solid #FECACA" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#991B1B", display: "block" }}>
                          UTANG (You Owe)
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#DC2626" }}>
                          <MoneyValue value={payBal} allowTapToggle />
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Offset Banner when both directions exist */}
                  {canOffset && (
                    <Alert
                      severity="warning"
                      icon={<CompareArrowsIcon fontSize="small" />}
                      action={
                        <Button
                          component={Link}
                          href={`/debts/${party.id}`}
                          color="inherit"
                          size="small"
                          sx={{ fontWeight: 800 }}
                        >
                          Merge
                        </Button>
                      }
                      sx={{ py: 0.25 }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        Offset available up to <MoneyValue value={maxOffset} />
                      </Typography>
                    </Alert>
                  )}

                  {/* Quick Open Entries Preview */}
                  {(openReceivables.length > 0 || openPayables.length > 0) && (
                    <Box sx={{ bgcolor: "#F8FAFC", p: 1.25, borderRadius: 1.5, border: "1px solid #E2E8F0" }}>
                      <Stack spacing={0.75}>
                        {openReceivables.slice(0, 2).map((entry) => (
                          <Box key={entry.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" noWrap sx={{ fontWeight: 600, color: "#1E3A8A" }}>
                              [Piutang] {entry.transaction?.title || `Entry #${entry.id}`}
                            </Typography>
                            <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: "#2563EB" }}>
                                <MoneyValue value={entry.remainingOpenAmount} />
                              </Typography>
                              <IconButton
                                size="small"
                                title="Ikhlaskan / Forgive"
                                color="success"
                                onClick={() =>
                                  setWriteOffModal({
                                    open: true,
                                    debtEntry: entry,
                                    partyName: party.name,
                                    maxAmount: Number(entry.remainingOpenAmount),
                                    amount: Number(entry.remainingOpenAmount),
                                    notes: "",
                                  })
                                }
                              >
                                <VolunteerActivismIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Stack>
                          </Box>
                        ))}
                        {openPayables.slice(0, 2).map((entry) => (
                          <Box key={entry.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" noWrap sx={{ fontWeight: 600, color: "#991B1B" }}>
                              [Utang] {entry.transaction?.title || `Entry #${entry.id}`}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#DC2626", flexShrink: 0 }}>
                              <MoneyValue value={entry.remainingOpenAmount} />
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  <Divider />

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: "auto" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openTransactionDialog({ nature: "RECEIVABLE_LEND", partyId: party.id })}
                      sx={{ fontSize: "0.72rem", fontWeight: 700 }}
                    >
                      + Talangi
                    </Button>
                    {recBal > 0 && (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => openTransactionDialog({ nature: "RECEIVABLE_COLLECT", partyId: party.id })}
                        sx={{ fontSize: "0.72rem", fontWeight: 700 }}
                      >
                        Receive
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => openTransactionDialog({ nature: "PAYABLE_BORROW", partyId: party.id })}
                      sx={{ fontSize: "0.72rem", fontWeight: 700 }}
                    >
                      + I Borrow
                    </Button>
                    {payBal > 0 && (
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        onClick={() => openTransactionDialog({ nature: "PAYABLE_REPAY", partyId: party.id })}
                        sx={{ fontSize: "0.72rem", fontWeight: 700 }}
                      >
                        Pay Debt
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      )}

      {/* Partial or Full Forgive / Write-Off Dialog (#21) */}
      <Dialog
        open={writeOffModal.open}
        onClose={() => setWriteOffModal({ open: false, debtEntry: null, partyName: "", maxAmount: 0, amount: "", notes: "" })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Ikhlaskan / Partial Write-Off</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2">
              Forgive debt from <strong>{writeOffModal.partyName}</strong> (Remaining:{" "}
              <strong><MoneyValue value={writeOffModal.maxAmount} /></strong>).
            </Typography>
            <CurrencyTextField
              label="Amount to Ikhlaskan (Full or Partial)"
              value={writeOffModal.amount}
              onValueChange={(num) => setWriteOffModal((prev) => ({ ...prev, amount: num }))}
              required
              helperText="Reduces receivable without moving vaults and logs under Social & Charity."
            />
            <TextField
              label="Notes (Optional)"
              size="small"
              fullWidth
              value={writeOffModal.notes}
              onChange={(e) => setWriteOffModal((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setWriteOffModal({ open: false, debtEntry: null, partyName: "", maxAmount: 0, amount: "", notes: "" })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<VolunteerActivismIcon />}
            disabled={writeOffMutation.isPending || !writeOffModal.amount || Number(writeOffModal.amount) <= 0}
            onClick={() =>
              writeOffMutation.mutate({
                debtEntryId: writeOffModal.debtEntry?.id,
                amount: Number(writeOffModal.amount),
                notes: writeOffModal.notes.trim() || null,
              })
            }
          >
            {writeOffMutation.isPending ? "Forgiving..." : "Confirm Ikhlaskan"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
