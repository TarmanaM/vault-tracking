"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Tabs,
  Tab,
  Slider,
  Chip,
  Switch,
  FormControlLabel,
  IconButton,
  Alert,
  Divider,
  Popover,
  Radio,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import VaultAvatar, { VAULT_ICON_OPTIONS } from "@/components/VaultAvatar";
import CurrencyTextField from "@/components/CurrencyTextField";
import { SUPPORTED_CURRENCIES } from "@/lib/currencyHelpers";

const VAULT_TYPES = [
  { value: "BANK", label: "Bank Account" },
  { value: "EWALLET", label: "E-Wallet / Digital" },
  { value: "PHYSICAL_CASH", label: "Physical Cash" },
  { value: "PHYSICAL_COIN", label: "Physical Coin" },
  { value: "LIABILITY_CREDIT_LINE", label: "Credit Line / PayLater" },
];

const COLOR_SWATCHES = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#EA580C",
  "#4F46E5",
  "#0F172A",
  "#DC2626",
];

function drawCroppedToCanvas(canvas, loadedImg, zoom, offsetX, offsetY, stageSize = 220) {
  if (!canvas || !loadedImg) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, w, h);

  const imgW = loadedImg.naturalWidth || loadedImg.width || stageSize;
  const imgH = loadedImg.naturalHeight || loadedImg.height || stageSize;
  const ratio = w / stageSize;
  const baseScale = Math.max(stageSize / imgW, stageSize / imgH);
  const drawW = imgW * baseScale * zoom * ratio;
  const drawH = imgH * baseScale * zoom * ratio;
  const dx = w / 2 - drawW / 2 + offsetX * ratio;
  const dy = h / 2 - drawH / 2 + offsetY * ratio;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(loadedImg, dx, dy, drawW, drawH);
}

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

  // Visual profile customization (#7)
  const [symbolMode, setSymbolMode] = useState("INITIALS");
  const [iconName, setIconName] = useState("BANK");
  const [colorHex, setColorHex] = useState("#2563EB");
  const [profileImageUrl, setProfileImageUrl] = useState("");

  // Optional initial sub-vault builder on Create (#3, #5)
  const [subVaults, setSubVaults] = useState([]);
  const [newSubName, setNewSubName] = useState("");
  const [newSubCurrency, setNewSubCurrency] = useState(baseCurrency);
  const [newSubInitBal, setNewSubInitBal] = useState("");

  // In-house HTML5 <canvas> Cropper state
  const [rawImageObj, setRawImageObj] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const stageCanvasRef = useRef(null);
  const squarePreviewRef = useRef(null);
  const circlePreviewRef = useRef(null);

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

  useEffect(() => {
    if (!rawImageObj) return;
    drawCroppedToCanvas(stageCanvasRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
    drawCroppedToCanvas(squarePreviewRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
    drawCroppedToCanvas(circlePreviewRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
  }, [rawImageObj, cropZoom, cropOffset]);

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
      const offscreen = document.createElement("canvas");
      offscreen.width = 512;
      offscreen.height = 512;
      drawCroppedToCanvas(offscreen, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);

      const blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to render cropped image");

      const formData = new FormData();
      formData.append("file", blob, "vault-avatar.png");
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

  const tabIndex = symbolMode === "ICON" ? 1 : symbolMode === "IMAGE" ? 2 : 0;

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
            Custom photos are cropped cleanly via local Canvas and persisted to your server&apos;s media
            directory. Default Initials + Color Picker can be chosen at zero external cost.
          </Typography>
        </Box>
      </Popover>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

          {/* Core Identity Fields */}
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

          {/* Appearance: Symbol Mode + Interactive Color Picker (#7) */}
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 1 }}>
              VAULT BADGE &amp; THEME COLOR
            </Typography>

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap", rowGap: 1 }}>
              <Box
                component="label"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.25,
                  py: 0.6,
                  borderRadius: 2,
                  border: "1px solid #CBD5E1",
                  bgcolor: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : "#2563EB"}
                  onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                  style={{ width: 24, height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
                />
                <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                  Pick Color
                </Typography>
              </Box>

              <TextField
                size="small"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                sx={{ width: 110 }}
                inputProps={{ maxLength: 7, style: { fontFamily: "monospace", fontSize: "0.82rem" } }}
              />

              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {COLOR_SWATCHES.map((hex) => (
                  <Box
                    key={hex}
                    onClick={() => setColorHex(hex)}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: hex,
                      cursor: "pointer",
                      border: colorHex === hex ? "2px solid #0F172A" : "2px solid #FFFFFF",
                      boxShadow: "0 0 0 1px #CBD5E1",
                    }}
                  />
                ))}
              </Stack>
            </Stack>

            <Tabs
              value={tabIndex}
              onChange={(_, idx) => setSymbolMode(idx === 1 ? "ICON" : idx === 2 ? "IMAGE" : "INITIALS")}
              variant="fullWidth"
              sx={{ minHeight: 36, mb: 1.5, borderBottom: "1px solid #E2E8F0" }}
            >
              <Tab label="Initials (Default)" sx={{ minHeight: 36, fontWeight: 700, fontSize: "0.78rem" }} />
              <Tab label="Icon" sx={{ minHeight: 36, fontWeight: 700, fontSize: "0.78rem" }} />
              <Tab label="Photo / Crop" sx={{ minHeight: 36, fontWeight: 700, fontSize: "0.78rem" }} />
            </Tabs>

            {symbolMode === "INITIALS" && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
                <VaultAvatar vault={{ ...previewVault, symbolMode: "INITIALS" }} size={54} shape="rounded" />
                <VaultAvatar vault={{ ...previewVault, symbolMode: "INITIALS" }} size={54} shape="circle" />
                <Typography variant="caption" color="text.secondary">
                  Clean monogram generated automatically from the Vault Name using your selected theme color.
                </Typography>
              </Stack>
            )}

            {symbolMode === "ICON" && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, pt: 0.5 }}>
                {VAULT_ICON_OPTIONS.map(({ key, label, Icon }) => {
                  const selected = iconName === key;
                  return (
                    <Chip
                      key={key}
                      icon={<Icon sx={{ fontSize: 16 }} />}
                      label={label}
                      size="small"
                      clickable
                      onClick={() => setIconName(key)}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      sx={{ fontWeight: 600 }}
                    />
                  );
                })}
              </Box>
            )}

            {symbolMode === "IMAGE" && (
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadOutlinedIcon />}
                  >
                    {rawImageObj || profileImageUrl ? "Choose Another Image" : "Upload Vault Logo/Photo"}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} />
                  </Button>
                  {rawImageObj && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={uploadingCrop}
                      onClick={uploadCroppedCanvas}
                    >
                      {uploadingCrop ? "Uploading..." : "Apply Crop Now"}
                    </Button>
                  )}
                </Stack>

                {rawImageObj ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                        Drag to Pan • Use Slider to Zoom
                      </Typography>
                      {/* Native HTML canvas ensures width/height set actual bitmap pixels instead of MUI system CSS props */}
                      <canvas
                        ref={stageCanvasRef}
                        width={220}
                        height={220}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragRef.current = {
                            active: true,
                            startX: e.clientX,
                            startY: e.clientY,
                            baseX: cropOffset.x,
                            baseY: cropOffset.y,
                          };
                        }}
                        onPointerMove={(e) => {
                          if (!dragRef.current.active) return;
                          setCropOffset({
                            x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
                            y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
                          });
                        }}
                        onPointerUp={() => {
                          dragRef.current.active = false;
                        }}
                        style={{
                          width: 220,
                          height: 220,
                          borderRadius: 8,
                          border: "2px dashed #2563EB",
                          cursor: "grab",
                          touchAction: "none",
                          display: "block",
                        }}
                      />
                      <Slider
                        size="small"
                        value={cropZoom}
                        min={1}
                        max={3}
                        step={0.05}
                        onChange={(_, v) => setCropZoom(Number(v))}
                        sx={{ width: 220, mt: 0.5 }}
                      />
                    </Box>

                    {/* Simultaneous Square & Circle Previews (#7) */}
                    <Stack spacing={1.5} alignItems="center">
                      <Box textAlign="center">
                        <canvas
                          ref={squarePreviewRef}
                          width={144}
                          height={144}
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 14,
                            border: `2px solid ${colorHex}`,
                            display: "block",
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Square
                        </Typography>
                      </Box>
                      <Box textAlign="center">
                        <canvas
                          ref={circlePreviewRef}
                          width={144}
                          height={144}
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            border: `2px solid ${colorHex}`,
                            display: "block",
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Circle
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                ) : profileImageUrl ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VaultAvatar vault={{ ...previewVault, symbolMode: "IMAGE" }} size={60} shape="rounded" />
                    <VaultAvatar vault={{ ...previewVault, symbolMode: "IMAGE" }} size={60} shape="circle" />
                    <Typography variant="caption" color="text.secondary">
                      Saved avatar ready (Square &amp; Circle rendered simultaneously).
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Upload PNG, JPG, or WebP to open the interactive cropper.
                  </Typography>
                )}
              </Box>
            )}
          </Box>

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

          {/* Sub-Vault Configuration Section (#3 & #5) */}
          {isEdit ? (
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, bgcolor: "#EFF6FF", borderRadius: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                  Sub-Vaults &amp; Multi-Currency Pockets ({editVault.subContainers?.length || 0})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add pockets, switch currencies (IDR/USD/SGD), or sync partition splits.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                startIcon={<AccountBalanceWalletIcon />}
                onClick={() => {
                  closeVaultProfileDialog();
                  openSubVaultSyncDialog(editVault.id);
                }}
              >
                Manage Pockets
              </Button>
            </Stack>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Optional Sub-Vaults / Valas Pockets
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  label="Pocket Name"
                  placeholder="e.g. Utama, USD Travel"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                <TextField
                  select
                  size="small"
                  label="Currency"
                  value={newSubCurrency}
                  onChange={(e) => setNewSubCurrency(e.target.value)}
                  sx={{ width: { sm: 105 } }}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code}
                    </MenuItem>
                  ))}
                </TextField>
                <CurrencyTextField
                  label="Opening"
                  value={newSubInitBal}
                  onValueChange={(num) => setNewSubInitBal(num === "" ? "" : num)}
                  sx={{ width: { sm: 120 } }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddInitialSub}
                  sx={{ flexShrink: 0 }}
                >
                  Add
                </Button>
              </Stack>

              {subVaults.length > 0 && (
                <Stack spacing={0.75}>
                  {subVaults.map((sv) => (
                    <Stack
                      key={sv.tempId}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ px: 1.25, py: 0.6, borderRadius: 1.5, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Radio
                          size="small"
                          checked={sv.isDefault}
                          onChange={() =>
                            setSubVaults((prev) =>
                              prev.map((x) => ({ ...x, isDefault: x.tempId === sv.tempId }))
                            )
                          }
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {sv.name}
                        </Typography>
                        <Chip label={sv.currency} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                        {sv.isDefault && (
                          <Chip label="Default" size="small" color="primary" sx={{ fontSize: "0.68rem", height: 20 }} />
                        )}
                      </Stack>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setSubVaults((prev) => {
                            const next = prev.filter((x) => x.tempId !== sv.tempId);
                            if (next.length > 0 && !next.some((x) => x.isDefault)) {
                              next[0].isDefault = true;
                            }
                            return next;
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          )}
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
