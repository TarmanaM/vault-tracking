// API Route: GET /api/onboarding, POST /api/onboarding
// Serves onboarding catalog options and applies personalized or default skip workspace setup

import prisma from "@/server/db/prisma";
import { withApiHandler } from "@/server/http/apiHandler";
import {
  ONBOARDING_MODULES,
  STARTER_VAULT_TEMPLATES,
  SPENDING_LAYERS,
  MASTER_CATEGORY_TEMPLATES,
  ensureMasterTemplatesSeeded,
} from "@/lib/masterCatalog";
import { SUPPORTED_CURRENCIES } from "@/shared/currencyHelpers";
import { applyUserOnboarding } from "@/lib/onboardingService";
import { getOrCreateAppSettings } from "@/lib/fxService";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    await ensureMasterTemplatesSeeded(prisma);
    const appSetting = await getOrCreateAppSettings(user.id, prisma);

    let savedProfile = null;
    try {
      savedProfile = user.onboardingProfileJson
        ? JSON.parse(user.onboardingProfileJson)
        : null;
    } catch {
      savedProfile = null;
    }

    return {
      user,
      baseCurrency: appSetting.baseCurrency,
      savedProfile,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      onboardingModules: ONBOARDING_MODULES,
      starterVaultTemplates: STARTER_VAULT_TEMPLATES,
      spendingLayers: SPENDING_LAYERS,
      categoryTemplates: MASTER_CATEGORY_TEMPLATES,
    };
  },
  { errorStatus: 500 }
);

export const POST = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  return await applyUserOnboarding(user.id, body);
});
