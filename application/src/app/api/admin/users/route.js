// API Route: GET /api/admin/users, POST /api/admin/users
// Strictly manages user account metadata only; Admin cannot inspect any user's financial ledger data

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword, SAFE_USER_SELECT } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        onboardingCompleted: true,
        onboardingSkipped: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const role = String(body.role || "USER").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
    const temporaryPassword = String(body.temporaryPassword || "");

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json(
        {
          success: false,
          error: "Username must be 3-32 characters (letters, numbers, dot, underscore, hyphen)",
        },
        { status: 400 }
      );
    }

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Full name is required (min 2 characters)" },
        { status: 400 }
      );
    }

    if (temporaryPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Temporary password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username "${username}" is already taken` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(temporaryPassword);

    const createdUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          fullName,
          role,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          onboardingCompleted: false,
          onboardingSkipped: false,
        },
        select: SAFE_USER_SELECT,
      });

      await tx.appSetting.create({
        data: {
          userId: u.id,
          baseCurrency: "IDR",
          fxSyncIntervalDays: 3,
        },
      });

      return u;
    });

    return NextResponse.json({
      success: true,
      data: createdUser,
    });
  } catch (error) {
    console.error("Error in POST /api/admin/users:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create user account" },
      { status: 500 }
    );
  }
}
