"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Alert,
  IconButton,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);
  const openFxSettingsDialog = useLedgerStore((s) => s.openFxSettingsDialog);

  const [layerInfoAnchor, setLayerInfoAnchor] = useState(null);

  // Add custom category state
  const [newName, setNewName] = useState("");
  const [newNature, setNewNature] = useState("EXPENSE");
  const [newLayer, setNewLayer] = useState("VARIABLE_ESSENTIAL");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Edit category modal state
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLayer, setEditLayer] = useState("VARIABLE_ESSENTIAL");
  const [savingEdit, setSavingEdit] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Session check failed");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: catData, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const json = await res.json();
      return json.data;
    },
  });

  const user = authData?.user;
  const baseCurrency = authData?.baseCurrency || "IDR";
  const categories = catData?.categories || [];
  const availableTemplates = catData?.availableTemplates || [];
  const spendingLayers = catData?.spendingLayers || [];

  const expenseCategories = categories.filter((c) => c.defaultNature === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.defaultNature === "INCOME");

  const refreshCategoryConsumers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleCreateCustomCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      enqueueToast("Category name is required", { severity: "warning" });
      return;
    }

    setCreatingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          defaultNature: newNature,
          commitmentType: newNature === "EXPENSE" ? newLayer : "NONE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to add category", { severity: "error" });
        return;
      }

      setNewName("");
      await refreshCategoryConsumers();
      enqueueToast(`Category "${json.data?.name}" created`, { severity: "success" });
    } catch {
      enqueueToast("Failed to create category", { severity: "error" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleEnableTemplate = async (tpl) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateCode: tpl.code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to enable template", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(`Added "${tpl.name}" to your categories`, { severity: "success" });
    } catch {
      enqueueToast("Failed to enable category template", { severity: "error" });
    }
  };

  const openEditDialog = (cat) => {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditLayer(cat.commitmentType || "VARIABLE_ESSENTIAL");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/categories/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          ...(editTarget.defaultNature === "EXPENSE" && !editTarget.isSystemLocked
            ? { commitmentType: editLayer }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update category", { severity: "error" });
        return;
      }
      setEditTarget(null);
      await refreshCategoryConsumers();
      enqueueToast("Category updated", { severity: "success" });
    } catch {
      enqueueToast("Failed to save category changes", { severity: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleArchive = async (cat) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update category status", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(
        json.data?.isActive ? `Restored "${cat.name}"` : `Archived "${cat.name}"`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to update category status", { severity: "error" });
    }
  };

  const handleDeleteCategory = async (cat) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Cannot delete category", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(
        json.data?.action === "ARCHIVED"
          ? `Archived "${cat.name}" because it has existing history`
          : `Deleted "${cat.name}"`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to delete category", { severity: "error" });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPasswordError(json.error || "Failed to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      enqueueToast("Password updated successfully", { severity: "success" });
    } catch {
      setPasswordError("Failed to contact server.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await queryClient.clear();
    router.replace("/login");
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
            Settings & Personalize
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B", mt: 0.25 }}>
            Customize your personal transaction categories, spending layers, currency, and account security.
          </Typography>
        </Box>

        {/* Top Row: Currency/Wizard + Account Security */}
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0", height: "100%" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Workspace Profile
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748B" }}>
                        @{user?.username || "—"} • Role: {user?.role || "USER"}
                      </Typography>
                    </Box>
                    <Chip
                      label={baseCurrency}
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 800 }}
                    />
                  </Stack>

                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#0F172A" }}>
                      {user?.fullName || "Personal Account"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748B" }}>
                      All vaults, categories, receipts, and transactions belong strictly to your profile.
                    </Typography>
                  </Box>

                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<CurrencyExchangeIcon />}
                      onClick={() => openFxSettingsDialog()}
                      sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      Currency & Exchange Rate Settings ({baseCurrency})
                    </Button>

                    <Button
                      component={Link}
                      href="/onboarding"
                      variant="outlined"
                      startIcon={<AutoAwesomeOutlinedIcon />}
                      sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      Re-run Lifestyle & Module Setup Wizard
                    </Button>

                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<LogoutOutlinedIcon />}
                      onClick={handleLogout}
                      sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      Sign Out
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0", height: "100%" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LockOutlinedIcon sx={{ color: "#2563EB", fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Account Security
                    </Typography>
                  </Stack>

                  {passwordError && <Alert severity="error">{passwordError}</Alert>}

                  <Box component="form" onSubmit={handlePasswordChange}>
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          size="small"
                          type="password"
                          label="Current Password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          fullWidth
                          disabled={changingPassword}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          size="small"
                          type="password"
                          label="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          fullWidth
                          disabled={changingPassword}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          size="small"
                          type="password"
                          label="Confirm New Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          fullWidth
                          disabled={changingPassword}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={changingPassword}
                          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                        >
                          {changingPassword ? "Updating..." : "Update Password"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Section: Personal Categories & Spending Layers */}
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0" }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    Categories & Spending Layers
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => setLayerInfoAnchor(e.currentTarget)}
                    aria-label="Spending layer explanation"
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
                  Select &ldquo;Type → Category&rdquo; when logging transactions
                </Typography>
              </Stack>

              {/* Create Custom Category Form */}
              <Box
                component="form"
                onSubmit={handleCreateCustomCategory}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 1.25 }}>
                  CREATE CUSTOM CATEGORY
                </Typography>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      size="small"
                      label="Category Name"
                      placeholder="e.g., Pet Care, Music Lessons"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      fullWidth
                      disabled={creatingCategory}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2.5 }}>
                    <TextField
                      select
                      size="small"
                      label="Type"
                      value={newNature}
                      onChange={(e) => setNewNature(e.target.value)}
                      fullWidth
                      disabled={creatingCategory}
                    >
                      <MenuItem value="EXPENSE">Expense</MenuItem>
                      <MenuItem value="INCOME">Income</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3.5 }}>
                    {newNature === "EXPENSE" ? (
                      <TextField
                        select
                        size="small"
                        label="Spending Layer"
                        value={newLayer}
                        onChange={(e) => setNewLayer(e.target.value)}
                        fullWidth
                        disabled={creatingCategory}
                      >
                        {spendingLayers.map((layer) => (
                          <MenuItem key={layer.key} value={layer.key}>
                            {layer.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        size="small"
                        label="Spending Layer"
                        value="Income (Non-Consumption)"
                        fullWidth
                        disabled
                      />
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={creatingCategory}
                      startIcon={<AddCircleOutlineIcon />}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, height: 40 }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {catsLoading ? (
                <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {/* Expense Categories */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 1.25 }}>
                      Expense Categories ({expenseCategories.length})
                    </Typography>
                    <Grid container spacing={1.25}>
                      {expenseCategories.map((cat) => {
                        const layerMeta = cat.spendingLayerMeta;
                        const usageCount =
                          (cat._count?.transactions || 0) + (cat._count?.actionCards || 0);

                        return (
                          <Grid key={cat.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                border: "1px solid #E2E8F0",
                                bgcolor: cat.isActive ? "#FFFFFF" : "#F8FAFC",
                                opacity: cat.isActive ? 1 : 0.68,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#0F172A" }} noWrap>
                                    {cat.name}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                                    <Chip
                                      size="small"
                                      label={layerMeta?.label || "Unassigned"}
                                      sx={{
                                        height: 20,
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        bgcolor: `${layerMeta?.colorHex || "#64748B"}18`,
                                        color: layerMeta?.colorHex || "#475569",
                                      }}
                                    />
                                    {cat.isSystemLocked && (
                                      <Chip
                                        size="small"
                                        label="System"
                                        sx={{ height: 20, fontSize: "0.66rem", fontWeight: 600 }}
                                      />
                                    )}
                                    {!cat.isActive && (
                                      <Chip
                                        size="small"
                                        label="Archived"
                                        color="default"
                                        sx={{ height: 20, fontSize: "0.66rem" }}
                                      />
                                    )}
                                  </Stack>
                                </Box>

                                {!cat.isSystemLocked && (
                                  <Stack direction="row" spacing={0.25}>
                                    <IconButton
                                      size="small"
                                      onClick={() => openEditDialog(cat)}
                                      title="Edit category"
                                    >
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleToggleArchive(cat)}
                                      title={cat.isActive ? "Archive category" : "Restore category"}
                                    >
                                      {cat.isActive ? (
                                        <ArchiveOutlinedIcon fontSize="small" />
                                      ) : (
                                        <RestoreFromTrashOutlinedIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                    {usageCount === 0 && (
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteCategory(cat)}
                                        title="Delete unused category"
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                  </Stack>
                                )}
                              </Stack>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Income Categories */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 1.25 }}>
                      Income Categories ({incomeCategories.length})
                    </Typography>
                    <Grid container spacing={1.25}>
                      {incomeCategories.map((cat) => {
                        const usageCount =
                          (cat._count?.transactions || 0) + (cat._count?.actionCards || 0);
                        return (
                          <Grid key={cat.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                border: "1px solid #E2E8F0",
                                bgcolor: cat.isActive ? "#FFFFFF" : "#F8FAFC",
                                opacity: cat.isActive ? 1 : 0.68,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                    {cat.name}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label="Income"
                                    sx={{
                                      mt: 0.5,
                                      height: 20,
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      bgcolor: "#DCFCE7",
                                      color: "#15803D",
                                    }}
                                  />
                                </Box>
                                {!cat.isSystemLocked && (
                                  <Stack direction="row" spacing={0.25}>
                                    <IconButton size="small" onClick={() => openEditDialog(cat)}>
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleToggleArchive(cat)}>
                                      {cat.isActive ? (
                                        <ArchiveOutlinedIcon fontSize="small" />
                                      ) : (
                                        <RestoreFromTrashOutlinedIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                    {usageCount === 0 && (
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteCategory(cat)}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                  </Stack>
                                )}
                              </Stack>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>

                  {/* Available Master Templates Quick-Add */}
                  {availableTemplates.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
                          Optional Category Templates ({availableTemplates.length})
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#64748B", display: "block", mb: 1.25 }}>
                          Tap any template below to add it to your active categories with pre-configured
                          accounting rules.
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {availableTemplates.map((tpl) => (
                            <Chip
                              key={tpl.code}
                              label={`+ ${tpl.name}`}
                              clickable
                              onClick={() => handleEnableTemplate(tpl)}
                              variant="outlined"
                              sx={{ fontWeight: 600, bgcolor: "#F8FAFC" }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </>
                  )}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Edit Category Dialog */}
      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Category</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Category Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />
            {editTarget?.defaultNature === "EXPENSE" && (
              <TextField
                select
                label="Spending Layer"
                value={editLayer}
                onChange={(e) => setEditLayer(e.target.value)}
                fullWidth
              >
                {spendingLayers.map((layer) => (
                  <MenuItem key={layer.key} value={layer.key}>
                    {layer.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditTarget(null)} color="inherit" sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingEdit || !editName.trim()}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {savingEdit ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* (i) Info Popover explaining simplified 2-step taxonomy + 4 Spending Layers */}
      <Popover
        open={Boolean(layerInfoAnchor)}
        anchorEl={layerInfoAnchor}
        onClose={() => setLayerInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 360 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            How Categories & Spending Layers Work
          </Typography>
          <Stack spacing={1}>
            {spendingLayers.map((layer) => (
              <Box key={layer.key}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: layer.colorHex }}>
                  {layer.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "#475569", display: "block" }}>
                  {layer.description}
                </Typography>
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: "#64748B", pt: 0.5 }}>
              When recording a transaction, simply pick Type → Category. Priority tiers and
              double-entry Chart of Accounts codes are derived automatically for journal exports.
            </Typography>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
}
