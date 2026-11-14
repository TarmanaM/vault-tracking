"use client";

import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  Card,
  Stack,
  TextField,
  MenuItem,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  CircularProgress,
  Alert,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import AddIcon from "@mui/icons-material/Add";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toDecimal } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";
import MoneyValue from "@/components/MoneyValue";
import { isTransactionPromotable } from "@/lib/cardPromotionUtils";

const PRESET_RANGES = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "ALL", label: "ALL" },
  { value: "CUSTOM", label: "Custom" },
];

const NATURE_FILTERS = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "RECEIVABLE_LEND",
  "RECEIVABLE_COLLECT",
  "PAYABLE_BORROW",
  "PAYABLE_REPAY",
  "DEBT_OFFSET",
  "INITIAL_FUND",
  "RECONCILIATION_LOST",
  "RECONCILIATION_GAIN",
];

export default function LedgerPage() {
  const queryClient = useQueryClient();
  const {
    openExportDialog,
    openTransactionDialog,
    openConfirmDialog,
    openPromoteCardDialog,
    enqueueToast,
  } = useLedgerStore();

  const [preset, setPreset] = useState("3M");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [nature, setNature] = useState("");
  const [search, setSearch] = useState("");

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: txData, isLoading, error } = useQuery({
    queryKey: ["transactions", preset, startDate, endDate, vaultId, nature, search],
    queryFn: async () => {
      const params = new URLSearchParams({ preset, limit: "150" });
      if (preset === "CUSTOM") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      if (vaultId) params.set("vaultId", vaultId);
      if (nature) params.set("nature", nature);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
      enqueueToast(`Reversed transaction "${deleted.title}"`, { severity: "info" });
    },
    onError: (err) => {
      enqueueToast(`Failed to reverse transaction: ${err.message}`, { severity: "error" });
    },
  });

  const vaults = dashboardData?.vaults || [];
  const transactions = txData?.transactions || [];
  const appliedRange = txData?.appliedRange || {};

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
            Ledger History
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Showing {transactions.length} of {txData?.total || 0} transactions
            {appliedRange.startDate ? ` (${appliedRange.startDate} to ${appliedRange.endDate})` : " (All Time)"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={openExportDialog}
            sx={{ fontWeight: 700 }}
          >
            Export Journal
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openTransactionDialog(null)}
            sx={{ fontWeight: 700 }}
          >
            + Transaction
          </Button>
        </Stack>
      </Box>

      {/* Filters Card (#xx Date Range + Search + Vault + Nature) */}
      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack spacing={1.75}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            {PRESET_RANGES.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                size="small"
                clickable
                color={preset === opt.value ? "primary" : "default"}
                variant={preset === opt.value ? "filled" : "outlined"}
                onClick={() => setPreset(opt.value)}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>

          {preset === "CUSTOM" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Start Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <TextField
                label="End Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Stack>
          )}

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              placeholder="Search title, notes, bank ref..."
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              select
              label="Filter Vault"
              size="small"
              sx={{ minWidth: { md: 180 } }}
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
            >
              <MenuItem value="">All Vaults</MenuItem>
              {vaults.map((v) => (
                <MenuItem key={v.id} value={String(v.id)}>
                  {v.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Filter Nature"
              size="small"
              sx={{ minWidth: { md: 200 } }}
              value={nature}
              onChange={(e) => setNature(e.target.value)}
            >
              <MenuItem value="">All Natures</MenuItem>
              {NATURE_FILTERS.map((nat) => (
                <MenuItem key={nat} value={nat}>
                  {nat}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load ledger: {error.message}
        </Alert>
      )}

      {/* Ledger Table */}
      <Card>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Title &amp; Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Party</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nature</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vaults Affected</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Gross Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Consume</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: "center", py: 6, color: "#64748B" }}>
                    No transactions match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => {
                  const isOutflowNature =
                    t.nature === "EXPENSE" ||
                    t.nature === "RECEIVABLE_LEND" ||
                    t.nature === "PAYABLE_REPAY";
                  const isInflowNature =
                    t.nature === "INCOME" ||
                    t.nature === "RECEIVABLE_COLLECT" ||
                    t.nature === "PAYABLE_BORROW";

                  return (
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
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {t.title}
                          </Typography>
                          {t.isBackdated && (
                            <Chip
                              label="Retroactive"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                            />
                          )}
                          {t.subVaultWarning && (
                            <Chip
                              label="Sub-Vault Drift"
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                            />
                          )}
                          {t.actionCardId != null && t.actionCard && (
                            <Chip
                              icon={<FlashOnIcon sx={{ fontSize: "0.72rem !important" }} />}
                              label={`Card: ${t.actionCard.title}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700 }}
                            />
                          )}
                        </Stack>

                        {t.category && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {t.category.name} ({t.commitmentType})
                          </Typography>
                        )}

                        {t.counterpartyAccountNote && (
                          <Chip
                            icon={<AccountBalanceOutlinedIcon sx={{ fontSize: "0.72rem !important" }} />}
                            label={t.counterpartyAccountNote}
                            size="small"
                            variant="outlined"
                            sx={{ mt: 0.5, height: 20, fontSize: "0.66rem", bgcolor: "#F8FAFC" }}
                          />
                        )}
                      </TableCell>

                      <TableCell>
                        <Chip label={t.party?.name || "Self"} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={t.nature}
                          size="small"
                          sx={{
                            fontSize: "0.65rem",
                            height: 20,
                            bgcolor: isOutflowNature ? "#FEE2E2" : isInflowNature ? "#DCFCE7" : "#F1F5F9",
                            color: isOutflowNature ? "#DC2626" : isInflowNature ? "#16A34A" : "#475569",
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>

                      <TableCell>
                        <Stack spacing={0.5}>
                          {t.legs && t.legs.length > 0 ? (
                            t.legs.map((leg) => {
                              const baseCcy = dashboardData?.appSettings?.baseCurrency || "IDR";
                              const legCcy = leg.currency || baseCcy;
                              const isForeignLeg = legCcy !== baseCcy;
                              const legDisplayVal = isForeignLeg
                                ? leg.originalMutation ?? leg.netMutation
                                : leg.netMutation;
                              return (
                                <Typography key={leg.id} variant="caption" sx={{ display: "block", whiteSpace: "nowrap" }}>
                                  <strong>
                                    {leg.vault?.name}
                                    {leg.subContainer ? ` / ${leg.subContainer.name}` : ""}:
                                  </strong>{" "}
                                  {toDecimal(legDisplayVal).greaterThan(0) ? "+" : ""}
                                  <MoneyValue value={legDisplayVal} currency={legCcy} includeCents />
                                </Typography>
                              );
                            })
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Non-vault (Debt/Offset)
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                        <MoneyValue
                          value={t.grossAmount}
                          currency={dashboardData?.appSettings?.baseCurrency || "IDR"}
                          includeCents
                          allowTapToggle
                        />
                        {t.originalGrossAmount &&
                          t.currency &&
                          t.currency !== (dashboardData?.appSettings?.baseCurrency || "IDR") && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.68rem" }}>
                              <MoneyValue value={t.originalGrossAmount} currency={t.currency} includeCents />
                            </Typography>
                          )}
                      </TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          color: Number(t.consumeAmount) < 0 ? "#DC2626" : "#64748B",
                        }}
                      >
                        <MoneyValue value={t.consumeAmount} allowTapToggle />
                      </TableCell>

                      <TableCell align="center">
                        <Stack direction="row" spacing={0.25} justifyContent="center" alignItems="center">
                          {isTransactionPromotable(t) && (
                            <Tooltip title="Save as Action Card">
                              <IconButton
                                size="small"
                                aria-label="Save as Action Card"
                                onClick={() => openPromoteCardDialog(t)}
                                sx={{ color: "#64748B", "&:hover": { color: "#0284C7" } }}
                              >
                                <FlashOnIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <IconButton
                            size="small"
                            disabled={deleteTxMutation.isPending}
                            onClick={() =>
                              openConfirmDialog({
                                title: "Reverse & Delete Transaction?",
                                message: `Reverse transaction #${t.id} ("${t.title}")? This atomically restores affected vault balances, debt entries, and ledger snapshots.`,
                                confirmLabel: "Reverse & Delete",
                                confirmColor: "error",
                                onConfirm: () => deleteTxMutation.mutateAsync(t.id),
                              })
                            }
                            sx={{ color: "#94A3B8", "&:hover": { color: "#EF4444" } }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Container>
  );
}
