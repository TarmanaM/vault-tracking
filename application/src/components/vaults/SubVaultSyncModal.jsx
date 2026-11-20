"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Switch,
  Radio,
  Chip,
  Alert,
  IconButton,
  Divider,
  Popover,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import VaultAvatar from "@/components/vaults/VaultAvatar";
import MoneyValue from "@/components/common/MoneyValue";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import { SUPPORTED_CURRENCIES } from "@/lib/currencyHelpers";

export default function SubVaultSyncModal({ vaults = [], baseCurrency = "IDR", exchangeRates = {} }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const {
    subVaultSyncDialog,
    closeSubVaultSyncDialog,
    openConfirmDialog,
    enqueueToast,
  } = useLedgerStore();

  const vault = useMemo(
    () => vaults.find((v) => v.id === subVaultSyncDialog.vaultId) || null,
    [vaults, subVaultSyncDialog.vaultId]
  );

  const [allocations, setAllocations] = useState([]);
  const [defaultSubId, setDefaultSubId] = useState(null);

  // Quick Add Sub-Vault state
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState(baseCurrency);
  const [newInitBal, setNewInitBal] = useState("");
  const [adjustMainVault, setAdjustMainVault] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!subVaultSyncDialog.open || !vault) return;
    setErrorMsg("");
    const subs = vault.subContainers || [];
    setAllocations(
      subs.map((sc) => ({
        id: sc.id,
        name: sc.name,
        code: sc.code,
        currency: String(sc.currency || baseCurrency).toUpperCase(),
        isSynced: Boolean(sc.isSynced),
        balance: Number(sc.currentBalance || 0),
        colorHex: sc.colorHex || "",
      }))
    );
    const def = subs.find((s) => s.isDefault) || subs[0];
    setDefaultSubId(def ? def.id : null);
    setNewName("");
    setNewCurrency(baseCurrency);
    setNewInitBal("");
    setAdjustMainVault(false);
  }, [subVaultSyncDialog.open, vault, baseCurrency]);

  const baseUpper = String(baseCurrency || "IDR").toUpperCase();
  const mainBookBalance = Number(vault?.currentBalance || 0);

  // Live preview implementing the 2-Pocket Auto-Fill vs >=3 Unallocated Pool rule (#3)
  const preview = useMemo(() => {
    const baseItems = allocations.filter((a) => a.currency === baseUpper);
    const syncedBase = baseItems.filter((a) => a.isSynced);
    const unsyncedBase = baseItems.filter((a) => !a.isSynced);
    const syncedSum = syncedBase.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const remainder = Number((mainBookBalance - syncedSum).toFixed(2));
    const singleUnsyncedAutoId =
      syncedBase.length > 0 && unsyncedBase.length === 1 ? unsyncedBase[0].id : null;

    let foreignBaseEst = 0;
    for (const a of allocations) {
      if (a.currency !== baseUpper) {
        const rate = Number(exchangeRates?.[a.currency]?.rate || 0);
        if (rate > 0) foreignBaseEst += (Number(a.balance) || 0) * rate;
      }
    }

    return {
      syncedSum,
      remainder,
      singleUnsyncedAutoId,
      unsyncedCount: unsyncedBase.length,
      isNegativeDrift: syncedBase.length > 0 && remainder < 0,
      estimatedTotalWithFx: mainBookBalance + foreignBaseEst,
    };
  }, [allocations, baseUpper, mainBookBalance, exchangeRates]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reconcile"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["fxSettings"] });
  };

  const addSubMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch(`/api/vaults/${vault.id}/sub-vaults`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      setNewName("");
      setNewInitBal("");
      invalidateAll();
      enqueueToast("Sub-vault pocket added", { severity: "success" });
    },
    onError: (err) => setErrorMsg(err.message || "Failed to add sub-vault"),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${vault.id}/sub-vaults`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultSubContainerId: defaultSubId,
          adjustMainVaultToMatch: preview.isNegativeDrift && adjustMainVault,
          allocations: allocations.map((a) => ({
            id: a.id,
            name: a.name,
            isSynced: a.currency === baseUpper ? a.isSynced : true,
            balance: a.isSynced || a.currency !== baseUpper ? Number(a.balance) || 0 : 0,
            colorHex: a.colorHex || null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (resData) => {
      invalidateAll();
      if (resData?.partitionState?.isOutOfSync) {
        enqueueToast(
          `Saved with out-of-sync warning: ${resData.partitionState.warningNote || "Adjust pocket splits"}`,
          { severity: "warning" }
        );
      } else {
        enqueueToast(`Synced sub-vault splits for ${vault.name}`, { severity: "success" });
      }
      closeSubVaultSyncDialog();
    },
    onError: (err) => setErrorMsg(err.message || "Failed to sync sub-vaults"),
  });

  const deleteSubMutation = useMutation({
    mutationFn: async (subId) => {
      const res = await fetch(`/api/vaults/${vault.id}/sub-vaults?subId=${subId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      invalidateAll();
      enqueueToast("Sub-vault pocket removed", { severity: "info" });
    },
    onError: (err) => setErrorMsg(err.message || "Failed to remove sub-vault"),
  });

  if (!vault) return null;

  return (
    <Dialog
      open={subVaultSyncDialog.open}
      onClose={closeSubVaultSyncDialog}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 800 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <VaultAvatar vault={vault} size={32} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {vault.name} — Sub-Vaults &amp; Split
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Partition internal pockets &amp; foreign currencies
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <IconButton size="small" onClick={closeSubVaultSyncDialog}>
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
            Sub-Vault Sync Split &amp; Unallocated Pool Rules
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            • <b>Main Vault Unchanged:</b> Syncing partitions never alters Main Vault book balance.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            • <b>2-Pocket Auto-Fill:</b> If syncing leaves exactly 1 other {baseUpper} pocket unsynced,
            it auto-fills with Main Vault minus synced amount.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            • <b>3+ Pockets:</b> If 2+ base pockets remain unsynced, remainder sits safely in the Unallocated Pool.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            • <b>Valas Pockets:</b> Non-{baseUpper} pockets hold native currency balances converted dynamically using cached rates.
          </Typography>
        </Box>
      </Popover>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

        {vault.subVaultOutOfSync && (
          <Alert severity="warning" icon={<WarningAmberIcon />}>
            {vault.subVaultSyncNote ||
              "Recent transactions crossed into synced sub-vault splits. Review and save to re-sync."}
          </Alert>
        )}

        {/* Main Vault Summary Header */}
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                MAIN BOOK BALANCE ({baseUpper})
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A" }}>
                <MoneyValue value={mainBookBalance} currency={baseUpper} forceExact />
              </Typography>
            </Box>

            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                UNALLOCATED {baseUpper} POOL
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: preview.isNegativeDrift ? "#DC2626" : "#059669",
                }}
              >
                <MoneyValue value={preview.remainder} currency={baseUpper} forceExact />
              </Typography>
            </Box>
          </Stack>

          {preview.isNegativeDrift && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                Synced {baseUpper} pockets ({preview.syncedSum.toLocaleString()}) exceed Main Vault ({mainBookBalance.toLocaleString()}) by{" "}
                {Math.abs(preview.remainder).toLocaleString()} {baseUpper}.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  size="small"
                  variant={adjustMainVault ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setAdjustMainVault(true)}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Adjust Main Vault to {preview.syncedSum.toLocaleString()} (+Initial Fund)
                </Button>
                <Button
                  size="small"
                  variant={!adjustMainVault ? "contained" : "outlined"}
                  color="warning"
                  onClick={() => setAdjustMainVault(false)}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Keep Main Vault ({mainBookBalance.toLocaleString()}) &amp; Flag Out-of-Sync
                </Button>
              </Stack>
            </Alert>
          )}
        </Box>

        {/* Sub-Vault List */}
        {allocations.length === 0 ? (
          <Alert severity="info">
            This vault does not have any sub-vault pockets yet. Add one below (for example: Utama, Tabungan, or USD Pocket).
          </Alert>
        ) : (
          <Stack spacing={1.25}>
            {allocations.map((item, idx) => {
              const isForeign = item.currency !== baseUpper;
              const isAutoDerived = !isForeign && preview.singleUnsyncedAutoId === item.id;
              const rate = Number(exchangeRates?.[item.currency]?.rate || 0);
              const estBase = isForeign && rate > 0 ? (Number(item.balance) || 0) * rate : null;

              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    border: defaultSubId === item.id ? "1.5px solid #2563EB" : "1px solid #E2E8F0",
                    bgcolor: defaultSubId === item.id ? "#F8FAFF" : "#FFFFFF",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Radio
                        size="small"
                        checked={defaultSubId === item.id}
                        onChange={() => setDefaultSubId(item.id)}
                        sx={{ p: 0.25 }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {item.name}
                      </Typography>
                      <Chip
                        label={item.currency}
                        size="small"
                        color={isForeign ? "secondary" : "default"}
                        sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                      />
                      {defaultSubId === item.id && (
                        <Chip label="Default" size="small" color="primary" sx={{ height: 20, fontSize: "0.68rem" }} />
                      )}
                      {isAutoDerived && (
                        <Chip
                          label={`Auto-Fill: ${preview.remainder.toLocaleString()}`}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                        />
                      )}
                    </Stack>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {!isForeign && (
                        <Chip
                          label={item.isSynced ? "Synced" : "Pool"}
                          size="small"
                          clickable
                          onClick={() =>
                            setAllocations((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, isSynced: !x.isSynced } : x))
                            )
                          }
                          color={item.isSynced ? "info" : "default"}
                          variant={item.isSynced ? "filled" : "outlined"}
                          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
                        />
                      )}

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          openConfirmDialog({
                            title: `Remove pocket "${item.name}"?`,
                            message: "Transactions logged on this pocket keep their vault history safely.",
                            confirmLabel: "Remove",
                            confirmColor: "error",
                            onConfirm: () => deleteSubMutation.mutate(item.id),
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {(isForeign || item.isSynced) ? (
                    <Box>
                      <CurrencyTextField
                        label={`${isForeign ? "Native Balance" : "Allocated Split"} (${item.currency})`}
                        value={item.balance}
                        onValueChange={(num) =>
                          setAllocations((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, balance: num === "" ? 0 : Number(num) } : x
                            )
                          )
                        }
                      />
                      {isForeign && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: "block" }}>
                          {estBase !== null ? (
                            <>
                              ≈ <MoneyValue value={estBase} currency={baseUpper} forceExact /> (@ {rate.toLocaleString()})
                            </>
                          ) : (
                            "No cached exchange rate yet — sync FX rates in Sidebar > Currency & FX."
                          )}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {isAutoDerived
                        ? `Only unsynced ${baseUpper} pocket: automatically derives remainder (${preview.remainder.toLocaleString()} ${baseUpper}) upon Save.`
                        : `Shares unallocated ${baseUpper} pool (${preview.remainder.toLocaleString()} ${baseUpper}). Toggle "Synced" to lock a specific split.`}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}

        <Divider />

        {/* Add Sub-Vault Pocket Form */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 1 }}>
            + ADD NEW SUB-VAULT POCKET
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Pocket Name"
              placeholder="e.g. Emergency, USD Cash"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <TextField
              select
              size="small"
              label="Currency"
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              sx={{ minWidth: 100 }}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code}
                </MenuItem>
              ))}
            </TextField>
            <CurrencyTextField
              label="Initial Split"
              value={newInitBal}
              onValueChange={(num) => setNewInitBal(num === "" ? "" : num)}
              sx={{ width: { sm: 130 } }}
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!newName.trim() || addSubMutation.isPending}
              onClick={() =>
                addSubMutation.mutate({
                  name: newName.trim(),
                  currency: newCurrency,
                  initialBalance: newInitBal !== "" ? Number(newInitBal) : null,
                })
              }
              sx={{ flexShrink: 0 }}
            >
              Add
            </Button>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={closeSubVaultSyncDialog}>Close</Button>
        {allocations.length > 0 && (
          <Button
            variant="contained"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? "Saving..." : "Save Sync Split"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
