// API Route: GET /api/onboarding, POST /api/onboarding
// Serves onboarding catalog options and applies personalized or default skip workspace setup

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ONBOARDING_MODULES,
  STARTER_VAULT_TEMPLATES,
  SPENDING_LAYERS,
  MASTER_CATEGORY_TEMPLATES,
  ensureMasterTemplatesSeeded,
} from "@/lib/masterCatalog";
import { SUPPORTED_CURRENCIES } from "@/lib/currencyHelpers";
import { applyUserOnboarding } from "@/lib/onboardingService";
import { getOrCreateAppSettings } from "@/lib/fxService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    await ensureMasterTemplatesSeeded(prisma);
    const appSetting = await getOrCreateAppSettings(user.id, prisma);

    let savedProfile = null;
    try {
      savedProfile = user.onboardingProfileJson ? JSON.parse(user.onboardingProfileJson) : null;
    } catch {
      savedProfile = null;
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        baseCurrency: appSetting.baseCurrency,
        savedProfile,
        supportedCurrencies: SUPPORTED_CURRENCIES,
        onboardingModules: ONBOARDING_MODULES,
        starterVaultTemplates: STARTER_VAULT_TEMPLATES,
        spendingLayers: SPENDING_LAYERS,
        categoryTemplates: MASTER_CATEGORY_TEMPLATES,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/onboarding:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load onboarding options" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await applyUserOnboarding(user.id, body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/onboarding:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete onboarding" },
      { status: 400 }
    );
  }
}
