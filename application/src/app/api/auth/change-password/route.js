// API Route: POST /api/auth/change-password
// Updates user password (used both during forced first login and Settings security updates)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireUser,
  verifyPassword,
  hashPassword,
  SAFE_USER_SELECT,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { user, errorResponse } = await requireUser(request, { allowMustChangePassword: true });
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Current password and new password are required" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const matchesCurrent = await verifyPassword(currentPassword, dbUser?.passwordHash);
    if (!matchesCurrent) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    if (user.mustChangePassword && currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "New personal password must differ from your temporary password",
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({
      success: true,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("Error in POST /api/auth/change-password:", error);
    return NextResponse.json(
      { success: false, error: "Failed to change password" },
      { status: 500 }
    );
  }
}
