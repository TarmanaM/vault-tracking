// API Route: GET & POST /api/reminders
// Manages draft transaction notes and pending reminders

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toDecimal } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reminders = await prisma.pendingReminder.findMany({
      where: { status: "PENDING" },
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
  try {
    const body = await request.json();
    const { title, reminderType = "DRAFT_TX", estimatedAmount, dueDate, suggestedVaultId, suggestedPartyId, suggestedCategoryId } = body;

    const reminder = await prisma.pendingReminder.create({
      data: {
        title,
        reminderType,
        estimatedAmount: estimatedAmount ? toDecimal(estimatedAmount) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        suggestedVaultId: suggestedVaultId ? parseInt(suggestedVaultId, 10) : null,
        suggestedPartyId: suggestedPartyId ? parseInt(suggestedPartyId, 10) : null,
        suggestedCategoryId: suggestedCategoryId ? parseInt(suggestedCategoryId, 10) : null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

