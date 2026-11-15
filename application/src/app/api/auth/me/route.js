// API Route: GET /api/auth/me, PATCH /api/auth/me
// Returns active authenticated user session & per-user app settings; updates own display name

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, SAFE_USER_SELECT } from "@/lib/auth";
import { getOrCreateAppSettings } from "@/lib/fxService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user, errorResponse } = await requireUser(request, { allowMustChangePassword: true });
  if (errorResponse) return errorResponse;

  const appSetting = await getOrCreateAppSettings(user.id, prisma);

  return NextResponse.json({
    success: true,
    data: {
      user,
      appSetting,
    },
  });
}

export async function PATCH(request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Full name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: { fullName },
        select: SAFE_USER_SELECT,
      });

      // Keep own SELF party display name aligned when present
      await tx.party.updateMany({
        where: { userId: user.id, code: "SELF" },
        data: { name: fullName },
      });

      return u;
    });

    return NextResponse.json({
      success: true,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("Error in PATCH /api/auth/me:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
