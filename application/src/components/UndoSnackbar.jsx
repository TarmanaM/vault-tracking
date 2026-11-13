"use client";

import React from "react";
import { Snackbar, Button, Alert } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function UndoSnackbar() {
  const { undoSnackbar, closeUndoSnackbar } = useLedgerStore();
  const queryClient = useQueryClient();

  const undoMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      closeUndoSnackbar();
    },
    onError: (err) => {
      alert(`Could not undo transaction: ${err.message}`);
    },
  });

  const handleUndo = () => {
    if (undoSnackbar.transactionId) {
      undoMutation.mutate(undoSnackbar.transactionId);
    }
  };

  return (
    <Snackbar
      open={undoSnackbar.open}
      autoHideDuration={5000}
      onClose={closeUndoSnackbar}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="success"
        variant="filled"
        sx={{
          bgcolor: "#0F172A",
          color: "#FFFFFF",
          alignItems: "center",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
          borderRadius: 2.5,
        }}
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<UndoIcon />}
            onClick={handleUndo}
            disabled={undoMutation.isPending}
            sx={{
              color: "#38BDF8",
              fontWeight: 800,
              "&:hover": { bgcolor: "rgba(56, 189, 248, 0.1)" },
            }}
          >
            {undoMutation.isPending ? "Reversing..." : "UNDO (5s)"}
          </Button>
        }
      >
        {undoSnackbar.message}
      </Alert>
    </Snackbar>
  );
}

