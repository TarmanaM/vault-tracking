"use client";

import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Divider,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import MoneyValue from "@/components/MoneyValue";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function RecentTransactionsList() {
  const queryClient = useQueryClient();
  const { openConfirmDialog, enqueueToast } = useLedgerStore();

  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions?limit=15");
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
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      enqueueToast(`Reversed "${deleted?.title || "transaction"}"`, { severity: "info" });
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const transactions = data?.transactions || [];

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1E293B", mb: 1.5 }}>
        Recent Activity Ledger
      </Typography>

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {isLoading ? (
            <Typography variant="body2" sx={{ p: 3, textAlign: "center", color: "#64748B" }}>
              Loading recent ledger transactions...
            </Typography>
          ) : transactions.length === 0 ? (
            <Typography variant="body2" sx={{ p: 3, textAlign: "center", color: "#64748B" }}>
              No transactions recorded yet. Tap any Action Card above to record your first transaction!
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {transactions.map((tx) => {
                const isExpense = tx.nature === "EXPENSE" || tx.nature === "RECEIVABLE_LEND";
                const isIncome = tx.nature === "INCOME" || tx.nature === "RECEIVABLE_COLLECT";
                const primaryVault = tx.legs?.[0]?.vault?.name || "Vault";

                return (
                  <Box
                    key={tx.id}
                    sx={{
                      p: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      "&:hover": { bgcolor: "#F8FAFC" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isExpense ? "#FEE2E2" : isIncome ? "#DCFCE7" : "#F1F5F9",
                          color: isExpense ? "#DC2626" : isIncome ? "#16A34A" : "#64748B",
                        }}
                      >
                        {isExpense ? (
                          <ArrowDownwardIcon fontSize="small" />
                        ) : isIncome ? (
                          <ArrowUpwardIcon fontSize="small" />
                        ) : (
                          <SwapHorizIcon fontSize="small" />
                        )}
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                          {tx.title}
                        </Typography>
                        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.3 }}>
                          <Typography variant="caption" color="text.secondary">
                            {tx.transactionDate?.split("T")[0]} {tx.transactionTime}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            •
                          </Typography>
                          <Chip
                            label={primaryVault}
                            size="small"
                            sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#E2E8F0" }}
                          />
                          {tx.category && (
                            <Chip
                              label={tx.category.name}
                              size="small"
                              sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#EFF6FF", color: "#1D4ED8" }}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          color: isExpense ? "#DC2626" : isIncome ? "#16A34A" : "#0F172A",
                        }}
                      >
                        {isExpense ? "-" : isIncome ? "+" : ""}
                        <MoneyValue value={tx.grossAmount} allowTapToggle />
                      </Typography>

                      <IconButton
                        size="small"
                        onClick={() =>
                          openConfirmDialog({
                            title: "Reverse Transaction?",
                            message: `Reverse transaction "${tx.title}"?`,
                            confirmLabel: "Reverse",
                            confirmColor: "error",
                            onConfirm: () => deleteTxMutation.mutateAsync(tx.id),
                          })
                        }
                        sx={{ color: "#94A3B8", "&:hover": { color: "#EF4444" } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

