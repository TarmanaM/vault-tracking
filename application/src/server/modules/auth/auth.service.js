// Authentication, Fail-Fast JWT Session Cookie & Role Access Service
import "server-only";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SAFE_USER_SELECT,
  findSafeUserById,
  findUserWithHashByUsername,
  findUserWithHashById,
  updateUserPasswordById,
  recordUserLoginTimestamp,
  deleteUserAccountCascadeInTx,
} from "./auth.repository.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/server/http/errors";

export { SAFE_USER_SELECT };

export const AUTH_COOKIE_NAME = "auth_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const DEV_FALLBACK_JWT_SECRET = "vault_tracking_dev_only_secret_key_local_2026_32chars";

/**
 * Resolve JWT signing secret with fail-fast enforcement in production.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET ? String(process.env.JWT_SECRET).trim() : "";
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || secret === "your_jwt_secret_here") {
      throw new Error(
        "FATAL: JWT_SECRET environment variable must be configured with at least 32 characters in production."
      );
    }
    return secret;
  }
  return secret || DEV_FALLBACK_JWT_SECRET;
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

export async function getSessionUser(request = null) {
  const token = await extractTokenFromRequest(request);
  if (!token) return { user: null, reason: "UNAUTHENTICATED" };

  const decoded = verifyAuthToken(token);
  const userId = parseInt(decoded?.sub, 10);
  if (!decoded || Number.isNaN(userId)) {
    return { user: null, reason: "INVALID_TOKEN" };
  }

  const user = await findSafeUserById(userId);
  if (!user) {
    return { user: null, reason: "USER_NOT_FOUND" };
  }
  if (!user.isActive) {
    return { user: null, reason: "ACCOUNT_DISABLED" };
  }

  return { user, reason: "OK" };
}

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

export async function authenticateUserCredentials({ username, password }) {
  const user = await findUserWithHashByUsername(username);
  if (!user) {
    throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
  }
  if (!user.isActive) {
    throw new ForbiddenError(
      "Your account has been deactivated. Please contact the administrator.",
      "ACCOUNT_DISABLED"
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
  }

  const previousLoginAt = user.lastLoginAt || null;
  const nowLoginAt = await recordUserLoginTimestamp(user.id);
  const token = signAuthToken(user);
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      onboardingCompleted: user.onboardingCompleted,
      onboardingSkipped: user.onboardingSkipped,
      lastLoginAt: nowLoginAt,
      previousLoginAt,
    },
  };
}

export async function changeUserPassword(userId, { currentPassword, newPassword }) {
  if (currentPassword === newPassword) {
    throw new BadRequestError("New password must be different from the current password.");
  }

  const fullUser = await findUserWithHashById(userId);
  if (!fullUser) {
    throw new UnauthorizedError("User not found.", "USER_NOT_FOUND");
  }

  const matches = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!matches) {
    throw new BadRequestError("Current password is incorrect.");
  }

  const newHash = await hashPassword(newPassword);
  const updatedUser = await updateUserPasswordById(userId, newHash);
  const token = signAuthToken(updatedUser);

  return { user: updatedUser, token };
}

export async function deleteOwnUserAccount(userId, { password }) {
  if (!password) {
    throw new BadRequestError("Current password is required to delete your account.");
  }

  const fullUser = await findUserWithHashById(userId);
  if (!fullUser) {
    throw new UnauthorizedError("User not found.", "USER_NOT_FOUND");
  }

  const matches = await verifyPassword(password, fullUser.passwordHash);
  if (!matches) {
    throw new BadRequestError("Incorrect password. Account deletion cancelled.");
  }

  return await deleteUserAccountCascadeInTx(userId);
}
