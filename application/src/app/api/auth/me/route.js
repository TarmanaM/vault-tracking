// API Route: GET /api/auth/me, PATCH /api/auth/me
// Returns active authenticated user session & per-user app settings; updates own display name

import { NextResponse } from "next/server";
import prisma from "@/server/db/prisma";
import { withApiHandler } from "@/server/http/apiHandler";
import { BadRequestError } from "@/server/http/errors";
import {
  SAFE_USER_SELECT,
  clearAuthCookie,
  deleteOwnUserAccount,
} from "@/server/modules/auth/auth.service";
import { getOrCreateAppSettings } from "@/lib/fxService";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ user }) => {
    const appSetting = await getOrCreateAppSettings(user.id, prisma);
    return { user, appSetting, baseCurrency: appSetting.baseCurrency };
  },
  { auth: "ALLOW_MUST_CHANGE_PASSWORD", errorStatus: 500 }
);

export const PATCH = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || "").trim();
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError("Full name must be at least 2 characters");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { fullName },
      select: SAFE_USER_SELECT,
    });

    await tx.party.updateMany({
      where: { userId: user.id, code: "SELF" },
      data: { name: fullName },
    });

    return u;
  });

  return { user: updatedUser };
});

export const DELETE = withApiHandler(async ({ request, user }) => {
  const body = await request.json().catch(() => ({}));
  const result = await deleteOwnUserAccount(user.id, { password: body.password });
  const res = NextResponse.json({
    success: true,
    data: result,
  });
  clearAuthCookie(res, request);
  return res;
});
