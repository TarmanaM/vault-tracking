"use client";

import React from "react";
import {
  Box,
  Stack,
  Chip,
  Autocomplete,
  TextField,
  MenuItem,
  Typography,
} from "@mui/material";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import HistoryIcon from "@mui/icons-material/History";
import MoneyValue from "@/components/MoneyValue";
import { normalizeCardTitle } from "@/shared/cardPromotionUtils";

export const PRIMARY_TYPE_PILLS = [
  { key: "EXPENSE", label: "Expense", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  { key: "INCOME", label: "Income", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  { key: "TRANSFER", label: "Transfer", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  { key: "DEBT", label: "Debt / Loan", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
];

export const DEBT_SUB_PILLS = [
  { value: "RECEIVABLE_LEND", label: "Lent / Talangi" },
  { value: "RECEIVABLE_COLLECT", label: "Collected Debt" },
  { value: "PAYABLE_BORROW", label: "Borrowed / Utang" },
  { value: "PAYABLE_REPAY", label: "Repay Debt / PayLater" },
];

export default function TransactionNatureAndTitleSection({
  activePrimaryKey,
  isDebtNature,
  nature,
  setNature,
  sortedTitleOptions,
  title,
  setTitle,
  selectedCardId,
  setSelectedCardId,
  selectedCardTitle,
  setSelectedCardTitle,
  handleSelectTitleOption,
  categoryId,
  setCategoryId,
  filteredCategories,
  baseUpper,
}) {
  return (
    <>
      <Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {PRIMARY_TYPE_PILLS.map((pill) => {
            const selected = activePrimaryKey === pill.key;
            return (
              <Chip
                key={pill.key}
                label={pill.label}
                clickable
                onClick={() => {
                  if (pill.key === "DEBT") {
                    if (!isDebtNature) setNature("RECEIVABLE_LEND");
                  } else {
                    setNature(pill.key);
                  }
                }}
                sx={{
                  flex: "1 1 0",
                  minWidth: 74,
                  height: 36,
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  borderRadius: 2,
                  bgcolor: selected ? pill.bg : "#F8FAFC",
                  color: selected ? pill.color : "#475569",
                  border: `1.5px solid ${selected ? pill.color : "#E2E8F0"}`,
                }}
              />
            );
          })}
        </Stack>

        {activePrimaryKey === "DEBT" && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {DEBT_SUB_PILLS.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                size="small"
                clickable
                color={nature === d.value ? "warning" : "default"}
                variant={nature === d.value ? "filled" : "outlined"}
                onClick={() => setNature(d.value)}
                sx={{ fontWeight: 700, fontSize: "0.72rem" }}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Autocomplete
            freeSolo
            fullWidth
            size="small"
            options={sortedTitleOptions}
            value={null}
            inputValue={title}
            getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.title || "")}
            isOptionEqualToValue={(opt, val) => opt?.suggestionKey === val?.suggestionKey}
            filterOptions={(opts, state) => {
              const q = normalizeCardTitle(state.inputValue);
              if (!q) return opts.slice(0, 14);
              return opts.filter((o) => normalizeCardTitle(o.title).includes(q)).slice(0, 14);
            }}
            onChange={(_, selectedOpt) => {
              if (selectedOpt && typeof selectedOpt !== "string") {
                handleSelectTitleOption(selectedOpt);
              }
            }}
            onInputChange={(_, newInputValue, reason) => {
              if (reason === "input" || reason === "clear") {
                setTitle(newInputValue);
                if (
                  selectedCardId &&
                  normalizeCardTitle(newInputValue) !== normalizeCardTitle(selectedCardTitle)
                ) {
                  setSelectedCardId(null);
                  setSelectedCardTitle("");
                }
              }
            }}
            renderOption={(props, option) => {
              const { key, ...restProps } = props;
              return (
                <Box
                  component="li"
                  key={key || option.suggestionKey}
                  {...restProps}
                  sx={{
                    display: "flex !important",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                    py: 0.75,
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    {option.kind === "CARD" ? (
                      <Chip
                        size="small"
                        icon={<FlashOnIcon sx={{ fontSize: "0.75rem !important" }} />}
                        label="Card"
                        color="primary"
                        sx={{ height: 20, fontSize: "0.66rem", fontWeight: 800, flexShrink: 0 }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<HistoryIcon sx={{ fontSize: "0.75rem !important" }} />}
                        label={`${option.totalUses}x`}
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, flexShrink: 0 }}
                      />
                    )}
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {option.title}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
                    {[option.nature !== nature ? option.nature : null, option.sourceVaultName]
                      .filter(Boolean)
                      .join(" • ")}
                    {option.defaultAmount > 0 && (
                      <>
                        {" "}
                        • <MoneyValue value={option.defaultAmount} currency={option.currency || baseUpper} />
                      </>
                    )}
                  </Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Transaction Title"
                placeholder="Type or pick Card / past transaction..."
              />
            )}
          />

          {(nature === "EXPENSE" || nature === "INCOME" || nature === "PAYABLE_BORROW") && (
            <TextField
              select
              label="Category"
              size="small"
              fullWidth
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <MenuItem value="">Auto / Uncategorized</MenuItem>
              {filteredCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>

        {selectedCardId && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              icon={<FlashOnIcon sx={{ fontSize: "0.78rem !important" }} />}
              label={`Linked to Card: "${selectedCardTitle || title}"`}
              onDelete={() => {
                setSelectedCardId(null);
                setSelectedCardTitle("");
              }}
              sx={{ fontWeight: 700, fontSize: "0.72rem" }}
            />
          </Stack>
        )}
      </Box>
    </>
  );
}
