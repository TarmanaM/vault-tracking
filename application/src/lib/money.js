// Safe Decimal precision helpers using decimal.js
// Compliant with Rule 14 (Cent precision .21/.67 without floating point bugs)

import Decimal from "decimal.js";

// Configure Decimal precision for financial ledger
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(val) {
  if (val === null || val === undefined) return new Decimal(0);
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

export function roundMoney(val) {
  return toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function toNumber(val) {
  return toDecimal(val).toNumber();
}

// Format to Indonesian Rupiah currency format
export function formatRupiah(val, includeCents = false) {
  const dec = roundMoney(val);
  const num = dec.toNumber();

  const parts = num.toLocaleString("id-ID", {
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `Rp ${parts}`;
}

