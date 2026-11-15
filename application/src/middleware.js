// Lightweight Edge middleware that redirects page navigations missing the auth_token cookie to /login
// Full JWT verification and live DB account status checks occur inside Node API routes and AuthGate

import { NextResponse } from "next/server";

const PUBLIC_PAGE_PATHS = new Set(["/login"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PAGE_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
