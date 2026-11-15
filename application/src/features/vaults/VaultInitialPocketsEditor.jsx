"use client";

import React from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  MenuItem,
  Button,
  Radio,
  Chip,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CurrencyTextField from "@/components/CurrencyTextField";
import { SUPPORTED_CURRENCIES } from "@/shared/currencyHelpers";

export default function VaultInitialPocketsEditor({
  isEdit,
  editVault,
  onManagePockets,
  subVaults,
  setSubVaults,
  newSubName,
  setNewSubName,
  newSubCurrency,
  setNewSubCurrency,
  newSubInitBal,
  setNewSubInitBal,
  handleAddInitialSub,
}) {
  if (isEdit) {
    return (
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ p: 1.5, bgcolor: "#EFF6FF", borderRadius: 2 }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
            Sub-Vaults &amp; Multi-Currency Pockets ({editVault?.subContainers?.length || 0})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Add pockets, switch currencies (IDR/USD/SGD), or sync partition splits.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={onManagePockets}
        >
          Manage Pockets
        </Button>
      </Stack>
    );
  }

  return (
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
              sx={{
                px: 1.25,
                py: 0.6,
                borderRadius: 1.5,
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
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
                  <Chip
                    label="Default"
                    size="small"
                    color="primary"
                    sx={{ fontSize: "0.68rem", height: 20 }}
                  />
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
  );
}
