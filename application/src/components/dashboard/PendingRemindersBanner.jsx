"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import MoneyValue from "@/components/common/MoneyValue";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function PendingRemindersBanner({ reminders = [] }) {
  const queryClient = useQueryClient();
  const openTransactionDialog = useLedgerStore((s) => s.openTransactionDialog);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [estAmount, setEstAmount] = useState("");

  const addReminderMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/reminders", {
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
      setIsAddOpen(false);
      setTitle("");
      setEstAmount("");
    },
  });

  const handleConvert = (reminder) => {
    openTransactionDialog({
      title: reminder.title,
      grossAmount: reminder.estimatedAmount,
      sourceVaultId: reminder.suggestedVaultId,
      partyId: reminder.suggestedPartyId,
      categoryId: reminder.suggestedCategoryId,
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Top action row */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationsActiveOutlinedIcon sx={{ fontSize: 18, color: "#F59E0B" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1E293B" }}>
            Draft Notes &amp; Pending Reminders ({reminders.length})
          </Typography>
        </Stack>

        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setIsAddOpen(true)}
          sx={{ fontSize: "0.75rem", color: "#2563EB", fontWeight: 700 }}
        >
          + Quick Reminder
        </Button>
      </Box>

      {/* Reminder Cards list */}
      {reminders.length > 0 && (
        <Stack spacing={1}>
          {reminders.map((r) => (
            <Card key={r.id} sx={{ bgcolor: "#FFFBEB", borderColor: "#FDE68A" }}>
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#92400E" }}>
                    {r.title}
                  </Typography>
                  {r.estimatedAmount && (
                    <Typography variant="caption" sx={{ color: "#B45309" }}>
                      Estimated: <MoneyValue value={r.estimatedAmount} />
                    </Typography>
                  )}
                </Box>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleConvert(r)}
                  startIcon={<CheckIcon />}
                  sx={{
                    borderColor: "#D97706",
                    color: "#92400E",
                    fontSize: "0.75rem",
                    "&:hover": { bgcolor: "rgba(217, 119, 6, 0.1)", borderColor: "#B45309" },
                  }}
                >
                  Record into Ledger
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Quick Add Dialog */}
      <Dialog open={isAddOpen} onClose={() => setIsAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add Quick Reminder / Draft Note</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Reminder Title / Note"
              placeholder='e.g. "Tanya Nando patungan kopi", "Tagihan SPayLater"'
              fullWidth
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <CurrencyTextField
              label="Estimated Amount (Optional)"
              value={estAmount}
              onValueChange={(num) => setEstAmount(num)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsAddOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!title || addReminderMutation.isPending}
            onClick={() => addReminderMutation.mutate({ title, estimatedAmount: estAmount ? Number(estAmount) : null })}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

