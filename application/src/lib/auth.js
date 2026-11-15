// Authentication, JWT Session Cookie & Role Access Helpers for Vault Tracking v2.0
// Enforces Rule 9 (English comments) and live DB account status checks

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "./prisma.js";

export const AUTH_COOKIE_NAME = "auth_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export const SAFE_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  onboardingCompleted: true,
  onboardingSkipped: true,
  onboardingProfileJson: true,
  createdAt: true,
  updatedAt: true,
};

function getJwtSecret() {
  return process.env.JWT_SECRET || "vault_tracking_secret_key_local_2026";
}

export async function hashPassword(plainPassword) {
  return await bcrypt.hash(String(plainPassword), 10);
}

export async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) return false;
  return await bcrypt.compare(String(plainPassword), String(passwordHash));
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

export function verifyAuthToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

/**
 * Determine whether the request was served over HTTPS (tunnel/reverse proxy or direct TLS)
 * Keeps cookies working over local LAN HTTP (http://192.168.x.x:3000) in production builds
 */
export function isHttpsRequest(request) {
  if (!request) return false;
  const forwardedProto = request.headers?.get?.("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return request.nextUrl?.protocol === "https:";
}

export function setAuthCookie(response, token, request = null) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
    secure: isHttpsRequest(request),
  });
  return response;
}

export function clearAuthCookie(response, request = null) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isHttpsRequest(request),
  });
  return response;
}

async function extractTokenFromRequest(request) {
  const cookieToken = request?.cookies?.get?.(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;
  try {
    const cookieStore = await cookies();
    return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the currently authenticated user directly from SQLite so deactivation
 * and role updates take effect immediately without waiting for JWT expiry.
 */
export async function getSessionUser(request = null) {
  const token = await extractTokenFromRequest(request);
  if (!token) return { user: null, reason: "UNAUTHENTICATED" };

  const decoded = verifyAuthToken(token);
  const userId = parseInt(decoded?.sub, 10);
  if (!decoded || Number.isNaN(userId)) {
    return { user: null, reason: "INVALID_TOKEN" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });

  if (!user) {
    return { user: null, reason: "USER_NOT_FOUND" };
  }
  if (!user.isActive) {
    return { user: null, reason: "ACCOUNT_DISABLED" };
  }

  return { user, reason: "OK" };
}

/**
 * Route guard returning either { user } or { errorResponse }
 */
export async function requireUser(request = null, { allowMustChangePassword = false } = {}) {
  const { user, reason } = await getSessionUser(request);

  if (!user) {
    const isDisabled = reason === "ACCOUNT_DISABLED";
    const res = NextResponse.json(
      {
        success: false,
        code: isDisabled ? "ACCOUNT_DISABLED" : "UNAUTHORIZED",
        error: isDisabled
          ? "Your account has been deactivated by an administrator."
          : "Authentication required. Please sign in.",
      },
      { status: isDisabled ? 403 : 401 }
    );
    clearAuthCookie(res, request);
    return { user: null, errorResponse: res };
  }

  if (!allowMustChangePassword && user.mustChangePassword) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          code: "PASSWORD_CHANGE_REQUIRED",
          error: "Please set a new personal password before accessing this resource.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * Admin route guard: verifies active ADMIN role.
 * Admin endpoints MUST remain strictly scoped to non-financial user metadata.
 */
export async function requireAdmin(request = null) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return { user: null, errorResponse };

  if (user.role !== "ADMIN") {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          error: "Administrator privileges are required.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}
