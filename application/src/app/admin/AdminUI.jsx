"use client";

import React from "react";
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import Link from "next/link";
import { useAdminLogic } from "./useAdminLogic";

export default function AdminUI() {
  const {
    currentUser,
    isAdmin,
    users,
    isLoading,
    fetchError,
    infoAnchor,
    setInfoAnchor,
    createOpen,
    setCreateOpen,
    newUsername,
    setNewUsername,
    newFullName,
    setNewFullName,
    newRole,
    setNewRole,
    newTempPassword,
    setNewTempPassword,
    creating,
    createError,
    setCreateError,
    resetTarget,
    setResetTarget,
    resetPassword,
    setResetPassword,
    resetting,
    resetError,
    setResetError,
    deleteTarget,
    setDeleteTarget,
    deleteConfirmUsername,
    setDeleteConfirmUsername,
    deleting,
    deleteError,
    setDeleteError,
    handleCreateUser,
    handleToggleActive,
    handleResetPassword,
    handleDeleteUser,
  } = useAdminLogic();

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
                            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600, display: "block" }}>
                              @{u.username} • Created {new Date(u.createdAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600, display: "block" }}>
                              Last sign-in:{" "}
                              {u.lastLoginAt
                                ? new Date(u.lastLoginAt).toLocaleString(undefined, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "Not recorded yet"}
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

                          <Stack direction="row" spacing={0.75}>
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

                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={isSelf}
                              startIcon={<DeleteOutlineIcon fontSize="small" />}
                              onClick={() => {
                                setDeleteError("");
                                setDeleteConfirmUsername("");
                                setDeleteTarget(u);
                              }}
                              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                            >
                              Delete
                            </Button>
                          </Stack>
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: "#DC2626" }}>
          Delete Account — @{deleteTarget?.username}
        </DialogTitle>
        <Box component="form" onSubmit={handleDeleteUser}>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {deleteError && <Alert severity="error">{deleteError}</Alert>}
              <Alert severity="error" sx={{ fontSize: "0.82rem" }}>
                Permanently deletes <strong>{deleteTarget?.fullName}</strong> (@{deleteTarget?.username}) and all of their vaults, transactions, action cards, and media. This cannot be undone.
              </Alert>
              <TextField
                label={`Type "${deleteTarget?.username || ""}" to confirm`}
                value={deleteConfirmUsername}
                onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                fullWidth
                required
                disabled={deleting}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDeleteTarget(null)} color="inherit" disabled={deleting} sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={
                deleting ||
                deleteConfirmUsername.trim().replace(/^@/, "").toLowerCase() !==
                  (deleteTarget?.username || "").toLowerCase()
              }
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {deleting ? "Deleting..." : "Delete Account"}
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
            Dual-Capability &amp; Zero-Cross-Access
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
