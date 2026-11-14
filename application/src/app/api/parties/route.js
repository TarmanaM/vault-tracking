// API Route: GET & POST /api/parties
// Allows creating new contacts / debt channels directly from UI (#17)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const parties = await prisma.party.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    return NextResponse.json({ success: true, data: parties });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch parties" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      partyType = "FRIEND", // FRIEND, FAMILY, EMPLOYER, INSTITUTION, LENDER
      alias = "",
      externalAccount = "",
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Contact name is required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const baseCode = cleanName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 20);

    // Ensure unique party code
    let code = baseCode || `PARTY_${Date.now()}`;
    const existing = await prisma.party.findUnique({ where: { code } });
    if (existing) {
      code = `${baseCode}_${Date.now().toString().slice(-4)}`;
    }

    const aliases = alias && alias.trim() ? [alias.trim()] : [];
    const externalAccounts = externalAccount && externalAccount.trim() ? [externalAccount.trim()] : [];

    const created = await prisma.party.create({
      data: {
        code,
        name: cleanName,
        partyType,
        aliasesJson: aliases.length > 0 ? JSON.stringify(aliases) : null,
        externalAccountsJson: externalAccounts.length > 0 ? JSON.stringify(externalAccounts) : null,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("Error in POST /api/parties:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create contact" },
      { status: 400 }
    );
  }
}

