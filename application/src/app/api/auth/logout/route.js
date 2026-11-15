// API Route: POST /api/auth/logout
// Clears the HTTP-only auth_token session cookie

import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response, request);
  return response;
}
