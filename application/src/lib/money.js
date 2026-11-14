// Safe Decimal precision helpers using decimal.js
// Compliant with Rule 14 (Cent precision .21/.67 without floating point bugs)

import Decimal from "decimal.js";

// Configure Decimal precision for financial ledger
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(val) {
  if (val === null || val === undefined || val === "") return new Decimal(0);
  if (val instanceof Decimal) return val;
  return new Decimal(val.toString());
}

export function addMoney(a, b) {
  return toDecimal(a).plus(toDecimal(b));
}

export function subMoney(a, b) {
  return toDecimal(a).minus(toDecimal(b));
}

export function mulMoney(a, b) {
  return toDecimal(a).times(toDecimal(b));
}

export function divMoney(a, b) {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return toDecimal(0);
  return toDecimal(a).dividedBy(divisor);
}

export function roundMoney(val) {
  return toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function toNumber(val) {
  return toDecimal(val).toNumber();
}

/**
 * Format exact amount in Indonesian Rupiah currency format
 */
export function formatRupiah(val, includeCents = false) {
  const dec = roundMoney(val);
  const num = dec.toNumber();
  const isNeg = num < 0;
  const absNum = Math.abs(num);

  // Check whether value actually has non-zero cents
  const hasCents = !dec.mod(1).isZero();
  const minFrac = includeCents || hasCents ? 2 : 0;

  const parts = absNum.toLocaleString("id-ID", {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: 2,
  });

  return `${isNeg ? "-" : ""}Rp ${parts}`;
}

/**
 * Trim unnecessary trailing decimal zeroes cleanly (e.g. "1.00" -> "1", "59.50" -> "59.5")
 */
function trimTrailingZeroes(str) {
  if (!str.includes(".")) return str;
  return str.replace(/\.0+$/, "").replace(/(\.[0-9]*[1-9])0+$/, "$1");
}

/**
 * Format value compactly (e.g. 1.000.000 -> Rp 1jt, 59.500 -> Rp 59.5k)
 */
export function formatCompactRupiah(val, withPrefix = true) {
  const dec = roundMoney(val);
  const num = dec.toNumber();
  const isNeg = num < 0;
  const abs = Math.abs(num);

  let shortStr = "";
  if (abs >= 1_000_000_000) {
    shortStr = `${trimTrailingZeroes((abs / 1_000_000_000).toFixed(2))}M`;
  } else if (abs >= 1_000_000) {
    shortStr = `${trimTrailingZeroes((abs / 1_000_000).toFixed(2))}jt`;
  } else if (abs >= 1_000) {
    shortStr = `${trimTrailingZeroes((abs / 1_000).toFixed(1))}k`;
  } else {
    shortStr = trimTrailingZeroes(abs.toFixed(2));
  }

  const prefix = withPrefix ? "Rp " : "";
  return `${isNeg ? "-" : ""}${prefix}${shortStr}`;
}

/**
 * Format short axis ticks for MUI X Charts without "Rp" clutter
 */
export function formatShortAxis(val, hidden = false) {
  if (hidden) return "•••";
  return formatCompactRupiah(val, false);
}

/**
 * Unified display formatter respecting Privacy Mode (#8) and Compact Toggle (#7)
 */
export function formatMoneyDisplay(val, { compact = false, includeCents = false, hidden = false } = {}) {
  if (hidden) return "Rp ••••••";
  if (compact) return formatCompactRupiah(val, true);
  return formatRupiah(val, includeCents);
}

/**
 * Format raw input digits into dot-separated Indonesian thousands (e.g. "1000000" -> "1.000.000")
 * Preserves optional comma decimal input (e.g. "54299125,21" -> "54.299.125,21")
 */
export function formatCurrencyInput(rawValue) {
  if (rawValue === null || rawValue === undefined) return "";
  let str = String(rawValue);

  // Strip everything except digits and comma
  str = str.replace(/[^0-9,]/g, "");
  if (!str) return "";

  const commaIndex = str.indexOf(",");
  let integerPart = commaIndex >= 0 ? str.slice(0, commaIndex) : str;
  const decimalPart = commaIndex >= 0 ? str.slice(commaIndex + 1).replace(/,/g, "").slice(0, 2) : null;

  // Strip leading zeroes unless value is "0"
  integerPart = integerPart.replace(/^0+(?=\d)/, "");
  const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decimalPart !== null) {
    return `${formattedInt || "0"},${decimalPart}`;
  }
  return formattedInt;
}

/**
 * Convert formatted currency string ("1.000.000,21") into plain numeric string ("1000000.21")
 */
export function parseCurrencyInput(formattedValue) {
  if (formattedValue === null || formattedValue === undefined || formattedValue === "") return 0;
  const clean = String(formattedValue).replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Convert initial numeric value (e.g. 54299125.21 or "12000") to formatted input string ("54.299.125,21" or "12.000")
 */
export function numericToFormattedInput(val) {
  if (val === null || val === undefined || val === "" || Number(val) === 0) return "";
  const str = String(val).replace(".", ",");
  return formatCurrencyInput(str);
}
