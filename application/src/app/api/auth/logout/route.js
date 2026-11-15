// API Route: POST /api/auth/logout
// Clears the HTTP-only auth_token session cookie

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import { clearAuthCookie } from "@/server/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ request }) => {
    const response = NextResponse.json({ success: true });
    clearAuthCookie(response, request);
    return response;
  },
  { auth: false }
);
