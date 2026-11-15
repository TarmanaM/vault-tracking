// API Route: GET /api/categories, POST /api/categories
// Lists and creates user-owned Categories for /settings and transaction selection

import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  SPENDING_LAYERS,
  getSpendingLayerMeta,
  deriveSilentAccountingFields,
  ensureMasterTemplatesSeeded,
} from "@/lib/masterCatalog";

export const dynamic = "force-dynamic";

const ALLOWED_CUSTOM_NATURES = new Set(["EXPENSE", "INCOME"]);
const ALLOWED_EXPENSE_LAYERS = new Set([
  "FIXED_MANDATORY",
  "VARIABLE_ESSENTIAL",
  "DISCRETIONARY_JAJAN",
  "SOCIAL_CHARITY",
]);

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    await ensureMasterTemplatesSeeded(prisma);

    const [categories, templates] = await Promise.all([
      prisma.category.findMany({
        where: { userId: user.id },
        include: {
          _count: {
            select: { transactions: true, actionCards: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.masterCategoryTemplate.findMany({
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);

    const installedCodes = new Set(categories.map((c) => c.templateCode || c.code));
    const availableTemplates = templates.filter((t) => !installedCodes.has(t.code));

    const enriched = categories.map((cat) => ({
      ...cat,
      spendingLayerMeta: getSpendingLayerMeta(cat.commitmentType),
    }));

    return NextResponse.json({
      success: true,
      data: {
        categories: enriched,
        availableTemplates,
        spendingLayers: SPENDING_LAYERS,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();

    // Quick-instantiate from an unselected MasterCategoryTemplate
    if (body.templateCode) {
      const tpl = await prisma.masterCategoryTemplate.findUnique({
        where: { code: String(body.templateCode).trim() },
      });
      if (!tpl) {
        return NextResponse.json(
          { success: false, error: "Master category template not found" },
          { status: 404 }
        );
      }

      const category = await prisma.category.upsert({
        where: { userId_code: { userId: user.id, code: tpl.code } },
        update: { isActive: true },
        create: {
          userId: user.id,
          code: tpl.code,
          templateCode: tpl.code,
          name: tpl.name,
          defaultNature: tpl.defaultNature,
          commitmentType: tpl.commitmentType,
          priorityTier: tpl.priorityTier,
          countsAsConsume: tpl.countsAsConsume,
          coaCode: tpl.coaCode,
          iconName: tpl.iconName,
          colorHex: tpl.colorHex,
          isSystemLocked: tpl.isSystemLocked,
          sortOrder: tpl.sortOrder,
          isActive: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...category,
          spendingLayerMeta: getSpendingLayerMeta(category.commitmentType),
        },
      });
    }

    const name = String(body.name || "").trim();
    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Category name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const defaultNature = String(body.defaultNature || "EXPENSE").toUpperCase();
    if (!ALLOWED_CUSTOM_NATURES.has(defaultNature)) {
      return NextResponse.json(
        { success: false, error: "Custom categories support EXPENSE or INCOME types" },
        { status: 400 }
      );
    }

    const requestedLayer = String(body.commitmentType || "VARIABLE_ESSENTIAL").toUpperCase();
    if (defaultNature === "EXPENSE" && !ALLOWED_EXPENSE_LAYERS.has(requestedLayer)) {
      return NextResponse.json(
        { success: false, error: "Invalid Spending Layer selected for expense category" },
        { status: 400 }
      );
    }

    const derived = deriveSilentAccountingFields(defaultNature, requestedLayer);
    const slug =
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20) || "CUSTOM";
    const uniqueSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const code = `USR_${slug}_${uniqueSuffix}`;

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        code,
        name,
        defaultNature,
        commitmentType: derived.commitmentType,
        priorityTier: derived.priorityTier,
        countsAsConsume: derived.countsAsConsume,
        coaCode: derived.coaCode,
        iconName: body.iconName ? String(body.iconName).trim() : defaultNature === "INCOME" ? "Payments" : "Category",
        colorHex: body.colorHex ? String(body.colorHex).trim() : getSpendingLayerMeta(derived.commitmentType).colorHex,
        isSystemLocked: false,
        sortOrder: 100,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        spendingLayerMeta: getSpendingLayerMeta(category.commitmentType),
      },
    });
  } catch (error) {
    console.error("Error in POST /api/categories:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}
