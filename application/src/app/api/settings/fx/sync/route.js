// API Route: POST /api/settings/fx/sync
// Manually triggers live exchange rate fetch from Frankfurter v2 into ExchangeRateCache (#4)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getOrCreateAppSettings,
  getCachedRateMap,
  getActiveForeignCurrencies,
  syncFxRatesFromFrankfurter,
  SUPPORTED_CURRENCIES,
} from "@/lib/fxService";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { user, errorResponse } = await requireUser(request);
    if (errorResponse) return errorResponse;

    const syncResult = await syncFxRatesFromFrankfurter({ userId: user.id, force: true });

    const settings = await getOrCreateAppSettings(user.id);
    const [rates, rateMap, activeForeignCurrencies] = await Promise.all([
      prisma.exchangeRateCache.findMany({
        where: { quoteCurrency: settings.baseCurrency },
        orderBy: { baseCurrency: "asc" },
      }),
      getCachedRateMap(settings.baseCurrency),
      getActiveForeignCurrencies(user.id, settings.baseCurrency),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        syncResult,
        settings,
        rates,
        rateMap,
        activeForeignCurrencies,
        fxSyncEnabled: activeForeignCurrencies.length > 0,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/settings/fx/sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync FX rates" },
      { status: 500 }
    );
  }
}
