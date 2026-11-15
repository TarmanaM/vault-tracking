// Server-side Currency & Frankfurter v2 Exchange Rate Service (#4)
// Caches rates in SQLite ExchangeRateCache and respects configurable sync intervals (default 3 days)

import prisma from "./prisma.js";
import { toDecimal, mulMoney, divMoney, roundMoney } from "./money.js";
import { SUPPORTED_CURRENCIES } from "./currencyHelpers.js";

const FRANKFURTER_V2_BASE = "https://api.frankfurter.dev/v2";
const activeSyncPromisesByUser = new Map();

/**
 * Fetch or lazily initialize per-user AppSetting
 */
export async function getOrCreateAppSettings(userId, prismaClient = prisma) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("Authenticated userId is required to load AppSetting");
  }

  let settings = await prismaClient.appSetting.findUnique({ where: { userId: uid } });
  if (!settings) {
    settings = await prismaClient.appSetting.upsert({
      where: { userId: uid },
      update: {},
      create: {
        userId: uid,
        baseCurrency: "IDR",
        fxSyncIntervalDays: 3,
      },
    });
  }
  return settings;
}

/**
 * Load all cached exchange rates targeting quoteCurrency (e.g. "IDR") as a lookup map
 */
export async function getCachedRateMap(quoteCurrency = "IDR", prismaClient = prisma) {
  const normalizedQuote = String(quoteCurrency || "IDR").toUpperCase();
  const rows = await prismaClient.exchangeRateCache.findMany({
    where: { quoteCurrency: normalizedQuote },
    orderBy: { baseCurrency: "asc" },
  });

  const map = {
    [normalizedQuote]: {
      baseCurrency: normalizedQuote,
      quoteCurrency: normalizedQuote,
      rate: 1,
      rateDate: new Date().toISOString().split("T")[0],
      source: "BASE",
      fetchedAt: new Date(),
    },
  };

  for (const row of rows) {
    map[row.baseCurrency] = {
      id: row.id,
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: Number(row.rate),
      rateDate: row.rateDate,
      source: row.source,
      fetchedAt: row.fetchedAt,
    };
  }

  return map;
}

/**
 * Resolve conversion multiplier from entry currency into App baseCurrency inside a ledger operation
 */
export async function resolveFxRate({
  fromCurrency,
  baseCurrency = "IDR",
  manualFxRate = null,
  tx = prisma,
}) {
  const from = String(fromCurrency || baseCurrency).toUpperCase();
  const base = String(baseCurrency || "IDR").toUpperCase();

  if (from === base) {
    return { rateDec: toDecimal(1), rateNumber: 1, source: "BASE" };
  }

  if (manualFxRate !== null && manualFxRate !== undefined && Number(manualFxRate) > 0) {
    const manualDec = toDecimal(manualFxRate);
    return {
      rateDec: manualDec,
      rateNumber: manualDec.toNumber(),
      source: "MANUAL",
    };
  }

  const cached = await tx.exchangeRateCache.findUnique({
    where: {
      baseCurrency_quoteCurrency: {
        baseCurrency: from,
        quoteCurrency: base,
      },
    },
  });

  if (cached && Number(cached.rate) > 0) {
    const cachedDec = toDecimal(cached.rate);
    return {
      rateDec: cachedDec,
      rateNumber: cachedDec.toNumber(),
      source: cached.source,
    };
  }

  throw new Error(
    `Exchange rate for ${from} -> ${base} is not cached yet. Sync FX rates in Settings or enter a manual FX rate.`
  );
}

/**
 * Fetch exact pair rates from Frankfurter v2 API (/v2/rate/{base}/{quote}) with fallback batch check
 */
async function fetchPairFromFrankfurter(fromCode, toCode) {
  const url = `${FRANKFURTER_V2_BASE}/rate/${fromCode.toLowerCase()}/${toCode.toLowerCase()}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Frankfurter HTTP ${res.status} for ${fromCode}/${toCode}`);
  }
  const json = await res.json();
  if (!json || typeof json.rate !== "number" || json.rate <= 0) {
    throw new Error(`Invalid rate payload from Frankfurter for ${fromCode}/${toCode}`);
  }
  return {
    baseCurrency: fromCode.toUpperCase(),
    quoteCurrency: toCode.toUpperCase(),
    rate: json.rate,
    rateDate: json.date || new Date().toISOString().split("T")[0],
  };
}

/**
 * Collect unique foreign currencies currently held in active vaults for a user
 */
export async function getActiveForeignCurrencies(userId, baseCurrency = "IDR", prismaClient = prisma) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) return [];
  const normalizedBase = String(baseCurrency || "IDR").toUpperCase();
  const rows = await prismaClient.vaultSubContainer.findMany({
    where: {
      vault: { userId: uid, isActive: true },
      currency: { not: normalizedBase },
    },
    distinct: ["currency"],
    select: { currency: true },
    orderBy: { currency: "asc" },
  });

  const unique = new Set();
  for (const row of rows) {
    const code = String(row.currency || "").trim().toUpperCase();
    if (code && code !== normalizedBase) {
      unique.add(code);
    }
  }
  return [...unique];
}

/**
 * Persist a daily FX rate snapshot into global ExchangeRateHistory for wealth trajectory tracking.
 */
async function recordExchangeRateHistory({
  baseCurrency,
  quoteCurrency,
  rateDate,
  rate,
  source = "FRANKFURTER_V2",
}) {
  if (!baseCurrency || !quoteCurrency || !rateDate) return;
  await prisma.exchangeRateHistory.upsert({
    where: {
      baseCurrency_quoteCurrency_rateDate: {
        baseCurrency,
        quoteCurrency,
        rateDate,
      },
    },
    update: {
      rate,
      source,
    },
    create: {
      baseCurrency,
      quoteCurrency,
      rateDate,
      rate,
      source,
    },
  });
}

/**
 * Determine whether scheduled FX sync is currently overdue using global cache timestamps
 */
export function isFxSyncDue(settings, hasAllActiveRates = true, oldestGlobalFetchedAt = null) {
  if (!hasAllActiveRates) return true;
  const referenceTimestamp = oldestGlobalFetchedAt || settings?.lastFxSyncedAt;
  if (!referenceTimestamp) return true;
  const intervalDays = Math.max(1, Number(settings?.fxSyncIntervalDays || 3));
  const elapsedMs = Date.now() - new Date(referenceTimestamp).getTime();
  return elapsedMs >= intervalDays * 24 * 60 * 60 * 1000;
}

/**
 * Sync exchange rates from Frankfurter v2 ONLY for active foreign currencies in use by this user
 */
export async function syncFxRatesFromFrankfurter({ userId, force = false, currencies = null } = {}) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new Error("Authenticated userId is required for FX rate sync");
  }

  if (activeSyncPromisesByUser.has(uid)) {
    return await activeSyncPromisesByUser.get(uid);
  }

  const syncPromise = (async () => {
    const settings = await getOrCreateAppSettings(uid, prisma);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
    const activeForeignCurrencies = await getActiveForeignCurrencies(uid, baseCurrency, prisma);

    // Restrict sync targets strictly to active sub-vault foreign currencies
    let targets = activeForeignCurrencies;
    if (Array.isArray(currencies) && currencies.length > 0) {
      const requestedSet = new Set(
        currencies.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean)
      );
      targets = activeForeignCurrencies.filter((c) => requestedSet.has(c));
    }

    if (targets.length === 0) {
      return {
        synced: false,
        skipped: true,
        reason: "NO_ACTIVE_FOREIGN_CURRENCIES",
        updatedCount: 0,
        activeCurrencies: [],
        baseCurrency,
        lastFxSyncedAt: settings.lastFxSyncedAt,
        errors: [],
      };
    }

    const existingCache = await prisma.exchangeRateCache.findMany({
      where: {
        quoteCurrency: baseCurrency,
        baseCurrency: { in: targets },
      },
      select: { baseCurrency: true, fetchedAt: true },
    });
    const cacheByCode = new Map(existingCache.map((r) => [r.baseCurrency, r.fetchedAt]));
    const missingAny = targets.some((c) => !cacheByCode.has(c));
    const oldestGlobalFetchedAt =
      !missingAny && targets.length > 0
        ? targets.reduce(
            (oldest, code) => {
              const t = cacheByCode.get(code);
              return !oldest || (t && t < oldest) ? t : oldest;
            },
            null
          )
        : null;

    if (!force && !isFxSyncDue(settings, !missingAny, oldestGlobalFetchedAt)) {
      return {
        synced: false,
        skipped: true,
        reason: "WITHIN_INTERVAL",
        updatedCount: 0,
        activeCurrencies: targets,
        baseCurrency,
        lastFxSyncedAt: oldestGlobalFetchedAt || settings.lastFxSyncedAt,
        errors: [],
      };
    }

    const updatedRates = [];
    const errors = [];

    // Fetch exact pairs concurrently only for active foreign currencies
    const settled = await Promise.allSettled(
      targets.map((ccy) => fetchPairFromFrankfurter(ccy, baseCurrency))
    );

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      if (outcome.status === "fulfilled") {
        const item = outcome.value;
        const rateDec = toDecimal(item.rate).toDecimalPlaces(6);
        const saved = await prisma.exchangeRateCache.upsert({
          where: {
            baseCurrency_quoteCurrency: {
              baseCurrency: item.baseCurrency,
              quoteCurrency: item.quoteCurrency,
            },
          },
          update: {
            rate: rateDec,
            rateDate: item.rateDate,
            source: "FRANKFURTER_V2",
            fetchedAt: new Date(),
          },
          create: {
            baseCurrency: item.baseCurrency,
            quoteCurrency: item.quoteCurrency,
            rate: rateDec,
            rateDate: item.rateDate,
            source: "FRANKFURTER_V2",
            fetchedAt: new Date(),
          },
        });
        await recordExchangeRateHistory({
          baseCurrency: item.baseCurrency,
          quoteCurrency: item.quoteCurrency,
          rateDate: item.rateDate,
          rate: rateDec,
          source: "FRANKFURTER_V2",
        });
        updatedRates.push(saved);
      } else {
        errors.push(`${targets[i]}: ${outcome.reason?.message || "Fetch error"}`);
      }
    }

    const now = new Date();
    const status = updatedRates.length > 0 ? "OK" : "ERROR";
    await prisma.appSetting.update({
      where: { userId: uid },
      data: {
        ...(updatedRates.length > 0 ? { lastFxSyncedAt: now } : {}),
        lastFxStatus: status,
        lastFxError: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      },
    });

    return {
      synced: updatedRates.length > 0,
      skipped: false,
      updatedCount: updatedRates.length,
      activeCurrencies: targets,
      baseCurrency,
      lastFxSyncedAt: updatedRates.length > 0 ? now : settings.lastFxSyncedAt,
      errors,
    };
  })();

  activeSyncPromisesByUser.set(uid, syncPromise);

  try {
    return await syncPromise;
  } finally {
    activeSyncPromisesByUser.delete(uid);
  }
}

/**
 * Background-safe check used by read routes (/api/dashboard, /api/analytics) to sync only when active foreign vaults exist and are overdue
 */
export async function ensureFxRatesSyncedIfDue(userId) {
  try {
    const uid = parseInt(userId, 10);
    if (!uid || Number.isNaN(uid)) {
      return { skipped: true, reason: "UNAUTHENTICATED", activeCurrencies: [] };
    }

    const settings = await getOrCreateAppSettings(uid, prisma);
    const baseCurrency = String(settings.baseCurrency || "IDR").toUpperCase();
    const activeForeignCurrencies = await getActiveForeignCurrencies(uid, baseCurrency, prisma);

    // Disable external sync calls completely when no active vault uses a foreign currency
    if (activeForeignCurrencies.length === 0) {
      return {
        skipped: true,
        reason: "NO_ACTIVE_FOREIGN_CURRENCIES",
        activeCurrencies: [],
      };
    }

    const existing = await prisma.exchangeRateCache.findMany({
      where: {
        quoteCurrency: baseCurrency,
        baseCurrency: { in: activeForeignCurrencies },
      },
      select: { baseCurrency: true, fetchedAt: true },
    });
    const existingByCode = new Map(existing.map((r) => [r.baseCurrency, r.fetchedAt]));
    const hasAllActiveRates = activeForeignCurrencies.every((code) => existingByCode.has(code));
    const oldestGlobalFetchedAt =
      hasAllActiveRates && activeForeignCurrencies.length > 0
        ? activeForeignCurrencies.reduce(
            (oldest, code) => {
              const t = existingByCode.get(code);
              return !oldest || (t && t < oldest) ? t : oldest;
            },
            null
          )
        : null;

    if (isFxSyncDue(settings, hasAllActiveRates, oldestGlobalFetchedAt)) {
      return await syncFxRatesFromFrankfurter({ userId: uid, force: false });
    }
    return {
      skipped: true,
      reason: "FRESH_CACHE",
      activeCurrencies: activeForeignCurrencies,
    };
  } catch (err) {
    console.warn("ensureFxRatesSyncedIfDue non-fatal warning:", err.message);
    return { skipped: true, error: err.message };
  }
}

/**
 * Helper used when creating an entry in a foreign currency or saving a manual FX override
 */
export async function upsertManualFxRate({ baseCurrency, quoteCurrency, rate }) {
  const from = String(baseCurrency).toUpperCase();
  const to = String(quoteCurrency).toUpperCase();
  const rateDec = toDecimal(rate).toDecimalPlaces(6);
  if (rateDec.lessThanOrEqualTo(0)) {
    throw new Error("FX rate must be greater than zero");
  }
  const todayDate = new Date().toISOString().split("T")[0];
  const saved = await prisma.exchangeRateCache.upsert({
    where: {
      baseCurrency_quoteCurrency: { baseCurrency: from, quoteCurrency: to },
    },
    update: {
      rate: rateDec,
      rateDate: todayDate,
      source: "MANUAL",
      fetchedAt: new Date(),
    },
    create: {
      baseCurrency: from,
      quoteCurrency: to,
      rate: rateDec,
      rateDate: todayDate,
      source: "MANUAL",
      fetchedAt: new Date(),
    },
  });
  await recordExchangeRateHistory({
    baseCurrency: from,
    quoteCurrency: to,
    rateDate: todayDate,
    rate: rateDec,
    source: "MANUAL",
  });
  return saved;
}

export function convertBaseToForeign(baseAmount, rate) {
  const r = toDecimal(rate);
  if (r.lessThanOrEqualTo(0)) return toDecimal(0);
  return roundMoney(divMoney(toDecimal(baseAmount), r));
}

export function convertForeignToBase(foreignAmount, rate) {
  return roundMoney(mulMoney(toDecimal(foreignAmount), toDecimal(rate || 1)));
}

export { SUPPORTED_CURRENCIES };
