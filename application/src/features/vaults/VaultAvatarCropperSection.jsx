"use client";

import React, { useEffect, useRef } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  Tabs,
  Tab,
  Chip,
  Button,
  Slider,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import VaultAvatar, { VAULT_ICON_OPTIONS } from "@/components/vaults/VaultAvatar";

export const COLOR_SWATCHES = [
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

export function drawCroppedToCanvas(canvas, loadedImg, zoom, offsetX, offsetY, stageSize = 220) {
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

/**
 * Render cropped canvas to compressed WebP blob (quality 0.85) with PNG fallback.
 */
export async function renderCroppedWebpBlob(loadedImg, zoom, offsetX, offsetY, stageSize = 220) {
  const offscreen = document.createElement("canvas");
  offscreen.width = 512;
  offscreen.height = 512;
  drawCroppedToCanvas(offscreen, loadedImg, zoom, offsetX, offsetY, stageSize);

  let blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/webp", 0.85));
  let fileName = "vault-avatar.webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/png"));
    fileName = "vault-avatar.png";
  }
  if (!blob) {
    throw new Error("Failed to render cropped image");
  }
  return { blob, fileName };
}

export default function VaultAvatarCropperSection({
  colorHex,
  setColorHex,
  symbolMode,
  setSymbolMode,
  iconName,
  setIconName,
  previewVault,
  rawImageObj,
  profileImageUrl,
  uploadingCrop,
  handleFileSelect,
  uploadCroppedCanvas,
  cropZoom,
  setCropZoom,
  cropOffset,
  setCropOffset,
}) {
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const stageCanvasRef = useRef(null);
  const squarePreviewRef = useRef(null);
  const circlePreviewRef = useRef(null);

  useEffect(() => {
    if (!rawImageObj) return;
    drawCroppedToCanvas(stageCanvasRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
    drawCroppedToCanvas(squarePreviewRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
    drawCroppedToCanvas(circlePreviewRef.current, rawImageObj, cropZoom, cropOffset.x, cropOffset.y, 220);
  }, [rawImageObj, cropZoom, cropOffset]);

  const tabIndex = symbolMode === "ICON" ? 1 : symbolMode === "IMAGE" ? 2 : 0;

  return (
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
                Saved WebP avatar ready (Square &amp; Circle rendered simultaneously).
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Upload PNG, JPG, or WebP to open the interactive cropper (stored compressed as WebP).
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
