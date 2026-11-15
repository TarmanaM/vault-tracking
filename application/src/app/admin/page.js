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
  Chip,
  Alert,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Popover,
  CircularProgress,
  Grid,
} from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);

  const [infoAnchor, setInfoAnchor] = useState(null);

  // Create User dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [newTempPassword, setNewTempPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Reset Password dialog state
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to verify session");
      const json = await res.json();
      return json.data;
    },
  });

  const currentUser = authData?.user;
  const isAdmin = currentUser?.role === "ADMIN";

  const {
    data: users = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["admin-users"],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load accounts");
      }
      return json.data || [];
    },
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim().toLowerCase(),
          fullName: newFullName.trim(),
          role: newRole,
          temporaryPassword: newTempPassword,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setCreateError(json.error || "Failed to create account");
        return;
      }

      setCreateOpen(false);
      setNewUsername("");
      setNewFullName("");
      setNewRole("USER");
      setNewTempPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(`Created account "@${json.data?.username}"`, { severity: "success" });
    } catch {
      setCreateError("Server error while creating account");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update account status", { severity: "error" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(
        json.data?.isActive
          ? `Activated @${targetUser.username}`
          : `Deactivated @${targetUser.username}`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to update user status", { severity: "error" });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetting(true);

    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_PASSWORD",
          temporaryPassword: resetPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setResetError(json.error || "Failed to reset password");
        return;
      }

      setResetTarget(null);
      setResetPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(
        `Temporary password set for @${resetTarget.username}. User must change it at next login.`,
        { severity: "success" }
      );
    } catch {
      setResetError("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  if (currentUser && !isAdmin) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button component={Link} href="/" color="inherit" size="small">
              Go Home
            </Button>
          }
        >
          Administrator permission is required to view this console.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: "auto" }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <AdminPanelSettingsOutlinedIcon sx={{ color: "#2563EB" }} />
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
                Admin User Provisioning
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => setInfoAnchor(e.currentTarget)}
                aria-label="Privacy boundary explanation"
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="body2" sx={{ color: "#64748B", mt: 0.25 }}>
              Create closed accounts, activate or deactivate access, and issue temporary password resets.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<PersonAddAlt1OutlinedIcon />}
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5 }}
          >
            Create User
          </Button>
        </Stack>

        {/* Strict Privacy Notice */}
        <Alert icon={<ShieldOutlinedIcon />} severity="info" sx={{ borderRadius: 2.5 }}>
          Privacy Boundary Active: Administrators only manage account credentials and status metadata.
          Other users&apos; vaults, balances, categories, debts, transactions, and media remain invisible.
        </Alert>

        {fetchError && <Alert severity="error">{fetchError.message}</Alert>}

        {isLoading ? (
          <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <Grid key={u.id} size={{ xs: 12, md: 6 }}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: "1px solid #E2E8F0",
                      opacity: u.isActive ? 1 : 0.72,
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                              {u.fullName} {isSelf ? "(You)" : ""}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
                              @{u.username} • Created {new Date(u.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>

                          <Chip
                            size="small"
                            label={u.role}
                            color={u.role === "ADMIN" ? "primary" : "default"}
                            sx={{ fontWeight: 700 }}
                          />
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={u.isActive ? "Active" : "Deactivated"}
                            color={u.isActive ? "success" : "error"}
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                          <Chip
                            size="small"
                            label={
                              u.onboardingCompleted
                                ? "Onboarded"
                                : u.onboardingSkipped
                                ? "Default Preset"
                                : "Pending Setup"
                            }
                            variant="outlined"
                          />
                          {u.mustChangePassword && (
                            <Chip
                              size="small"
                              label="Must Change Password"
                              color="warning"
                              sx={{ fontWeight: 700 }}
                            />
                          )}
                        </Stack>

                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ pt: 1, borderTop: "1px solid #F1F5F9" }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Switch
                              size="small"
                              checked={u.isActive}
                              disabled={isSelf}
                              onChange={() => handleToggleActive(u)}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>
                              {u.isActive ? "Access Enabled" : "Access Disabled"}
                            </Typography>
                          </Stack>

                          <Button
                            size="small"
                            variant="outlined"
                            disabled={isSelf}
                            startIcon={<LockResetOutlinedIcon fontSize="small" />}
                            onClick={() => {
                              setResetError("");
                              setResetPassword("");
                              setResetTarget(u);
                            }}
                            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                          >
                            Reset Password
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Stack>

      {/* Create User Modal */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Private Account</DialogTitle>
        <Box component="form" onSubmit={handleCreateUser}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {createError && <Alert severity="error">{createError}</Alert>}
              <TextField
                label="Username"
                placeholder="e.g., sarah"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                helperText="Lowercase letters, numbers, dot, underscore, or hyphen (3-32 chars)."
                fullWidth
                required
              />
              <TextField
                label="Display / Full Name"
                placeholder="e.g., Sarah"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                select
                label="Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                fullWidth
              >
                <MenuItem value="USER">USER (Personal Ledger)</MenuItem>
                <MenuItem value="ADMIN">ADMIN (User Management + Own Ledger)</MenuItem>
              </TextField>
              <TextField
                label="Temporary Password"
                type="password"
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                helperText="Minimum 6 characters. User will be forced to change this on first login."
                fullWidth
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setCreateOpen(false)} color="inherit" sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {creating ? "Creating..." : "Create Account"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={Boolean(resetTarget)} onClose={() => setResetTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Reset Password — @{resetTarget?.username}
        </DialogTitle>
        <Box component="form" onSubmit={handleResetPassword}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {resetError && <Alert severity="error">{resetError}</Alert>}
              <Alert severity="warning" sx={{ fontSize: "0.82rem" }}>
                Setting a temporary password marks this account with{" "}
                <strong>Must Change Password</strong> on next login.
              </Alert>
              <TextField
                label="New Temporary Password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                helperText="Minimum 6 characters."
                fullWidth
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setResetTarget(null)} color="inherit" sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={resetting}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {resetting ? "Resetting..." : "Set Temporary Password"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 340 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
            Dual-Capability & Zero-Cross-Access
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.82rem", lineHeight: 1.55 }}>
            Admin accounts manage their own private personal finance ledger just like normal users, while
            gaining access to this account provisioning console. Deactivating an account blocks their
            session immediately on their next request.
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
