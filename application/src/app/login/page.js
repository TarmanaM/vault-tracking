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
  IconButton,
  InputAdornment,
  Popover,
  CircularProgress,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Sign in failed. Please check your credentials.");
        return;
      }

      const loggedInUser = json.data?.user;
      await queryClient.clear();

      if (loggedInUser?.mustChangePassword) {
        router.replace("/force-password-change");
      } else if (!loggedInUser?.onboardingCompleted && !loggedInUser?.onboardingSkipped) {
        router.replace("/onboarding");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please verify your local connection.");
    } finally {
      setSubmitting(false);
    }
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
          maxWidth: 420,
          borderRadius: 4,
          border: "1px solid #E2E8F0",
          boxShadow: "0 18px 40px -24px rgba(15, 23, 42, 0.28)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2.5,
                    bgcolor: "#2563EB",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AccountBalanceWalletOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
                    Vault Tracking
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
                    Private Personal Ledger v2.0
                  </Typography>
                </Box>
              </Stack>

              <IconButton
                size="small"
                onClick={(e) => setInfoAnchor(e.currentTarget)}
                aria-label="Account provisioning info"
                sx={{ color: "#64748B" }}
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
                Sign In
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                Access your isolated vaults, action cards, and double-entry ledger.
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  fullWidth
                  required
                  disabled={submitting}
                />

                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  fullWidth
                  required
                  disabled={submitting}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                            aria-label="Toggle password visibility"
                          >
                            {showPassword ? (
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

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={submitting}
                  startIcon={
                    submitting ? <CircularProgress size={18} color="inherit" /> : <LockOutlinedIcon />
                  }
                  sx={{
                    py: 1.35,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "0.98rem",
                  }}
                >
                  {submitting ? "Signing In..." : "Sign In"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Closed Family & Private Instance
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.82rem", lineHeight: 1.5 }}>
            Public self-registration is disabled for security. New accounts and password resets are
            provisioned by your server administrator, while your financial balances and transactions
            remain strictly private to your own account.
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
