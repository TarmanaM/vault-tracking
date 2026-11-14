// Shared vault classification and sorting helpers used across server routes and UI components

export function isPhysicalCashVault(vault) {
  if (!vault) return false;
  return (
    vault.code === "CASH" ||
    vault.vaultType === "PHYSICAL_CASH" ||
    vault.vaultType === "CASH"
  );
}

export function isPhysicalCoinVault(vault) {
  if (!vault) return false;
  return (
    vault.code === "COIN" ||
    vault.vaultType === "PHYSICAL_COIN" ||
    vault.vaultType === "COIN"
  );
}

export function isSelectableSpendVault(vault) {
  if (!vault) return false;
  return (
    isPhysicalCashVault(vault) ||
    isPhysicalCoinVault(vault) ||
    vault.vaultType === "BANK" ||
    vault.vaultType === "EWALLET" ||
    vault.vaultType === "LIABILITY_CREDIT_LINE"
  );
}

export function sortVaultsByBalanceDesc(vaults = []) {
  return [...vaults].sort((a, b) => {
    const aBal = Number(a.totalEstimatedBase ?? a.currentBalance ?? 0);
    const bBal = Number(b.totalEstimatedBase ?? b.currentBalance ?? 0);
    const diff = bBal - aBal;
    if (diff !== 0) return diff;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

/**
 * Derive crisp 1-2 character uppercase initials from a Vault name (e.g. "Bank Nobu" -> "BN")
 */
export function getVaultInitials(name = "") {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "V";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}
