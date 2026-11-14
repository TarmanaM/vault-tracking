"use client";

import React, { useState, useMemo } from "react";
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
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Popover,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import MoneyValue from "@/components/MoneyValue";
import CurrencyTextField from "@/components/CurrencyTextField";

export default function PartyDebtDetailPage() {
  const params = useParams();
  const partyId = params?.id;
  const queryClient = useQueryClient();

  const {
    openTransactionDialog,
    openConfirmDialog,
    enqueueToast,
  } = useLedgerStore();

  const [selectedRecIds, setSelectedRecIds] = useState([]);
  const [selectedPayIds, setSelectedPayIds] = useState([]);
  const [offsetAmount, setOffsetAmount] = useState("");
  const [offsetNotes, setOffsetNotes] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const [writeOffModal, setWriteOffModal] = useState({
    open: false,
    debtEntryId: null,
    title: "",
    maxAmount: 0,
    amount: "",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["debt-detail", String(partyId)],
    queryFn: async () => {
      const res = await fetch(`/api/debts/${partyId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: Boolean(partyId),
  });

  const offsetMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/debt/offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (createdTx) => {
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setSelectedRecIds([]);
      setSelectedPayIds([]);
      setOffsetAmount("");
      setOffsetNotes("");
      enqueueToast("Merged receivable & payable balances", {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
    },
    onError: (err) => {
      enqueueToast(`Offset failed: ${err.message}`, { severity: "error" });
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
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setWriteOffModal({ open: false, debtEntryId: null, title: "", maxAmount: 0, amount: "", notes: "" });
      enqueueToast("Receivable written off (Ikhlaskan)", {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
    },
    onError: (err) => {
      enqueueToast(`Write-off failed: ${err.message}`, { severity: "error" });
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["debt-detail", String(partyId)] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      enqueueToast(`Reversed "${deleted.title}"`, { severity: "info" });
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const party = data?.party;
  const openReceivables = useMemo(() => data?.openReceivables || [], [data?.openReceivables]);
  const openPayables = useMemo(() => data?.openPayables || [], [data?.openPayables]);
  const transactions = data?.transactions || [];

  const effectiveRecPool = useMemo(() => {
    const items =
      selectedRecIds.length > 0
        ? openReceivables.filter((r) => selectedRecIds.includes(r.id))
        : openReceivables;
    return items.reduce((sum, item) => sum + Number(item.remainingOpenAmount || 0), 0);
  }, [openReceivables, selectedRecIds]);

  const effectivePayPool = useMemo(() => {
    const items =
      selectedPayIds.length > 0
        ? openPayables.filter((p) => selectedPayIds.includes(p.id))
        : openPayables;
    return items.reduce((sum, item) => sum + Number(item.remainingOpenAmount || 0), 0);
  }, [openPayables, selectedPayIds]);

  const maxOffsetPossible = Math.min(effectiveRecPool, effectivePayPool);

  const toggleId = (setter, id) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !party) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button component={Link} href="/debts" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to Debt Ledger
        </Button>
        <Alert severity="error">Failed to load party details: {error?.message || "Contact not found"}</Alert>
      </Container>
    );
  }

  const recTotal = Number(party.receivableBalance) || 0;
  const payTotal = Number(party.payableBalance) || 0;
  const canMerge = openReceivables.length > 0 && openPayables.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 } }}>
      <Button component={Link} href="/debts" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1.5, fontWeight: 700 }}>
        Back to Debt &amp; PayLater
      </Button>

      {/* Party Summary Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {party.name}
                </Typography>
                <Chip label={party.partyType} size="small" />
              </Stack>
              {party.externalAccounts && party.externalAccounts.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {party.externalAccounts.map((acc, idx) => (
                    <Chip
                      key={idx}
                      icon={<AccountBalanceOutlinedIcon sx={{ fontSize: "0.8rem !important" }} />}
                      label={acc}
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: "0.72rem", bgcolor: "#F8FAFC" }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                onClick={() => openTransactionDialog({ nature: "RECEIVABLE_LEND", partyId: party.id })}
                sx={{ fontWeight: 700 }}
              >
                + Talangi Teman
              </Button>
              {recTotal > 0 && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={() => openTransactionDialog({ nature: "RECEIVABLE_COLLECT", partyId: party.id })}
                    sx={{ fontWeight: 700 }}
                  >
                    Receive Totalan (FIFO)
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<VolunteerActivismIcon />}
                    onClick={() =>
                      setWriteOffModal({
                        open: true,
                        debtEntryId: null,
                        title: `All open receivables from ${party.name} (FIFO)`,
                        maxAmount: recTotal,
                        amount: recTotal,
                        notes: "",
                      })
                    }
                    sx={{ fontWeight: 700 }}
                  >
                    Ikhlaskan Sebagian
                  </Button>
                </>
              )}
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => openTransactionDialog({ nature: "PAYABLE_BORROW", partyId: party.id })}
                sx={{ fontWeight: 700 }}
              >
                + Catat Utang
              </Button>
              {payTotal > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => openTransactionDialog({ nature: "PAYABLE_REPAY", partyId: party.id })}
                  sx={{ fontWeight: 700 }}
                >
                  Bayar Totalan (FIFO)
                </Button>
              )}
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#1E40AF", display: "block" }}>
                  PIUTANG (RECEIVABLE — THEY OWE YOU)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#2563EB" }}>
                  <MoneyValue value={recTotal} includeCents allowTapToggle />
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#FEF2F2", border: "1px solid #FECACA" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#991B1B", display: "block" }}>
                  UTANG (PAYABLE — YOU OWE THEM)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#DC2626" }}>
                  <MoneyValue value={payTotal} includeCents allowTapToggle />
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Manual Two-Way Merge / Offset Panel (#22-2) */}
      {canMerge && (
        <Card sx={{ mb: 3, border: "2px solid #F59E0B", bgcolor: "#FFFBEB" }}>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CompareArrowsIcon sx={{ color: "#D97706" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#92400E" }}>
                  Manual Merge / Offset (Potong Utang vs Piutang)
                </Typography>
              </Stack>
              <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Box>

            <Popover
              open={Boolean(infoAnchor)}
              anchorEl={infoAnchor}
              onClose={() => setInfoAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
              <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 300 }}>
                Check specific items on both sides or leave unchecked for oldest-first FIFO merge. Executing an offset reduces both Receivable and Payable by the same amount without mutating Cash or Bank vaults.
              </Typography>
            </Popover>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ p: 1.5, bgcolor: "#FFFFFF" }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "#1E40AF", display: "block", mb: 1 }}>
                    1. SELECT RECEIVABLES TO OFFSET (Pool: <MoneyValue value={effectiveRecPool} />)
                  </Typography>
                  <Stack spacing={0.5}>
                    {openReceivables.map((item) => (
                      <Box
                        key={item.id}
                        onClick={() => toggleId(setSelectedRecIds, item.id)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: 0.75,
                          borderRadius: 1,
                          cursor: "pointer",
                          bgcolor: selectedRecIds.includes(item.id) ? "#EFF6FF" : "transparent",
                          "&:hover": { bgcolor: "#F8FAFC" },
                        }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center" minWidth={0}>
                          <Checkbox size="small" checked={selectedRecIds.includes(item.id)} sx={{ p: 0.25 }} />
                          <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
                            {item.transaction?.title || `Entry #${item.id}`}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "#2563EB", flexShrink: 0 }}>
                          <MoneyValue value={item.remainingOpenAmount} />
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ p: 1.5, bgcolor: "#FFFFFF" }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "#991B1B", display: "block", mb: 1 }}>
                    2. SELECT PAYABLES TO OFFSET (Pool: <MoneyValue value={effectivePayPool} />)
                  </Typography>
                  <Stack spacing={0.5}>
                    {openPayables.map((item) => (
                      <Box
                        key={item.id}
                        onClick={() => toggleId(setSelectedPayIds, item.id)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: 0.75,
                          borderRadius: 1,
                          cursor: "pointer",
                          bgcolor: selectedPayIds.includes(item.id) ? "#FEF2F2" : "transparent",
                          "&:hover": { bgcolor: "#F8FAFC" },
                        }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center" minWidth={0}>
                          <Checkbox size="small" checked={selectedPayIds.includes(item.id)} sx={{ p: 0.25 }} />
                          <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
                            {item.transaction?.title || `Entry #${item.id}`}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "#DC2626", flexShrink: 0 }}>
                          <MoneyValue value={item.remainingOpenAmount} />
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <Box sx={{ minWidth: { sm: 220 } }}>
                <CurrencyTextField
                  label="Offset Amount"
                  placeholder={String(maxOffsetPossible)}
                  value={offsetAmount}
                  onValueChange={(num) => setOffsetAmount(num)}
                  showClear
                />
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setOffsetAmount(maxOffsetPossible)}
                sx={{ fontWeight: 700, flexShrink: 0 }}
              >
                Use Max (<MoneyValue value={maxOffsetPossible} />)
              </Button>
              <TextField
                label="Offset Note (Optional)"
                size="small"
                fullWidth
                value={offsetNotes}
                onChange={(e) => setOffsetNotes(e.target.value)}
                sx={{ bgcolor: "#FFFFFF" }}
              />
              <Button
                variant="contained"
                color="warning"
                startIcon={<CompareArrowsIcon />}
                disabled={offsetMutation.isPending || maxOffsetPossible <= 0}
                onClick={() => {
                  const chosen =
                    offsetAmount !== "" && Number(offsetAmount) > 0
                      ? Number(offsetAmount)
                      : maxOffsetPossible;
                  offsetMutation.mutate({
                    partyId: party.id,
                    receivableIds: selectedRecIds,
                    payableIds: selectedPayIds,
                    offsetAmount: chosen,
                    notes: offsetNotes.trim() || null,
                  });
                }}
                sx={{ fontWeight: 800, flexShrink: 0 }}
              >
                {offsetMutation.isPending ? "Merging..." : "Execute Merge"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Open Receivables & Open Payables Detailed Lists */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E40AF", mb: 1.5 }}>
                Open Receivables ({openReceivables.length})
              </Typography>
              {openReceivables.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No open receivables from {party.name}.
                </Typography>
              ) : (
                <Stack spacing={1.25} divider={<Divider />}>
                  {openReceivables.map((item) => (
                    <Box key={item.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                        <Box minWidth={0}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {item.transaction?.title || `Entry #${item.id}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.transaction?.transactionDate?.split("T")[0]} • Original:{" "}
                            <MoneyValue value={item.amount} />
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "#2563EB" }}>
                            <MoneyValue value={item.remainingOpenAmount} />
                          </Typography>
                          <Chip label={item.status} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
                        </Box>
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            openTransactionDialog({
                              nature: "RECEIVABLE_COLLECT",
                              partyId: party.id,
                              referenceDebtId: item.id,
                              grossAmount: Number(item.remainingOpenAmount),
                            })
                          }
                          sx={{ fontSize: "0.7rem", py: 0.25 }}
                        >
                          Receive Item
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={<VolunteerActivismIcon sx={{ fontSize: "0.85rem !important" }} />}
                          onClick={() =>
                            setWriteOffModal({
                              open: true,
                              debtEntryId: item.id,
                              title: item.transaction?.title || `Entry #${item.id}`,
                              maxAmount: Number(item.remainingOpenAmount),
                              amount: Number(item.remainingOpenAmount),
                              notes: "",
                            })
                          }
                          sx={{ fontSize: "0.7rem", py: 0.25 }}
                        >
                          Ikhlaskan
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#991B1B", mb: 1.5 }}>
                Open Payables ({openPayables.length})
              </Typography>
              {openPayables.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No open payables owed to {party.name}.
                </Typography>
              ) : (
                <Stack spacing={1.25} divider={<Divider />}>
                  {openPayables.map((item) => (
                    <Box key={item.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                        <Box minWidth={0}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {item.transaction?.title || `Entry #${item.id}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.transaction?.transactionDate?.split("T")[0]} • Original:{" "}
                            <MoneyValue value={item.amount} />
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "#DC2626" }}>
                            <MoneyValue value={item.remainingOpenAmount} />
                          </Typography>
                          <Chip label={item.status} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
                        </Box>
                      </Box>

                      <Box sx={{ mt: 0.75 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() =>
                            openTransactionDialog({
                              nature: "PAYABLE_REPAY",
                              partyId: party.id,
                              referenceDebtId: item.id,
                              grossAmount: Number(item.remainingOpenAmount),
                            })
                          }
                          sx={{ fontSize: "0.7rem", py: 0.25 }}
                        >
                          Pay This Item
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Party Ledger History */}
      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Party Transaction &amp; Settlement History ({transactions.length})
          </Typography>
        </CardContent>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Title &amp; Note</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nature</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vaults</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 4, color: "#64748B" }}>
                    No transactions recorded for this contact yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {t.transactionDate?.split("T")[0]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.transactionTime}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {t.title}
                      </Typography>
                      {t.counterpartyAccountNote && (
                        <Chip
                          icon={<AccountBalanceOutlinedIcon sx={{ fontSize: "0.7rem !important" }} />}
                          label={t.counterpartyAccountNote}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5, height: 18, fontSize: "0.65rem" }}
                        />
                      )}
                      {t.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {t.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={t.nature} size="small" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      {t.legs && t.legs.length > 0 ? (
                        t.legs.map((leg) => (
                          <Typography key={leg.id} variant="caption" sx={{ display: "block" }}>
                            {leg.vault?.name}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Non-vault
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      <MoneyValue value={t.grossAmount} allowTapToggle />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          openConfirmDialog({
                            title: "Reverse Transaction?",
                            message: `Reverse "${t.title}"? Affected balances and open debt items will be restored atomically.`,
                            confirmLabel: "Reverse",
                            confirmColor: "error",
                            onConfirm: () => deleteTxMutation.mutateAsync(t.id),
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Partial or Full Write-Off Dialog (#21) */}
      <Dialog
        open={writeOffModal.open}
        onClose={() => setWriteOffModal({ open: false, debtEntryId: null, title: "", maxAmount: 0, amount: "", notes: "" })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Ikhlaskan / Partial Write-Off</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2">
              Target: <strong>{writeOffModal.title}</strong>
              <br />
              Maximum Open: <strong><MoneyValue value={writeOffModal.maxAmount} /></strong>
            </Typography>
            <CurrencyTextField
              label="Amount to Ikhlaskan"
              value={writeOffModal.amount}
              onValueChange={(num) => setWriteOffModal((prev) => ({ ...prev, amount: num }))}
              required
              helperText="Partial amounts automatically update remaining balance; excess does not touch vaults."
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
            onClick={() => setWriteOffModal({ open: false, debtEntryId: null, title: "", maxAmount: 0, amount: "", notes: "" })}
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
                debtEntryId: writeOffModal.debtEntryId,
                partyId: writeOffModal.debtEntryId ? null : party.id,
                amount: Number(writeOffModal.amount),
                notes: writeOffModal.notes.trim() || null,
              })
            }
          >
            {writeOffMutation.isPending ? "Processing..." : "Confirm Ikhlaskan"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
