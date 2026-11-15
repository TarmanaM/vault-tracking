// API Route: POST /api/auth/change-password
// Updates user password (used both during forced first login and Settings security updates)

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import { changePasswordSchema } from "@/shared/schemas";
import {
  changeUserPassword,
  setAuthCookie,
} from "@/server/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ request, user, body }) => {
    const { user: updatedUser, token } = await changeUserPassword(user.id, body);
    const response = NextResponse.json({
      success: true,
      data: { user: updatedUser },
    });
    setAuthCookie(response, token, request);
    return response;
  },
  { auth: "ALLOW_MUST_CHANGE_PASSWORD", bodySchema: changePasswordSchema }
);
