"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Box,
  Typography,
  Chip,
  Alert,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Popover,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import { SUPPORTED_CURRENCIES } from "@/lib/currencyHelpers";

export default function FxSettingsModal() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const { fxSettingsDialog, closeFxSettingsDialog, enqueueToast } = useLedgerStore();

  const [baseCurrency, setBaseCurrency] = useState("IDR");
  const [intervalDays, setIntervalDays] = useState(3);
  const [editingCode, setEditingCode] = useState(null);
  const [manualRateInput, setManualRateInput] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["fxSettings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/fx");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: fxSettingsDialog.open,
  });

  useEffect(() => {
    if (data?.settings) {
      setBaseCurrency(data.settings.baseCurrency || "IDR");
      setIntervalDays(data.settings.fxSyncIntervalDays || 3);
    }
  }, [data]);

  const invalidateFx = () => {
    queryClient.invalidateQueries({ queryKey: ["fxSettings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["reconcile"] });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/settings/fx", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      setEditingCode(null);
      setErrorMsg("");
      invalidateFx();
      enqueueToast("Saved Currency & FX preferences", { severity: "success" });
    },
    onError: (err) => setErrorMsg(err.message || "Failed to save settings"),
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/fx/sync", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (resData) => {
      setErrorMsg("");
      invalidateFx();
      const syncRes = resData?.syncResult;
      if (syncRes?.skipped && syncRes?.reason === "NO_ACTIVE_FOREIGN_CURRENCIES") {
        enqueueToast("FX Sync disabled: no active foreign sub-vaults found.", {
          severity: "info",
        });
        return;
      }
      const count = syncRes?.updatedCount || 0;
      const syncedList = syncRes?.activeCurrencies?.join(", ") || "";
      enqueueToast(
        syncedList
          ? `Synced ${count} active currency rate(s): ${syncedList}`
          : `Synced ${count} active exchange rate(s)`,
        { severity: "success" }
      );
    },
    onError: (err) => setErrorMsg(err.message || "Sync failed"),
  });

  const settings = data?.settings;
  const rates = data?.rates || [];
  const activeForeignCurrencies = data?.activeForeignCurrencies || [];
  const fxSyncEnabled = Boolean(data?.fxSyncEnabled);
  const activeCurrencySet = new Set(activeForeignCurrencies);

  return (
    <Dialog
      open={fxSettingsDialog.open}
      onClose={closeFxSettingsDialog}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 800 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Currency &amp; FX Settings
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <IconButton size="small" onClick={closeFxSettingsDialog}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 340 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Active-Only FX Sync &amp; Rate Lock
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            • <b>Active Currencies Only:</b> Frankfurter v2 syncs only foreign currencies held by active vault
            pockets. When no foreign sub-vaults are active, syncing stays disabled automatically.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            • <b>Live Vaults vs Passive Cache:</b> Active foreign pockets revalue live; previously cached
            inactive rates remain saved passively without background polling.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            • <b>Historical Ledger:</b> Past transactions lock their entry FX rate permanently.
          </Typography>
        </Box>
      </Popover>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                select
                size="small"
                label="Default Base Currency"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                fullWidth
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                type="number"
                label="Auto-Sync Interval (Days)"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                inputProps={{ min: 1, max: 90 }}
                sx={{ width: { sm: 210 } }}
              />
            </Stack>

            <Alert
              severity={fxSyncEnabled ? "success" : "info"}
              sx={{ py: 0.5, alignItems: "center" }}
            >
              {fxSyncEnabled ? (
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Active Sync Targets:
                  </Typography>
                  {activeForeignCurrencies.map((code) => (
                    <Chip
                      key={code}
                      size="small"
                      label={code}
                      color="success"
                      variant="outlined"
                      sx={{ height: 20, fontWeight: 800, fontSize: "0.7rem" }}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  FX Sync Disabled — All active vaults use {settings?.baseCurrency || baseCurrency}.
                </Typography>
              )}
            </Alert>

            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {fxSyncEnabled ? (
                    <>
                      Last Sync:{" "}
                      <b>
                        {settings?.lastFxSyncedAt
                          ? new Date(settings.lastFxSyncedAt).toLocaleString()
                          : "Never synced"}
                      </b>{" "}
                      ({settings?.lastFxStatus || "PENDING"})
                    </>
                  ) : (
                    <>
                      Sync Status: <b>Disabled</b>
                      {settings?.lastFxSyncedAt
                        ? ` (Last active sync: ${new Date(settings.lastFxSyncedAt).toLocaleString()})`
                        : ""}
                    </>
                  )}
                </Typography>
                {fxSyncEnabled && settings?.lastFxError && (
                  <Typography variant="caption" color="error.main">
                    {settings.lastFxError}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  disabled={!fxSyncEnabled || syncNowMutation.isPending}
                  onClick={() => syncNowMutation.mutate()}
                >
                  {syncNowMutation.isPending ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={saveSettingsMutation.isPending}
                  onClick={() =>
                    saveSettingsMutation.mutate({
                      baseCurrency,
                      fxSyncIntervalDays: Number(intervalDays) || 3,
                    })
                  }
                >
                  Save Settings
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ border: "1px solid #E2E8F0", borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569" }}>
                  CACHED EXCHANGE RATES (1 FOREIGN UNIT TO {settings?.baseCurrency || "IDR"})
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Currency</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Rate</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Source / Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Override</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 2.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {fxSyncEnabled
                            ? 'No cached rates yet. Tap "Sync Now" to fetch rates for your active foreign sub-vaults.'
                            : "No cached rates yet. FX syncing stays disabled until a foreign currency sub-vault is added."}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rates.map((r) => {
                      const isRowEdit = editingCode === r.baseCurrency;
                      const isCurrencyActive = activeCurrencySet.has(r.baseCurrency);
                      return (
                        <TableRow key={r.id}>
                          <TableCell sx={{ fontWeight: 800 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <span>{r.baseCurrency}</span>
                              {!isCurrencyActive && (
                                <Chip
                                  label="Passive"
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 17, fontSize: "0.62rem", color: "#64748B", borderColor: "#CBD5E1" }}
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {isRowEdit ? (
                              <TextField
                                size="small"
                                type="number"
                                value={manualRateInput}
                                onChange={(e) => setManualRateInput(e.target.value)}
                                sx={{ width: 110 }}
                              />
                            ) : (
                              Number(r.rate).toLocaleString("en-US", { maximumFractionDigits: 4 })
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={r.source === "MANUAL" ? "Manual" : "Frankfurter"}
                              size="small"
                              color={r.source === "MANUAL" ? "warning" : "default"}
                              sx={{ height: 18, fontSize: "0.65rem", mr: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {r.rateDate}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {isRowEdit ? (
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() =>
                                    saveSettingsMutation.mutate({
                                      manualRate: {
                                        baseCurrency: r.baseCurrency,
                                        quoteCurrency: settings?.baseCurrency || baseCurrency,
                                        rate: Number(manualRateInput),
                                      },
                                    })
                                  }
                                >
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setEditingCode(null)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            ) : (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingCode(r.baseCurrency);
                                  setManualRateInput(String(r.rate));
                                }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={closeFxSettingsDialog}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
