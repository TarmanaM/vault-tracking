"use client";

import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PaymentsIcon from "@mui/icons-material/Payments";
import SavingsIcon from "@mui/icons-material/Savings";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import TollIcon from "@mui/icons-material/Toll";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import { getVaultInitials } from "@/lib/vaultHelpers";

export const VAULT_ICON_OPTIONS = [
  { key: "BANK", label: "Bank", Icon: AccountBalanceIcon },
  { key: "WALLET", label: "Wallet", Icon: AccountBalanceWalletIcon },
  { key: "CARD", label: "Card", Icon: CreditCardIcon },
  { key: "CASH", label: "Cash", Icon: PaymentsIcon },
  { key: "SAVINGS", label: "Savings", Icon: SavingsIcon },
  { key: "FX", label: "Valas", Icon: CurrencyExchangeIcon },
  { key: "COIN", label: "Coin", Icon: TollIcon },
  { key: "EWALLET", label: "Mobile", Icon: PhoneAndroidIcon },
  { key: "QRIS", label: "QR", Icon: QrCode2Icon },
  { key: "WORK", label: "Pool", Icon: WorkOutlineIcon },
  { key: "STORE", label: "Merchant", Icon: StorefrontIcon },
  { key: "GIFT", label: "Bonus", Icon: CardGiftcardIcon },
];

const ICON_MAP = Object.fromEntries(VAULT_ICON_OPTIONS.map((o) => [o.key, o.Icon]));

function defaultIconKeyForVault(vault) {
  switch (vault?.vaultType) {
    case "BANK":
      return "BANK";
    case "EWALLET":
      return "EWALLET";
    case "PHYSICAL_CASH":
      return "CASH";
    case "PHYSICAL_COIN":
      return "COIN";
    case "LIABILITY_CREDIT_LINE":
      return "CARD";
    default:
      return "WALLET";
  }
}

export function isLightHexColor(hex = "#2563EB") {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

export default function VaultAvatar({
  vault,
  size = 34,
  shape = "rounded", // "rounded" | "circle"
  sx = {},
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [vault?.profileImageUrl]);

  const bgColor = vault?.colorHex || "#2563EB";
  const fgColor = isLightHexColor(bgColor) ? "#0F172A" : "#FFFFFF";
  const mode = vault?.symbolMode || "INITIALS";
  const radius = shape === "circle" ? "50%" : Math.max(8, Math.round(size * 0.28)) + "px";

  if (mode === "IMAGE" && vault?.profileImageUrl && !imgFailed) {
    return (
      <Box
        component="img"
        src={vault.profileImageUrl}
        alt={vault?.name || "Vault"}
        onError={() => setImgFailed(true)}
        sx={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          aspectRatio: "1 / 1",
          display: "block",
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          boxSizing: "border-box",
          border: `1.5px solid ${bgColor}`,
          bgcolor: "#F1F5F9",
          ...sx,
        }}
      />
    );
  }

  if (mode === "ICON") {
    const IconComp =
      ICON_MAP[vault?.iconName] || ICON_MAP[defaultIconKeyForVault(vault)] || AccountBalanceWalletIcon;
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: radius,
          bgcolor: bgColor,
          color: fgColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.12)",
          ...sx,
        }}
      >
        <IconComp sx={{ fontSize: Math.round(size * 0.54) }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: radius,
        bgcolor: bgColor,
        color: fgColor,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontWeight: 800,
        fontSize: Math.max(10, Math.round(size * 0.36)) + "px",
        letterSpacing: "0.02em",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.12)",
        ...sx,
      }}
    >
      {getVaultInitials(vault?.name || "V")}
    </Box>
  );
}
