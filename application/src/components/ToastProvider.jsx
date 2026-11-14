"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Alert,
  Button,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Slide,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function ToastItem({ toast, onDismiss, onUndo, isUndoing }) {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Alert
        severity={toast.severity || "success"}
        variant="filled"
        sx={{
          bgcolor: toast.severity === "error" ? "#DC2626" : toast.severity === "warning" ? "#D97706" : "#0F172A",
          color: "#FFFFFF",
          alignItems: "center",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.25)",
          borderRadius: 2.5,
          minWidth: { xs: "90vw", sm: 360 },
          maxWidth: 460,
        }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {toast.undoTransactionId && (
              <Button
                color="inherit"
                size="small"
                startIcon={<UndoIcon />}
                onClick={() => onUndo(toast.undoTransactionId, toast.id)}
                disabled={isUndoing}
                sx={{
                  color: "#38BDF8",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  "&:hover": { bgcolor: "rgba(56, 189, 248, 0.15)" },
                }}
              >
                {isUndoing ? "Undoing..." : "UNDO (5s)"}
              </Button>
            )}
            <IconButton size="small" color="inherit" onClick={() => onDismiss(toast.id)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {toast.message}
        </Typography>
      </Alert>
    </Slide>
  );
}

/**
 * In-house MUI Toast Queue & Global Confirm Dialog Provider (#14 & #20)
 */
export default function ToastProvider() {
  const { toasts, dismissToast, enqueueToast, confirmDialog, closeConfirmDialog } = useLedgerStore();
  const queryClient = useQueryClient();
  const [confirmBusy, setConfirmBusy] = useState(false);

  const undoMutation = useMutation({
    mutationFn: async ({ txId }) => {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (deleted, vars) => {
      dismissToast(vars.toastId);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      enqueueToast(`Reverted "${deleted.title}"`, { severity: "info", duration: 3000 });
    },
    onError: (err) => {
      enqueueToast(`Could not undo transaction: ${err.message}`, { severity: "error" });
    },
  });

  const handleUndo = (txId, toastId) => {
    undoMutation.mutate({ txId, toastId });
  };

  const handleConfirmProceed = async () => {
    if (!confirmDialog.onConfirm) {
      closeConfirmDialog();
      return;
    }
    try {
      setConfirmBusy(true);
      await confirmDialog.onConfirm();
      closeConfirmDialog();
    } catch (err) {
      enqueueToast(err?.message || "Action failed", { severity: "error" });
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <>
      {/* Stacked Toast Queue Container */}
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 76, md: 24 },
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: (theme) => theme.zIndex.snackbar + 50,
          pointerEvents: "none",
        }}
      >
        <Stack spacing={1} alignItems="center" sx={{ pointerEvents: "auto" }}>
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onDismiss={dismissToast}
              onUndo={handleUndo}
              isUndoing={undoMutation.isPending}
            />
          ))}
        </Stack>
      </Box>

      {/* Global MUI Confirm Dialog replacing browser window.confirm() */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => !confirmBusy && closeConfirmDialog()}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{confirmDialog.title}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeConfirmDialog} color="inherit" disabled={confirmBusy}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmProceed}
            variant="contained"
            color={confirmDialog.confirmColor || "primary"}
            disabled={confirmBusy}
          >
            {confirmBusy ? "Processing..." : confirmDialog.confirmLabel || "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

