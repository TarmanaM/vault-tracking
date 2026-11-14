"use client";

import React, { useState, useEffect } from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  formatCurrencyInput,
  parseCurrencyInput,
  numericToFormattedInput,
} from "@/lib/money";

/**
 * Currency input field with live thousand separators (e.g. 1.000.000) and optional comma cents (,21)
 */
export default function CurrencyTextField({
  value = "",
  onValueChange,
  label = "Amount",
  placeholder = "0",
  size = "small",
  fullWidth = true,
  required = false,
  disabled = false,
  helperText = "",
  showClear = false,
  onClear = null,
  sx = {},
  inputProps = {},
}) {
  const [displayText, setDisplayText] = useState(() => numericToFormattedInput(value));

  // Sync external value changes without breaking in-progress decimal typing (e.g. trailing comma)
  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      if (displayText !== "") setDisplayText("");
      return;
    }

    const numericExternal = Number(value);
    const numericCurrent = parseCurrencyInput(displayText);

    if (!Number.isNaN(numericExternal) && numericExternal !== numericCurrent) {
      setDisplayText(numericToFormattedInput(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const formatted = formatCurrencyInput(raw);
    setDisplayText(formatted);

    if (onValueChange) {
      if (formatted === "") {
        onValueChange("", "");
      } else {
        const parsed = parseCurrencyInput(formatted);
        onValueChange(parsed, formatted);
      }
    }
  };

  const handleClearClick = () => {
    setDisplayText("");
    if (onClear) {
      onClear();
    } else if (onValueChange) {
      onValueChange("", "");
    }
  };

  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={displayText}
      onChange={handleChange}
      size={size}
      fullWidth={fullWidth}
      required={required}
      disabled={disabled}
      helperText={helperText}
      inputMode="decimal"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ fontWeight: 700 }}>
            Rp
          </InputAdornment>
        ),
        endAdornment:
          showClear && displayText ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClearClick} edge="end" aria-label="Clear amount">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        ...inputProps,
      }}
      sx={sx}
    />
  );
}

