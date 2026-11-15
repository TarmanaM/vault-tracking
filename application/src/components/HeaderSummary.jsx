"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Popover,
  Button,
  Stack,
  Divider,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import MoneyValue from "@/components/MoneyValue";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function HeaderSummary({ summary, baseCurrency = "IDR" }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const openReconcileDialog = useLedgerStore((s) => s.openReconcileDialog);
  const openExportDialog = useLedgerStore((s) => s.openExportDialog);

  const handleInfoClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleInfoClose = () => {
    setAnchorEl(null);
  };

  const isPopoverOpen = Boolean(anchorEl);

  if (!summary) return null;

  return (
    <Card sx={{ bgcolor: "#1E293B", color: "#FFFFFF", mb: { xs: 2, sm: 3 } }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="overline" sx={{ color: "#94A3B8", letterSpacing: 1.2, fontWeight: 700, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
                TOTAL NET WEALTH
              </Typography>
              <IconButton size="small" onClick={handleInfoClick} sx={{ color: "#94A3B8", p: 0.25 }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                mt: 0.25,
                letterSpacing: -0.5,
                fontSize: { xs: "1.4rem", sm: "2rem" },
              }}
            >
              <MoneyValue value={summary.netTotalWealth} currency={baseCurrency} includeCents allowTapToggle />
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexShrink={0}>
            <Button
              variant="outlined"
              size="small"
              onClick={openExportDialog}
              startIcon={<FileDownloadOutlinedIcon />}
              sx={{
                px: { xs: 1, sm: 1.5 },
                fontSize: { xs: "0.72rem", sm: "0.8rem" },
                color: "#E2E8F0",
                borderColor: "#475569",
                "&:hover": { borderColor: "#94A3B8", bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              Export
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => openReconcileDialog(null)}
              startIcon={<SyncAltIcon />}
              sx={{
                px: { xs: 1, sm: 1.5 },
                fontSize: { xs: "0.72rem", sm: "0.8rem" },
                bgcolor: "#2563EB",
                "&:hover": { bgcolor: "#1D4ED8" },
              }}
            >
              Audit Vault
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: { xs: 1.25, sm: 2 }, borderColor: "rgba(255,255,255,0.1)" }} />

        {/* Quick Wealth Distribution Metrics */}
        <Stack direction="row" spacing={{ xs: 2, sm: 4 }} sx={{ overflowX: "auto", pb: 0.5 }}>
          <Box>
            <Typography variant="caption" sx={{ color: "#94A3B8", display: "block" }}>
              Liquid Funds (Banks &amp; Cash)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "#10B981" }}>
              <MoneyValue value={summary.liquidWealth} currency={baseCurrency} allowTapToggle />
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: "#94A3B8", display: "block" }}>
              Third-Party Receivables (Piutang)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "#38BDF8" }}>
              <MoneyValue value={summary.totalReceivables} currency={baseCurrency} allowTapToggle />
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: "#94A3B8", display: "block" }}>
              Payables &amp; PayLater
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "#F87171" }}>
              <MoneyValue value={summary.totalPayables} currency={baseCurrency} allowTapToggle />
            </Typography>
          </Box>
        </Stack>
      </CardContent>

      {/* Info Button Popover (Rule 11) */}
      <Popover
        open={isPopoverOpen}
        anchorEl={anchorEl}
        onClose={handleInfoClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { p: 2, maxWidth: 340, borderRadius: 2 } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Net Wealth Formula
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: "0.85rem" }}>
          Net Wealth is calculated using real-time double-entry balances:
        </Typography>
        <Box sx={{ bgcolor: "#F1F5F9", p: 1.5, borderRadius: 1.5, fontSize: "0.8rem", fontFamily: "monospace" }}>
          Net Wealth = (Liquid Vaults + Receivables) - (Payables &amp; PayLater)
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          • Exact cent decimals (.21/.67) are preserved using decimal.js without rounding errors.
        </Typography>
      </Popover>
    </Card>
  );
}

