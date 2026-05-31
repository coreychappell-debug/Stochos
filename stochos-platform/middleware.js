// =============================================================================
// Route Protection Middleware
// =============================================================================
// Lightweight middleware that checks for auth session cookie.
// Does NOT import Prisma or heavy Node.js modules (Edge runtime compatible).
// =============================================================================

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const roleAccessMap = {
  "/spatial-ops": ["admin", "analyst", "manager"],
  "/analytics": ["admin", "analyst", "manager"],
  "/reporting": ["admin", "procurement_officer", "analyst"],
  "/fomo": ["admin", "sales_rep", "manager"],
  "/fleet": ["admin", "sales_rep", "manager"],
  "/contracts": ["admin", "procurement_officer"],
  "/vendors": ["admin", "procurement_officer"],
  "/marketing": ["admin", "marketing_manager"],
  "/instant-tickets": ["admin", "marketing_manager"],
  "/assets": ["admin", "it_manager"],
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/unauthorized"
  ) {
    return NextResponse.next();
  }

  // Decrypt and verify the JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = token.role || "";

  // Check section access
  for (const [routePrefix, allowedRoles] of Object.entries(roleAccessMap)) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + "/")) {
      if (!allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
