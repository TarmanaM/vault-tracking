"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Chip,
  IconButton,
  Popover,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import LinkIcon from "@mui/icons-material/Link";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsOffOutlinedIcon from "@mui/icons-material/NotificationsOffOutlined";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import MoneyValue from "@/components/common/MoneyValue";

export default function CardSuggestionModal() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const {
    cardSuggestionDialog,
    closeCardSuggestionDialog,
    openPromoteCardDialog,
    enqueueToast,
  } = useLedgerStore();

  const [infoAnchor, setInfoAnchor] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isOpen = Boolean(cardSuggestionDialog?.open && cardSuggestionDialog?.suggestion);
  const suggestion = cardSuggestionDialog?.suggestion || null;

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cards/from-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "LINK_EXISTING",
          sourceTransactionId: suggestion?.transaction?.id,
          existingCardId: suggestion?.existingCard?.id,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to link transaction to card");
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["cards-all-active"] });
      queryClient.invalidateQueries({ queryKey: ["title-suggestions"] });

      closeCardSuggestionDialog();
      enqueueToast(`Linked transaction to "${data.card?.title || suggestion?.existingCard?.title}"`, {
        severity: "success",
      });
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to link transaction");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cards/suggestions/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nature: suggestion?.transaction?.nature,
          title: suggestion?.transaction?.title,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to mute suggestion");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["title-suggestions"] });
      const mutedTitle = suggestion?.transaction?.title || "this title";
      closeCardSuggestionDialog();
      enqueueToast(`Muted card suggestions for "${mutedTitle}"`, { severity: "info" });
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to mute suggestion");
    },
  });

  if (!isOpen || !suggestion) return null;

  const isLinkPrompt = suggestion.suggestionType === "LINK_EXISTING";
  const stats = suggestion.detectedStats || null;
  const isBusy = linkMutation.isPending || dismissMutation.isPending;

  const handleClose = () => {
    if (isBusy) return;
    setErrorMsg("");
    closeCardSuggestionDialog();
  };

  const handleAcceptCreate = () => {
    const txPayload = suggestion.transaction;
    setErrorMsg("");
    closeCardSuggestionDialog();
    openPromoteCardDialog(txPayload);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      fullScreen={false}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 2.5 : 3,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 800,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #E2E8F0",
          py: 1.5,
          px: 2.25,
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          {isLinkPrompt ? (
            <LinkIcon color="warning" fontSize="small" />
          ) : (
            <FlashOnIcon color="primary" fontSize="small" />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {suggestion.reasonTitle || "Do You Want to Make a Card?"}
          </Typography>
          <IconButton
            size="small"
            aria-label="Why the system suggests this card"
            onClick={(e) => setInfoAnchor(e.currentTarget)}
          >
            <InfoOutlinedIcon fontSize="small" color="action" />
          </IconButton>
        </Stack>
        <IconButton size="small" onClick={handleClose} disabled={isBusy}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
            100% In-House Pattern Detection
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
            Triggered deterministically when an ad-hoc transaction shares a normalized title and type with at least one prior entry (or matches an existing Action Card). Choosing &ldquo;Don&apos;t Ask Again&rdquo; mutes suggestions for that title across your devices.
          </Typography>
        </Box>
      </Popover>

      <DialogContent sx={{ p: 2.25 }}>
        <Stack spacing={1.75}>
          {errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg("")}>
              {errorMsg}
            </Alert>
          )}

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: isLinkPrompt ? "#FFFBEB" : "#F0F9FF",
              border: `1px solid ${isLinkPrompt ? "#FDE68A" : "#BAE6FD"}`,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#0F172A", lineHeight: 1.5 }}>
              {suggestion.reasonSummary}
            </Typography>
          </Box>

          {stats && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`${stats.occurrenceCount}x recorded`}
                sx={{ fontWeight: 700, fontSize: "0.72rem" }}
              />
              {Number(stats.mostFrequentAmount) > 0 && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    <span>
                      Typical:{" "}
                      <MoneyValue
                        value={stats.mostFrequentAmount}
                        currency={stats.currency || "IDR"}
                      />
                    </span>
                  }
                  sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
              {stats.mostFrequentVaultName && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Vault: ${stats.mostFrequentVaultName}`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
              {stats.typicalHourLabel && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Time: ~${stats.typicalHourLabel}`}
                  sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                />
              )}
            </Stack>
          )}

          {Array.isArray(suggestion.reasonBullets) && suggestion.reasonBullets.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.25, color: "#475569" }}>
              {suggestion.reasonBullets.map((line, idx) => (
                <Typography component="li" key={idx} variant="caption" sx={{ mb: 0.4, lineHeight: 1.45 }}>
                  {line}
                </Typography>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid #E2E8F0",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Button
          size="small"
          color="inherit"
          startIcon={<NotificationsOffOutlinedIcon fontSize="small" />}
          disabled={isBusy}
          onClick={() => dismissMutation.mutate()}
          sx={{ color: "#64748B", fontWeight: 700, fontSize: "0.75rem" }}
        >
          Don&apos;t Ask Again
        </Button>

        <Stack direction="row" spacing={1}>
          <Button size="small" color="inherit" disabled={isBusy} onClick={handleClose}>
            Not Now
          </Button>
          {isLinkPrompt ? (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<LinkIcon fontSize="small" />}
              disabled={isBusy}
              onClick={() => linkMutation.mutate()}
              sx={{ fontWeight: 800 }}
            >
              {linkMutation.isPending ? "Linking..." : "Link to Existing Card"}
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<FlashOnIcon fontSize="small" />}
              disabled={isBusy}
              onClick={handleAcceptCreate}
              sx={{ fontWeight: 800 }}
            >
              Create Action Card
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
