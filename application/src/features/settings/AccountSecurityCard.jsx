"use client";

import React from "react";
import {
  Grid,
  Card,
  CardContent,
  Stack,
  Box,
  Typography,
  Chip,
  Button,
  Alert,
  TextField,
} from "@mui/material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import Link from "next/link";

export default function AccountSecurityCard({
  user,
  baseCurrency,
  openFxSettingsDialog,
  handleLogout,
  passwordError,
  handlePasswordChange,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  changingPassword,
}) {
  return (
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
                  All vaults, categories, media avatars, and transactions belong strictly to your profile.
                </Typography>
              </Box>

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<CurrencyExchangeIcon />}
                  onClick={() => openFxSettingsDialog()}
                  sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                >
                  Currency &amp; Exchange Rate Settings ({baseCurrency})
                </Button>

                <Button
                  component={Link}
                  href="/onboarding"
                  variant="outlined"
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                >
                  Re-run Lifestyle &amp; Module Setup Wizard
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
  );
}
