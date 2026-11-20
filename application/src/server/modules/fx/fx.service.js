// Server Module: FX Settings Service
// Handles reading and updating per-user currency settings, sync intervals, and manual FX overrides

import prisma from "@/server/db/prisma";
import { BadRequestError } from "@/server/http/errors";
import {
  getOrCreateAppSettings,
  getCachedRateMap,
  getActiveForeignCurrencies,
  syncFxRatesFromFrankfurter,
  upsertManualFxRate,
  SUPPORTED_CURRENCIES,
} from "@/lib/fxService";

export async function getUserFxSettingsPayload(userId) {
  const settings = await getOrCreateAppSettings(userId);
  const [rates, rateMap, activeForeignCurrencies] = await Promise.all([
    prisma.exchangeRateCache.findMany({
      where: { quoteCurrency: settings.baseCurrency },
      orderBy: { baseCurrency: "asc" },
    }),
    getCachedRateMap(settings.baseCurrency),
    getActiveForeignCurrencies(userId, settings.baseCurrency),
  ]);

  return {
    settings,
    rates,
    rateMap,
    activeForeignCurrencies,
    fxSyncEnabled: activeForeignCurrencies.length > 0,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
}

export async function updateUserFxSettingsPayload(userId, body = {}) {
  const current = await getOrCreateAppSettings(userId);

  const nextBase = body.baseCurrency
    ? String(body.baseCurrency).trim().toUpperCase().slice(0, 8)
    : current.baseCurrency;

  let nextInterval = current.fxSyncIntervalDays;
  if (body.fxSyncIntervalDays !== undefined && body.fxSyncIntervalDays !== null) {
    const parsed = parseInt(body.fxSyncIntervalDays, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 90) {
      throw new BadRequestError("Sync interval must be between 1 and 90 days");
    }
    nextInterval = parsed;
  }

  const baseChanged = nextBase !== current.baseCurrency;

  await prisma.$transaction(async (tx) => {
    await tx.appSetting.update({
      where: { userId },
      data: {
        baseCurrency: nextBase,
        fxSyncIntervalDays: nextInterval,
      },
    });

    if (baseChanged) {
      await tx.vaultSubContainer.updateMany({
        where: {
          vault: { userId },
          OR: [{ currency: current.baseCurrency }, { isDefault: true }],
        },
        data: {
          currency: nextBase,
        },
      });
    }
  });

  if (body.manualRate && body.manualRate.baseCurrency && body.manualRate.rate) {
    await upsertManualFxRate({
      baseCurrency: body.manualRate.baseCurrency,
      quoteCurrency: body.manualRate.quoteCurrency || nextBase,
      rate: body.manualRate.rate,
    });
  }

  let syncResult = null;
  if (baseChanged || body.syncAfterSave) {
    try {
      syncResult = await syncFxRatesFromFrankfurter({ userId, force: true });
    } catch (err) {
      syncResult = { synced: false, error: err.message };
    }
  }

  const [updatedSettings, rates, rateMap, activeForeignCurrencies] = await Promise.all([
    getOrCreateAppSettings(userId),
    prisma.exchangeRateCache.findMany({
      where: { quoteCurrency: nextBase },
      orderBy: { baseCurrency: "asc" },
    }),
    getCachedRateMap(nextBase),
    getActiveForeignCurrencies(userId, nextBase),
  ]);

  return {
    settings: updatedSettings,
    rates,
    rateMap,
    activeForeignCurrencies,
    fxSyncEnabled: activeForeignCurrencies.length > 0,
    syncResult,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
}
