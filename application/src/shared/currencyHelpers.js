// Shared currency metadata and precision formatting helpers for multi-currency vaults
import {
  mulMoney,
  roundMoney,
  toDecimal,
  formatRupiah,
  formatCompactRupiah,
  formatMoneyDisplay,
} from "./money.js";

export const SUPPORTED_CURRENCIES = [
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", decimals: 0 },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thai Baht", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", decimals: 0 },
];

const CURRENCY_META_MAP = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export function getCurrencyMeta(code = "IDR") {
  const upper = String(code || "IDR").toUpperCase();
  return (
    CURRENCY_META_MAP[upper] || {
      code: upper,
      symbol: `${upper} `,
      name: upper,
      decimals: 2,
    }
  );
}

export function getCurrencySymbol(code = "IDR") {
  return getCurrencyMeta(code).symbol;
}

export function formatNativeMoney(
  val,
  currencyCode = "IDR",
  { compact = false, includeCents = false, hidden = false } = {}
) {
  const code = String(currencyCode || "IDR").toUpperCase();
  if (code === "IDR") {
    return formatMoneyDisplay(val, { compact, includeCents, hidden });
  }

  const meta = getCurrencyMeta(code);
  if (hidden) return `${meta.symbol} ••••••`;

  const dec = roundMoney(val);
  const num = dec.toNumber();
  const isNeg = num < 0;
  const absNum = Math.abs(num);

  if (compact && absNum >= 1_000_000) {
    const mStr = (absNum / 1_000_000).toFixed(2).replace(/\.00$/, "");
    return `${isNeg ? "-" : ""}${meta.symbol}${mStr}M`;
  }
  if (compact && absNum >= 1_000) {
    const kStr = (absNum / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${isNeg ? "-" : ""}${meta.symbol}${kStr}k`;
  }

  const hasFraction = !dec.mod(1).isZero();
  const minFrac = meta.decimals > 0 && (includeCents || hasFraction) ? 2 : 0;
  const maxFrac = meta.decimals === 0 && !hasFraction ? 0 : 2;

  const formatted = absNum.toLocaleString("en-US", {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });

  const prefixJoin = meta.symbol.endsWith(" ") ? meta.symbol : `${meta.symbol} `;
  return `${isNeg ? "-" : ""}${prefixJoin}${formatted}`;
}

export function convertAmountWithRate(amount, rate = 1) {
  return roundMoney(mulMoney(toDecimal(amount), toDecimal(rate || 1)));
}

export { formatRupiah, formatCompactRupiah };
