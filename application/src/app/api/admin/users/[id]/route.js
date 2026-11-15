// API Route: PATCH /api/admin/users/[id]
// Handles Admin account status toggling, password reset, and basic metadata updates

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword, SAFE_USER_SELECT } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { user: adminUser, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const resolved = await params;
    const targetId = parseInt(resolved?.id, 10);
    if (!targetId || Number.isNaN(targetId)) {
      return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }

    const body = await request.json();
    const action = String(body.action || "UPDATE").toUpperCase();

    if (action === "RESET_PASSWORD") {
      if (target.id === adminUser.id) {
        return NextResponse.json(
          {
            success: false,
            error: "Use Settings > Account Security to change your own password.",
          },
          { status: 400 }
        );
      }

      const temporaryPassword = String(body.temporaryPassword || "");
      if (temporaryPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: "Temporary password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(temporaryPassword);
      const updated = await prisma.user.update({
        where: { id: targetId },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
        select: SAFE_USER_SELECT,
      });

      return NextResponse.json({
        success: true,
        data: updated,
      });
    }

    const updateData = {};

    if (body.isActive !== undefined) {
      const nextActive = Boolean(body.isActive);
      if (target.id === adminUser.id && !nextActive) {
        return NextResponse.json(
          { success: false, error: "You cannot deactivate your own active Admin account" },
          { status: 400 }
        );
      }
      if (!nextActive && target.role === "ADMIN") {
        const otherActiveAdmins = await prisma.user.count({
          where: { id: { not: targetId }, role: "ADMIN", isActive: true },
        });
        if (otherActiveAdmins === 0) {
          return NextResponse.json(
            { success: false, error: "At least one active ADMIN account must remain active" },
            { status: 400 }
          );
        }
      }
      updateData.isActive = nextActive;
    }

    if (body.role !== undefined) {
      const nextRole = String(body.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
      if (target.id === adminUser.id && nextRole !== "ADMIN") {
        return NextResponse.json(
          { success: false, error: "You cannot remove ADMIN role from your own account" },
          { status: 400 }
        );
      }
      if (target.role === "ADMIN" && nextRole !== "ADMIN") {
        const otherActiveAdmins = await prisma.user.count({
          where: { id: { not: targetId }, role: "ADMIN", isActive: true },
        });
        if (otherActiveAdmins === 0) {
          return NextResponse.json(
            { success: false, error: "Cannot demote the last active ADMIN account" },
            { status: 400 }
          );
        }
      }
      updateData.role = nextRole;
    }

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName || "").trim();
      if (fullName.length < 2) {
        return NextResponse.json(
          { success: false, error: "Full name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updateData.fullName = fullName;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid account fields supplied" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/users/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update account" },
      { status: 500 }
    );
  }
}
