// API Route: GET & PATCH /api/settings/fx
// Manages base currency, Frankfurter v2 auto-sync interval, and manual FX overrides (#4)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getOrCreateAppSettings,
  getCachedRateMap,
  getActiveForeignCurrencies,
  syncFxRatesFromFrankfurter,
  upsertManualFxRate,
  SUPPORTED_CURRENCIES,
} from "@/lib/fxService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getOrCreateAppSettings();
    const [rates, rateMap, activeForeignCurrencies] = await Promise.all([
      prisma.exchangeRateCache.findMany({
        where: { quoteCurrency: settings.baseCurrency },
        orderBy: { baseCurrency: "asc" },
      }),
      getCachedRateMap(settings.baseCurrency),
      getActiveForeignCurrencies(settings.baseCurrency),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        settings,
        rates,
        rateMap,
        activeForeignCurrencies,
        fxSyncEnabled: activeForeignCurrencies.length > 0,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/settings/fx:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load FX settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const current = await getOrCreateAppSettings();

    const nextBase = body.baseCurrency
      ? String(body.baseCurrency).trim().toUpperCase().slice(0, 8)
      : current.baseCurrency;

    let nextInterval = current.fxSyncIntervalDays;
    if (body.fxSyncIntervalDays !== undefined && body.fxSyncIntervalDays !== null) {
      const parsed = parseInt(body.fxSyncIntervalDays, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 90) {
        return NextResponse.json(
          { success: false, error: "Sync interval must be between 1 and 90 days" },
          { status: 400 }
        );
      }
      nextInterval = parsed;
    }

    const baseChanged = nextBase !== current.baseCurrency;

    await prisma.appSetting.update({
      where: { id: 1 },
      data: {
        baseCurrency: nextBase,
        fxSyncIntervalDays: nextInterval,
      },
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
        syncResult = await syncFxRatesFromFrankfurter({ force: true });
      } catch (err) {
        syncResult = { synced: false, error: err.message };
      }
    }

    const [updatedSettings, rates, rateMap, activeForeignCurrencies] = await Promise.all([
      getOrCreateAppSettings(),
      prisma.exchangeRateCache.findMany({
        where: { quoteCurrency: nextBase },
        orderBy: { baseCurrency: "asc" },
      }),
      getCachedRateMap(nextBase),
      getActiveForeignCurrencies(nextBase),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        settings: updatedSettings,
        rates,
        rateMap,
        activeForeignCurrencies,
        fxSyncEnabled: activeForeignCurrencies.length > 0,
        syncResult,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/settings/fx:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update FX settings" },
      { status: 400 }
    );
  }
}
