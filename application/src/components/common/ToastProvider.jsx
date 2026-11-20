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
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function ToastItem({ toast, onDismiss, onUndo, onPromoteCard, isUndoing }) {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const isWelcome = toast.variant === "welcome";

  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Alert
        severity={toast.severity || "success"}
        variant="filled"
        icon={
          isWelcome ? (
            <AutoAwesomeIcon sx={{ color: "#FDE68A !important", fontSize: 22 }} />
          ) : undefined
        }
        sx={{
          background: isWelcome
            ? "linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #1D4ED8 100%)"
            : undefined,
          bgcolor: isWelcome
            ? undefined
            : toast.severity === "error"
            ? "#DC2626"
            : toast.severity === "warning"
            ? "#D97706"
            : "#0F172A",
          color: "#FFFFFF",
          alignItems: "center",
          border: isWelcome ? "1px solid rgba(147, 197, 253, 0.35)" : "none",
          boxShadow: isWelcome
            ? "0 16px 36px -8px rgba(30, 58, 138, 0.55)"
            : "0 10px 25px -5px rgba(0,0,0,0.25)",
          borderRadius: isWelcome ? 3 : 2.5,
          py: isWelcome ? 1.1 : undefined,
          minWidth: { xs: "90vw", sm: isWelcome ? 390 : 360 },
          maxWidth: isWelcome ? 500 : 460,
        }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {toast.promoteTransaction && (
              <Button
                color="inherit"
                size="small"
                startIcon={<FlashOnIcon sx={{ fontSize: 15 }} />}
                onClick={() => onPromoteCard(toast.promoteTransaction, toast.id)}
                disabled={isUndoing}
                sx={{
                  color: "#34D399",
                  fontWeight: 800,
                  fontSize: "0.72rem",
                  whiteSpace: "nowrap",
                  "&:hover": { bgcolor: "rgba(52, 211, 153, 0.16)" },
                }}
              >
                + CARD
              </Button>
            )}
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
                  whiteSpace: "nowrap",
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
        {toast.title ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: 0.15, lineHeight: 1.25 }}>
              {toast.title}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(241, 245, 249, 0.9)", display: "block", mt: 0.25, lineHeight: 1.4 }}>
              {toast.message}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {toast.message}
          </Typography>
        )}
      </Alert>
    </Slide>
  );
}

/**
 * In-house MUI Toast Queue & Global Confirm Dialog Provider (#14 & #20)
 */
export default function ToastProvider() {
  const { toasts, dismissToast, enqueueToast, confirmDialog, closeConfirmDialog, openPromoteCardDialog } =
    useLedgerStore();
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

  const handlePromoteCard = (txSnapshot, toastId) => {
    dismissToast(toastId);
    openPromoteCardDialog(txSnapshot);
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
              onPromoteCard={handlePromoteCard}
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

