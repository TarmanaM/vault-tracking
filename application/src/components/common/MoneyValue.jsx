"use client";

import React, { useState } from "react";
import { Tooltip, Box } from "@mui/material";
import { useLedgerStore } from "@/store/useLedgerStore";
import { formatMoneyDisplay, formatRupiah } from "@/lib/money";
import { formatNativeMoney } from "@/lib/currencyHelpers";

/**
 * Renders monetary values respecting Global Privacy Mode (#8), Compact/Exact Toggle (#7), and Multi-Currency (#4)
 */
export default function MoneyValue({
  value,
  currency = null,
  includeCents = false,
  forceExact = false,
  allowTapToggle = false,
  prefix = "",
  component = "span",
}) {
  const storeBaseCurrency = useLedgerStore((s) => s.baseCurrency);
  const isCompactNumbers = useLedgerStore((s) => s.isCompactNumbers);
  const isPrivacyHidden = useLedgerStore((s) => s.isPrivacyHidden);
  const [localExact, setLocalExact] = useState(false);

  const normalizedCcy = String(currency || storeBaseCurrency || "IDR").toUpperCase();
  const effectiveCompact = isCompactNumbers && !forceExact && !localExact;

  const formatted =
    normalizedCcy === "IDR"
      ? formatMoneyDisplay(value, {
          compact: effectiveCompact,
          includeCents: includeCents || localExact,
          hidden: isPrivacyHidden,
        })
      : formatNativeMoney(value, normalizedCcy, {
          compact: effectiveCompact,
          includeCents: includeCents || localExact,
          hidden: isPrivacyHidden,
        });

  const exactTooltip = isPrivacyHidden
    ? "Privacy Mode Active"
    : normalizedCcy === "IDR"
    ? formatRupiah(value, true)
    : formatNativeMoney(value, normalizedCcy, { compact: false, includeCents: true, hidden: false });

  const handleToggle = (e) => {
    if (!allowTapToggle || isPrivacyHidden) return;
    e.stopPropagation();
    setLocalExact((prev) => !prev);
  };

  const rendered = (
    <Box
      component={component}
      onClick={handleToggle}
      sx={{
        cursor: allowTapToggle && !isPrivacyHidden ? "pointer" : "inherit",
        textDecoration:
          allowTapToggle && !isPrivacyHidden && effectiveCompact
            ? "underline dotted rgba(148,163,184,0.6)"
            : "none",
        textUnderlineOffset: "3px",
      }}
    >
      {isPrivacyHidden ? formatted : `${prefix}${formatted}`}
    </Box>
  );

  if (effectiveCompact && !isPrivacyHidden) {
    return (
      <Tooltip title={`Exact: ${exactTooltip}${allowTapToggle ? " (Tap to toggle)" : ""}`} arrow>
        {rendered}
      </Tooltip>
    );
  }

  return rendered;
}
