"use client";

import React, { useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import MoneyValue from "@/components/common/MoneyValue";

const COIN_DENOM_CHIPS = [100, 200, 500, 1000];

export default function CoinExpenseControls({
  grossAmount = 0,
  coinMode = "NONE", // "NONE" | "SPLIT" | "CHANGE"
  onCoinModeChange,
  coinUsedAmount = "",
  onCoinUsedChange,
  coinChangeAmount = "",
  onCoinChangeAmount,
  compact = false,
}) {
  // Optional helper for paper cash change so user can sanity-check cash handed over (e.g. 50.000)
  const [paperChangeHelper, setPaperChangeHelper] = useState("");

  const grossNum = Number(grossAmount) || 0;
  const coinUsedNum = Number(coinUsedAmount) || 0;
  const coinChangeNum = Number(coinChangeAmount) || 0;
  const paperChangeNum = Number(paperChangeHelper) || 0;

  const handleSelectMode = (nextMode) => {
    if (nextMode === "NONE") {
      onCoinUsedChange?.("");
      onCoinChangeAmount?.("");
      setPaperChangeHelper("");
    } else if (nextMode === "SPLIT") {
      onCoinChangeAmount?.("");
      setPaperChangeHelper("");
    } else if (nextMode === "CHANGE") {
      onCoinUsedChange?.("");
    }
    onCoinModeChange?.(nextMode);
  };

  const addDenom = (denom) => {
    if (coinMode === "SPLIT") {
      onCoinUsedChange?.((Number(coinUsedAmount) || 0) + denom);
    } else if (coinMode === "CHANGE") {
      onCoinChangeAmount?.((Number(coinChangeAmount) || 0) + denom);
    }
  };

  const splitExceedsGross = coinMode === "SPLIT" && grossNum > 0 && coinUsedNum > grossNum;
  const cashSplitPart = Math.max(0, grossNum - coinUsedNum);
  const netCashOutflowWithChange = grossNum + coinChangeNum;
  const totalCashHandedEstimate = grossNum + coinChangeNum + paperChangeNum;

  return (
    <Box
      sx={{
        p: compact ? 1 : 1.5,
        borderRadius: 1.5,
        bgcolor: "#F8FAFC",
        border: "1px solid #E2E8F0",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", display: "block", mb: 0.75 }}>
        CASH COIN OPTIONS
      </Typography>

      {/* Mode Switcher */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: coinMode === "NONE" ? 0 : 1 }}>
        {[
          { value: "NONE", label: "Cash Only" },
          { value: "SPLIT", label: "Pay w/ Coin" },
          { value: "CHANGE", label: "Got Coin Change" },
        ].map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            clickable
            color={coinMode === opt.value ? "primary" : "default"}
            variant={coinMode === opt.value ? "filled" : "outlined"}
            onClick={() => handleSelectMode(opt.value)}
            sx={{ height: 24, fontSize: "0.7rem", fontWeight: 700 }}
          />
        ))}
      </Stack>

      {/* Mode 1: Cash + Coin Split Payment */}
      {coinMode === "SPLIT" && (
        <Stack spacing={0.85}>
          <CurrencyTextField
            label="Paid from COIN Vault"
            value={coinUsedAmount}
            onValueChange={(num) => onCoinUsedChange?.(num)}
            showClear
          />

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
            {COIN_DENOM_CHIPS.map((d) => (
              <Chip
                key={d}
                label={`+${d >= 1000 ? "1K" : d}`}
                size="small"
                clickable
                onClick={() => addDenom(d)}
                sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700, bgcolor: "#FEF3C7", color: "#92400E" }}
              />
            ))}
          </Stack>

          {splitExceedsGross ? (
            <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
              Coin payment cannot exceed total transaction amount.
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Breakdown: CASH -<MoneyValue value={cashSplitPart} /> + COIN -<MoneyValue value={coinUsedNum} />
            </Typography>
          )}
        </Stack>
      )}

      {/* Mode 2: Cash Handed Over + Coin Change Returned to COIN */}
      {coinMode === "CHANGE" && (
        <Stack spacing={0.85}>
          <Stack direction={{ xs: "column", sm: compact ? "column" : "row" }} spacing={1}>
            <CurrencyTextField
              label="Coin Change (to COIN)"
              value={coinChangeAmount}
              onValueChange={(num) => onCoinChangeAmount?.(num)}
              showClear
            />
            <CurrencyTextField
              label="Paper Change to CASH (Optional)"
              value={paperChangeHelper}
              onValueChange={(num) => setPaperChangeHelper(num)}
              showClear
            />
          </Stack>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
            {COIN_DENOM_CHIPS.map((d) => (
              <Chip
                key={d}
                label={`+${d >= 1000 ? "1K" : d}`}
                size="small"
                clickable
                onClick={() => addDenom(d)}
                sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700, bgcolor: "#FEF3C7", color: "#92400E" }}
              />
            ))}
          </Stack>

          <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600, lineHeight: 1.35 }}>
            Net Ledger: CASH -<MoneyValue value={netCashOutflowWithChange} />, COIN +<MoneyValue value={coinChangeNum} />
            {paperChangeNum > 0 && (
              <>
                {" "}(Handed: <MoneyValue value={totalCashHandedEstimate} />, Paper kept in CASH: <MoneyValue value={paperChangeNum} />)
              </>
            )}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
