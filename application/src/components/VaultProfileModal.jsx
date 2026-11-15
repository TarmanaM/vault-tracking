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
  Switch,
  FormControlLabel,
  IconButton,
  Alert,
  Divider,
  Popover,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import VaultAvatar from "@/components/VaultAvatar";
import CurrencyTextField from "@/components/CurrencyTextField";
import VaultAvatarCropperSection, {
  renderCroppedWebpBlob,
} from "@/features/vaults/VaultAvatarCropperSection";
import VaultInitialPocketsEditor from "@/features/vaults/VaultInitialPocketsEditor";

const VAULT_TYPES = [
  { value: "BANK", label: "Bank Account" },
  { value: "EWALLET", label: "E-Wallet / Digital" },
  { value: "PHYSICAL_CASH", label: "Physical Cash" },
  { value: "PHYSICAL_COIN", label: "Physical Coin" },
  { value: "LIABILITY_CREDIT_LINE", label: "Credit Line / PayLater" },
];

export default function VaultProfileModal({ baseCurrency = "IDR" }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const {
    vaultProfileDialog,
    closeVaultProfileDialog,
    openSubVaultSyncDialog,
    openConfirmDialog,
    enqueueToast,
  } = useLedgerStore();

  const isEdit = vaultProfileDialog.mode === "EDIT" && Boolean(vaultProfileDialog.vault);
  const editVault = vaultProfileDialog.vault;

  const [name, setName] = useState("");
  const [vaultType, setVaultType] = useState("BANK");
  const [initialBalance, setInitialBalance] = useState("");
  const [hasDenominations, setHasDenominations] = useState(false);

  const [symbolMode, setSymbolMode] = useState("INITIALS");
  const [iconName, setIconName] = useState("BANK");
  const [colorHex, setColorHex] = useState("#2563EB");
  const [profileImageUrl, setProfileImageUrl] = useState("");

  const [subVaults, setSubVaults] = useState([]);
  const [newSubName, setNewSubName] = useState("");
  const [newSubCurrency, setNewSubCurrency] = useState(baseCurrency);
  const [newSubInitBal, setNewSubInitBal] = useState("");

  const [rawImageObj, setRawImageObj] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });

  const [errorMsg, setErrorMsg] = useState("");
  const [uploadingCrop, setUploadingCrop] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);

  useEffect(() => {
    if (!vaultProfileDialog.open) return;
    setErrorMsg("");
    setRawImageObj(null);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });

    if (isEdit && editVault) {
      setName(editVault.name || "");
      setVaultType(editVault.vaultType || "BANK");
      setInitialBalance("");
      setHasDenominations(Boolean(editVault.hasDenominations));
      setSymbolMode(editVault.symbolMode || "INITIALS");
      setIconName(editVault.iconName || "BANK");
      setColorHex(editVault.colorHex || "#2563EB");
      setProfileImageUrl(editVault.profileImageUrl || "");
      setSubVaults([]);
    } else {
      setName("");
      setVaultType("BANK");
      setInitialBalance("");
      setHasDenominations(false);
      setSymbolMode("INITIALS");
      setIconName("BANK");
      setColorHex("#2563EB");
      setProfileImageUrl("");
      setSubVaults([]);
    }
    setNewSubName("");
    setNewSubCurrency(baseCurrency);
    setNewSubInitBal("");
  }, [vaultProfileDialog.open, isEdit, editVault, baseCurrency]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      setRawImageObj(img);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setSymbolMode("IMAGE");
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      setErrorMsg("Unable to read image file. Please select PNG, JPEG, or WebP.");
    };
    img.src = objUrl;
  };

  const uploadCroppedCanvas = async () => {
    if (!rawImageObj) return profileImageUrl;
    setUploadingCrop(true);
    try {
      const { blob, fileName } = await renderCroppedWebpBlob(
        rawImageObj,
        cropZoom,
        cropOffset.x,
        cropOffset.y,
        220
      );

      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("vaultSlug", name || "vault");

      const res = await fetch("/api/media/vaults", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProfileImageUrl(json.data.url);
      setRawImageObj(null);
      return json.data.url;
    } finally {
      setUploadingCrop(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const url = isEdit ? `/api/vaults/${editVault.id}` : "/api/vaults";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({ queryKey: ["fxSettings"] });
      enqueueToast(isEdit ? `Updated "${saved.name}" profile` : `Created vault "${saved.name}"`, {
        severity: "success",
      });
      closeVaultProfileDialog();
    },
    onError: (err) => setErrorMsg(err.message || "Failed to save vault"),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vaults/${editVault.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["fxSettings"] });
      enqueueToast(`Archived vault "${editVault.name}"`, { severity: "info" });
      closeVaultProfileDialog();
    },
    onError: (err) => setErrorMsg(err.message || "Failed to archive vault"),
  });

  const handleAddInitialSub = () => {
    if (!newSubName.trim()) return;
    setSubVaults((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        name: newSubName.trim(),
        currency: newSubCurrency || baseCurrency,
        isDefault: prev.length === 0,
        initialBalance: newSubInitBal ? Number(newSubInitBal) : 0,
      },
    ]);
    setNewSubName("");
    setNewSubInitBal("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!name.trim()) {
      setErrorMsg("Vault name is required.");
      return;
    }

    try {
      let resolvedImageUrl = profileImageUrl;
      if (symbolMode === "IMAGE" && rawImageObj) {
        resolvedImageUrl = await uploadCroppedCanvas();
      }
      if (symbolMode === "IMAGE" && !resolvedImageUrl) {
        setErrorMsg("Please upload and crop an image, or switch to Initials / Icon mode.");
        return;
      }

      saveMutation.mutate({
        name: name.trim(),
        vaultType,
        symbolMode,
        iconName: symbolMode === "ICON" ? iconName : null,
        profileImageUrl: symbolMode === "IMAGE" ? resolvedImageUrl : profileImageUrl || null,
        colorHex: /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : "#2563EB",
        hasDenominations,
        ...(!isEdit
          ? {
              initialBalance: initialBalance ? Number(initialBalance) : 0,
              subVaults,
            }
          : {}),
      });
    } catch (err) {
      setErrorMsg(err.message || "Failed to process vault profile");
    }
  };

  const previewVault = {
    name: name || "New Vault",
    vaultType,
    symbolMode: rawImageObj ? "INITIALS" : symbolMode,
    iconName,
    profileImageUrl,
    colorHex,
  };

  return (
    <Dialog
      open={vaultProfileDialog.open}
      onClose={closeVaultProfileDialog}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 800 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <VaultAvatar vault={previewVault} size={34} shape="rounded" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {isEdit ? `Edit Vault: ${editVault.name}` : "Add New Vault"}
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <IconButton size="small" onClick={closeVaultProfileDialog}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Vault Profile &amp; Media Storage
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Custom photos are cropped cleanly via local Canvas, compressed to WebP, and persisted
            directly in the database. Default Initials + Color Picker can be chosen at zero external cost.
          </Typography>
        </Box>
      </Popover>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Vault Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              required
              placeholder="e.g. Wise USD, Bank Jago, Dompet Koin"
            />
            <TextField
              select
              label="Vault Type"
              value={vaultType}
              onChange={(e) => setVaultType(e.target.value)}
              size="small"
              sx={{ minWidth: { sm: 190 } }}
            >
              {VAULT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {!isEdit && (
            <CurrencyTextField
              label={`Initial Balance (${baseCurrency}) — optional`}
              value={initialBalance}
              onValueChange={(num) => setInitialBalance(num === "" ? "" : num)}
              helperText="Opening balance in base currency will automatically create an INITIAL_FUND ledger entry."
            />
          )}

          <VaultAvatarCropperSection
            colorHex={colorHex}
            setColorHex={setColorHex}
            symbolMode={symbolMode}
            setSymbolMode={setSymbolMode}
            iconName={iconName}
            setIconName={setIconName}
            previewVault={previewVault}
            rawImageObj={rawImageObj}
            profileImageUrl={profileImageUrl}
            uploadingCrop={uploadingCrop}
            handleFileSelect={handleFileSelect}
            uploadCroppedCanvas={uploadCroppedCanvas}
            cropZoom={cropZoom}
            setCropZoom={setCropZoom}
            cropOffset={cropOffset}
            setCropOffset={setCropOffset}
          />

          <FormControlLabel
            control={
              <Switch
                checked={hasDenominations}
                onChange={(e) => setHasDenominations(e.target.checked)}
                size="small"
              />
            }
            label="Track physical coin denominations during audit"
          />

          <Divider />

          <VaultInitialPocketsEditor
            isEdit={isEdit}
            editVault={editVault}
            onManagePockets={() => {
              closeVaultProfileDialog();
              openSubVaultSyncDialog(editVault.id);
            }}
            subVaults={subVaults}
            setSubVaults={setSubVaults}
            newSubName={newSubName}
            setNewSubName={setNewSubName}
            newSubCurrency={newSubCurrency}
            setNewSubCurrency={setNewSubCurrency}
            newSubInitBal={newSubInitBal}
            setNewSubInitBal={setNewSubInitBal}
            handleAddInitialSub={handleAddInitialSub}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          {isEdit ? (
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() =>
                openConfirmDialog({
                  title: `Archive "${editVault.name}"?`,
                  message:
                    "Historical ledger transactions stay preserved, and this vault will be hidden from active ribbons and dropdowns.",
                  confirmLabel: "Archive Vault",
                  confirmColor: "error",
                  onConfirm: () => archiveMutation.mutate(),
                })
              }
            >
              Archive
            </Button>
          ) : (
            <Box />
          )}

          <Stack direction="row" spacing={1}>
            <Button onClick={closeVaultProfileDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saveMutation.isPending || uploadingCrop}
            >
              {saveMutation.isPending ? "Saving..." : isEdit ? "Save Profile" : "Create Vault"}
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
}
