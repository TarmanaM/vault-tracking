"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Failed to update password.");
        return;
      }

      const updatedUser = json.data?.user;
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });

      if (!updatedUser?.onboardingCompleted && !updatedUser?.onboardingSkipped) {
        router.replace("/onboarding");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Failed to contact server while updating password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await queryClient.clear();
    router.replace("/login");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        background: "linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%)",
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 4,
          border: "1px solid #E2E8F0",
          boxShadow: "0 18px 40px -24px rgba(15, 23, 42, 0.25)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2.5,
                    bgcolor: "#FEF3C7",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <VpnKeyOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
                    Set Personal Password
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
                    Required Security Step
                  </Typography>
                </Box>
              </Stack>

              <Button
                size="small"
                color="inherit"
                onClick={handleLogout}
                startIcon={<LogoutOutlinedIcon fontSize="small" />}
                sx={{ textTransform: "none", color: "#64748B" }}
              >
                Sign Out
              </Button>
            </Stack>

            <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.84rem" }}>
              Your account is currently using a temporary password provisioned by an administrator.
              Choose a private password that only you know before opening your ledger.
            </Alert>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Current / Temporary Password"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                  required
                  disabled={submitting}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPasswords((prev) => !prev)}
                            edge="end"
                          >
                            {showPasswords ? (
                              <VisibilityOffOutlinedIcon fontSize="small" />
                            ) : (
                              <VisibilityOutlinedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  label="New Personal Password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Minimum 6 characters; cannot match your temporary password."
                  fullWidth
                  required
                  disabled={submitting}
                />

                <TextField
                  label="Confirm New Password"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  required
                  disabled={submitting}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                  sx={{
                    py: 1.3,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: "none",
                  }}
                >
                  {submitting ? "Updating Password..." : "Save Password & Continue"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
