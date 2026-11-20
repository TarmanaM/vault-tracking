"use client";

import React from "react";
import { Box, Stack, Typography, Chip, Alert } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import VaultAvatar from "@/components/vaults/VaultAvatar";
import MoneyValue from "@/components/common/MoneyValue";
import CurrencyTextField from "@/components/common/CurrencyTextField";

export default function TransactionVaultAndTransferSection({
  needsVaultSelection,
  nature,
  vaults,
  sourceVaultId,
  handleSelectSourceVault,
  selectedSourceVaultObj,
  sourceSubContainerId,
  handleSelectSourceSub,
  potentialSpilloverHint,
  targetVaultId,
  handleSelectTargetVault,
  selectedTargetVaultObj,
  targetSubContainerId,
  setTargetSubContainerId,
  selectedTargetSubObj,
  entryCurrency,
  baseUpper,
  targetTransferAmount,
  setTargetTransferAmount,
}) {
  return (
    <>
      {needsVaultSelection && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 0.75 }}>
            {nature === "INCOME" || nature === "RECEIVABLE_COLLECT"
              ? "DESTINATION VAULT"
              : nature === "TRANSFER"
              ? "FROM SOURCE VAULT"
              : "PAYMENT VAULT"}
          </Typography>

          <Box
            sx={{
              display: "flex",
              gap: 0.75,
              overflowX: "auto",
              pb: 0.75,
              "&::-webkit-scrollbar": { height: 5 },
            }}
          >
            {vaults.map((v) => {
              const selected = String(v.id) === String(sourceVaultId);
              return (
                <Chip
                  key={v.id}
                  avatar={<VaultAvatar vault={v} size={22} shape="circle" />}
                  label={v.name}
                  clickable
                  onClick={() => handleSelectSourceVault(v.id)}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  sx={{
                    height: 32,
                    fontWeight: selected ? 800 : 600,
                    flexShrink: 0,
                    borderColor: selected ? undefined : "#CBD5E1",
                  }}
                />
              );
            })}
          </Box>

          {selectedSourceVaultObj?.subContainers?.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75, alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.5 }}>
                Pocket:
              </Typography>
              {selectedSourceVaultObj.subContainers.map((sc) => {
                const isPicked = String(sc.id) === String(sourceSubContainerId);
                const bal = sc.effectiveBalance ?? sc.currentBalance ?? sc.lastCountedBalance;
                return (
                  <Chip
                    key={sc.id}
                    size="small"
                    clickable
                    onClick={() => handleSelectSourceSub(sc)}
                    color={isPicked ? "secondary" : "default"}
                    variant={isPicked ? "filled" : "outlined"}
                    label={
                      <>
                        {sc.name} ({sc.currency}): <MoneyValue value={bal} currency={sc.currency || baseUpper} />
                      </>
                    }
                    sx={{ height: 24, fontSize: "0.7rem", fontWeight: isPicked ? 700 : 500 }}
                  />
                );
              })}
            </Stack>
          )}

          {potentialSpilloverHint && (
            <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mt: 1, py: 0.4 }}>
              <Typography variant="caption">{potentialSpilloverHint}</Typography>
            </Alert>
          )}
        </Box>
      )}

      {nature === "TRANSFER" && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <ArrowForwardIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#1E3A8A" }}>
              TO TARGET VAULT
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "flex",
              gap: 0.75,
              overflowX: "auto",
              pb: 0.75,
            }}
          >
            {vaults.map((v) => {
              const selected = String(v.id) === String(targetVaultId);
              return (
                <Chip
                  key={v.id}
                  avatar={<VaultAvatar vault={v} size={22} shape="circle" />}
                  label={v.name}
                  clickable
                  onClick={() => handleSelectTargetVault(v.id)}
                  color={selected ? "info" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  sx={{ height: 32, fontWeight: selected ? 800 : 600, flexShrink: 0 }}
                />
              );
            })}
          </Box>

          {selectedTargetVaultObj?.subContainers?.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.5 }}>
                Target Pocket:
              </Typography>
              {selectedTargetVaultObj.subContainers.map((sc) => {
                const isPicked = String(sc.id) === String(targetSubContainerId);
                return (
                  <Chip
                    key={sc.id}
                    size="small"
                    clickable
                    onClick={() => setTargetSubContainerId(String(sc.id))}
                    color={isPicked ? "info" : "default"}
                    variant={isPicked ? "filled" : "outlined"}
                    label={`${sc.name} (${sc.currency})`}
                    sx={{ height: 24, fontSize: "0.7rem", fontWeight: isPicked ? 700 : 500 }}
                  />
                );
              })}
            </Stack>
          )}

          {selectedTargetSubObj &&
            String(selectedTargetSubObj.currency || baseUpper).toUpperCase() !== entryCurrency && (
              <Box sx={{ mt: 1.25 }}>
                <CurrencyTextField
                  label={`Received in ${selectedTargetSubObj.currency} (Optional override)`}
                  value={targetTransferAmount}
                  onValueChange={(num) => setTargetTransferAmount(num)}
                  helperText={`Leave blank to auto-convert via cached FX rate into ${selectedTargetSubObj.currency}.`}
                />
              </Box>
            )}
        </Box>
      )}
    </>
  );
}
