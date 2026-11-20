"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Popover,
  Divider,
} from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import SkipNextOutlinedIcon from "@mui/icons-material/SkipNextOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import { useOnboardingLogic } from "./useOnboardingLogic";

export default function OnboardingUI() {
  const {
    data,
    isLoading,
    initialized,
    user,
    alreadyCompleted,
    baseCurrency,
    setBaseCurrency,
    selectedModules,
    vaultConfig,
    submittingMode,
    error,
    infoAnchor,
    setInfoAnchor,
    handleToggleModule,
    handleVaultChange,
    handleSubmit,
  } = useOnboardingLogic();

  if (isLoading || !initialized) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#F8FAFC",
        py: { xs: 3, sm: 5 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ maxWidth: 860, mx: "auto" }}>
        <Stack spacing={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: "1px solid #E2E8F0",
              background: "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)",
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <Chip
                      icon={<AutoAwesomeOutlinedIcon />}
                      label={alreadyCompleted ? "Re-run Setup" : "Quick Setup"}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700 }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => setInfoAnchor(e.currentTarget)}
                      aria-label="Onboarding wizard help"
                    >
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    Welcome{user?.fullName ? `, ${user.fullName}` : ""}! Tailor Your Ledger
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#475569", mt: 0.5 }}>
                    Choose your base currency, lifestyle modules, and starter vaults — or skip straight
                    to a ready-to-use default setup.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
                  {alreadyCompleted ? (
                    <Button
                      component={Link}
                      href="/settings"
                      variant="outlined"
                      startIcon={<ArrowBackOutlinedIcon />}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      Back to Settings
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="inherit"
                      fullWidth
                      disabled={Boolean(submittingMode)}
                      onClick={() => handleSubmit("SKIP")}
                      endIcon={
                        submittingMode === "SKIP" ? (
                          <CircularProgress size={16} />
                        ) : (
                          <SkipNextOutlinedIcon />
                        )
                      }
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 2.5,
                        borderColor: "#CBD5E1",
                        bgcolor: "#FFFFFF",
                      }}
                    >
                      {submittingMode === "SKIP" ? "Preparing..." : "Skip & Use Default"}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {error && <Alert severity="error">{error}</Alert>}

          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0" }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    1. Primary Currency
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748B" }}>
                    Used as your Net Wealth summary and default vault currency. Foreign currency
                    sub-vaults can still be added later.
                  </Typography>
                </Box>

                <TextField
                  select
                  label="Base Currency"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  sx={{ maxWidth: 320 }}
                >
                  {(data?.supportedCurrencies || []).map((ccy) => (
                    <MenuItem key={ccy.code} value={ccy.code}>
                      {ccy.code} — {ccy.name} ({ccy.symbol})
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0" }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    2. Lifestyle &amp; Category Packs
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748B" }}>
                    Core income, food, health, and transfer categories are always included. Enable
                    the habits that match your routine.
                  </Typography>
                </Box>

                <Grid container spacing={1.5}>
                  {(data?.onboardingModules || []).map((mod) => {
                    const checked = Boolean(selectedModules[mod.key]);
                    return (
                      <Grid key={mod.key} size={{ xs: 12, sm: 6 }}>
                        <Box
                          onClick={() => handleToggleModule(mod.key)}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: "1px solid",
                            borderColor: checked ? "#2563EB" : "#E2E8F0",
                            bgcolor: checked ? "#EFF6FF" : "#FFFFFF",
                            cursor: "pointer",
                            height: "100%",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                {mod.question}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#475569", display: "block", mt: 0.5 }}>
                                {mod.description}
                              </Typography>
                            </Box>
                            <Switch
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleToggleModule(mod.key)}
                              color="primary"
                            />
                          </Stack>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0" }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                    3. Starter Vaults {alreadyCompleted ? "(Add Missing Vaults)" : "& Opening Balances"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748B" }}>
                    Choose where you keep money today. You can customize names, currencies, or add
                    more banks and cards anytime.
                  </Typography>
                </Box>

                <Grid container spacing={1.5}>
                  {vaultConfig.map((vault) => (
                    <Grid key={vault.key} size={{ xs: 12, sm: 6 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: vault.enabled ? "#2563EB" : "#E2E8F0",
                          bgcolor: vault.enabled ? "#FFFFFF" : "#F8FAFC",
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  bgcolor: vault.colorHex,
                                }}
                              />
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {vault.defaultName}
                              </Typography>
                            </Stack>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={vault.enabled}
                                  onChange={(e) => handleVaultChange(vault.key, "enabled", e.target.checked)}
                                />
                              }
                              label={vault.enabled ? "Included" : "Off"}
                              labelPlacement="start"
                              sx={{ m: 0 }}
                            />
                          </Stack>

                          {vault.enabled && (
                            <Stack spacing={1.25}>
                              <TextField
                                size="small"
                                label="Vault Label"
                                value={vault.customName}
                                onChange={(e) =>
                                  handleVaultChange(vault.key, "customName", e.target.value)
                                }
                                fullWidth
                              />
                              {!alreadyCompleted && (
                                <CurrencyTextField
                                  currency={baseCurrency}
                                  size="small"
                                  label={`Opening Balance (${baseCurrency}, optional)`}
                                  value={vault.openingBalance}
                                  onValueChange={(num) =>
                                    handleVaultChange(vault.key, "openingBalance", num)
                                  }
                                  showClear
                                />
                              )}
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          <Divider />

          <Stack
            direction={{ xs: "column-reverse", sm: "row" }}
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
          >
            {!alreadyCompleted ? (
              <Button
                variant="text"
                color="inherit"
                disabled={Boolean(submittingMode)}
                onClick={() => handleSubmit("SKIP")}
                sx={{ textTransform: "none", fontWeight: 700, color: "#64748B" }}
              >
                Skip setup — create default Cash Wallet &amp; Main Bank
              </Button>
            ) : (
              <Box />
            )}

            <Button
              variant="contained"
              size="large"
              disabled={Boolean(submittingMode)}
              onClick={() => handleSubmit("INTERVIEW")}
              startIcon={
                submittingMode === "INTERVIEW" ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CheckCircleOutlineIcon />
                )
              }
              sx={{
                px: 3.5,
                py: 1.35,
                borderRadius: 2.5,
                fontWeight: 800,
                textTransform: "none",
                width: { xs: "100%", sm: "auto" },
              }}
            >
              {submittingMode === "INTERVIEW"
                ? "Configuring Workspace..."
                : alreadyCompleted
                ? "Apply Category & Vault Updates"
                : "Finish Setup & Open Dashboard"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 340 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            How Personalization Works
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.82rem", lineHeight: 1.55 }}>
            Your answers pre-install relevant categories across the 4 Spending Layers (Fixed &amp; Bills,
            Everyday Needs, Lifestyle &amp; Wants, Giving &amp; Gifts) and generate neutral Quick Action Cards.
            Accounting Priority Tiers and Chart of Accounts mappings happen silently behind the scenes
            when you export journals.
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
