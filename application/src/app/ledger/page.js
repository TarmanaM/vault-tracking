"use client";

import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  Card,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Stack,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRupiah, toDecimal } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";
import ExportModal from "@/components/ExportModal";
import CustomTransactionModal from "@/components/CustomTransactionModal";

export default function LedgerPage() {
  const queryClient = useQueryClient();
  const openExportDialog = useLedgerStore((s) => s.openExportDialog);
  const openTransactionDialog = useLedgerStore((s) => s.openTransactionDialog);

  const [selectedVaultId, setSelectedVaultId] = useState("");
  const [selectedNature, setSelectedNature] = useState("");

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: txData, isLoading } = useQuery({
    queryKey: ["transactions", selectedVaultId, selectedNature],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedVaultId) params.append("vaultId", selectedVaultId);
      if (selectedNature) params.append("nature", selectedNature);
      params.append("limit", "100");

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const transactions = txData?.transactions || [];
  const vaults = dashData?.vaults || [];
  const parties = dashData?.parties || [];
  const categories = dashData?.categories || [];

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Title & Actions */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
            General Activity Ledger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full chronological double-entry records with automatic multi-vault legs and accounting exports.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={openExportDialog}
            sx={{ borderColor: "#CBD5E1", color: "#334155" }}
          >
            Export Journal
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openTransactionDialog(null)}
            sx={{ bgcolor: "#2563EB" }}
          >
            New Transaction
          </Button>
        </Stack>
      </Box>

      {/* Filter Row */}
      <Card sx={{ p: 2, mb: 3, bgcolor: "#F8FAFC" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            label="Filter by Vault"
            size="small"
            value={selectedVaultId}
            onChange={(e) => setSelectedVaultId(e.target.value)}
            sx={{ minWidth: 200 }}
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
            label="Filter by Nature"
            size="small"
            value={selectedNature}
            onChange={(e) => setSelectedNature(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="EXPENSE">Expense (Konsumsi)</MenuItem>
            <MenuItem value="INCOME">Income (Pemasukan)</MenuItem>
            <MenuItem value="TRANSFER">Transfer (Pindah Saldo)</MenuItem>
            <MenuItem value="RECEIVABLE_LEND">Lend (Talangan / Kasih Pinjam)</MenuItem>
            <MenuItem value="RECEIVABLE_COLLECT">Collect (Terima Bayaran Piutang)</MenuItem>
            <MenuItem value="INITIAL_FUND">Initial Fund (Dana Awal)</MenuItem>
            <MenuItem value="RECONCILIATION_LOST">Cash Shortage (Uang Hilang)</MenuItem>
            <MenuItem value="RECONCILIATION_FOUND">Surplus (Bunga Bank / Lebih)</MenuItem>
          </TextField>
        </Stack>
      </Card>

      {/* Ledger Table */}
      <Card>
        <Box sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
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
                  const isExpense = t.nature === "EXPENSE" || t.nature === "RECEIVABLE_LEND";
                  const isIncome = t.nature === "INCOME" || t.nature === "RECEIVABLE_COLLECT";

                  return (
                    <TableRow key={t.id} hover>
                      <TableCell>
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
                        {t.category && (
                          <Typography variant="caption" color="text.secondary">
                            {t.category.name} ({t.commitmentType})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={t.party.name} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t.nature}
                          size="small"
                          sx={{
                            fontSize: "0.65rem",
                            height: 20,
                            bgcolor: isExpense ? "#FEE2E2" : isIncome ? "#DCFCE7" : "#F1F5F9",
                            color: isExpense ? "#DC2626" : isIncome ? "#16A34A" : "#475569",
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {t.legs?.map((leg) => (
                            <Typography key={leg.id} variant="caption" sx={{ display: "block" }}>
                              <strong>{leg.vault?.name}:</strong>{" "}
                              {toDecimal(leg.netMutation).greaterThan(0) ? "+" : ""}
                              {formatRupiah(leg.netMutation)}
                            </Typography>
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatRupiah(t.grossAmount)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: Number(t.consumeAmount) < 0 ? "#DC2626" : "#64748B",
                        }}
                      >
                        {formatRupiah(t.consumeAmount)}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (confirm(`Reverse transaction #${t.id} (${t.title})?`)) {
                              deleteTxMutation.mutate(t.id);
                            }
                          }}
                          sx={{ color: "#94A3B8", "&:hover": { color: "#EF4444" } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <ExportModal />
      <CustomTransactionModal vaults={vaults} parties={parties} categories={categories} />
    </Container>
  );
}

