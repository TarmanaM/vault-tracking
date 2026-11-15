// API Route: POST /api/auth/login
// Authenticates user credentials via bcrypt and issues HTTP-only auth_token JWT cookie

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signAuthToken, setAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const rawUsername = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!rawUsername || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: rawUsername },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_DISABLED",
          error: "Your account has been deactivated by an administrator.",
        },
        { status: 403 }
      );
    }

    const token = signAuthToken(user);
    const safeUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      onboardingCompleted: user.onboardingCompleted,
      onboardingSkipped: user.onboardingSkipped,
    };

    const response = NextResponse.json({
      success: true,
      data: { user: safeUser },
    });
    setAuthCookie(response, token, request);
    return response;
  } catch (error) {
    console.error("Error in POST /api/auth/login:", error);
    return NextResponse.json(
      { success: false, error: "Failed to authenticate user" },
      { status: 500 }
    );
  }
}
