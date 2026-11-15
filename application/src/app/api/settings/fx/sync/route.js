// API Route: POST /api/settings/fx/sync
// Manually triggers live exchange rate fetch from Frankfurter v2 into ExchangeRateCache

import prisma from "@/server/db/prisma";
import { withApiHandler } from "@/server/http/apiHandler";
import {
  getOrCreateAppSettings,
  getCachedRateMap,
  getActiveForeignCurrencies,
  syncFxRatesFromFrankfurter,
  SUPPORTED_CURRENCIES,
} from "@/lib/fxService";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ user }) => {
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

    return {
      syncResult,
      settings,
      rates,
      rateMap,
      activeForeignCurrencies,
      fxSyncEnabled: activeForeignCurrencies.length > 0,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    };
  },
  { errorStatus: 500 }
);
