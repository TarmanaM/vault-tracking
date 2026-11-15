// API Route: POST /api/auth/login
// Authenticates user credentials via bcrypt and issues HTTP-only auth_token JWT cookie

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import { loginSchema } from "@/shared/schemas";
import {
  authenticateUserCredentials,
  setAuthCookie,
} from "@/server/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ request, body }) => {
    const { user, token } = await authenticateUserCredentials(body);
    const response = NextResponse.json({
      success: true,
      data: { user },
    });
    setAuthCookie(response, token, request);
    return response;
  },
  { auth: false, bodySchema: loginSchema, errorStatus: 500 }
);
