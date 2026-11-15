// API Route: GET & POST /api/reminders
// Manages draft transaction notes and pending reminders

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const reminders = await prisma.pendingReminder.findMany({
      where: { userId: user.id, status: "PENDING" },
      include: {
        suggestedVault: true,
        suggestedParty: true,
        suggestedCategory: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { title, reminderType = "DRAFT_TX", estimatedAmount, dueDate, suggestedVaultId, suggestedPartyId, suggestedCategoryId } = body;

    const vaultId = suggestedVaultId ? parseInt(suggestedVaultId, 10) : null;
    const partyId = suggestedPartyId ? parseInt(suggestedPartyId, 10) : null;
    const categoryId = suggestedCategoryId ? parseInt(suggestedCategoryId, 10) : null;

    if (vaultId) {
      const v = await prisma.vault.findFirst({ where: { id: vaultId, userId: user.id } });
      if (!v) return NextResponse.json({ success: false, error: "Suggested vault not found" }, { status: 404 });
    }
    if (partyId) {
      const p = await prisma.party.findFirst({ where: { id: partyId, userId: user.id } });
      if (!p) return NextResponse.json({ success: false, error: "Suggested party not found" }, { status: 404 });
    }
    if (categoryId) {
      const c = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
      if (!c) return NextResponse.json({ success: false, error: "Suggested category not found" }, { status: 404 });
    }

    const reminder = await prisma.pendingReminder.create({
      data: {
        userId: user.id,
        title,
        reminderType,
        estimatedAmount: estimatedAmount ? toDecimal(estimatedAmount) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        suggestedVaultId: vaultId,
        suggestedPartyId: partyId,
        suggestedCategoryId: categoryId,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

