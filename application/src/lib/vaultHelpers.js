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
    const diff = Number(b.currentBalance || 0) - Number(a.currentBalance || 0);
    if (diff !== 0) return diff;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}
