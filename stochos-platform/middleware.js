// =============================================================================
// Route Protection Middleware
// =============================================================================
// Lightweight middleware that checks for auth session cookie.
// Does NOT import Prisma or heavy Node.js modules (Edge runtime compatible).
// =============================================================================

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const divisionAccessMap = {
  "/spatial-ops": { divisions: ["OPERATIONS", "EXECUTIVE"], roles: [] },
  "/analytics": { divisions: ["FINANCE", "OPERATIONS", "EXECUTIVE"], roles: ["analyst", "manager"] },
  "/reporting": { divisions: ["FINANCE", "EXECUTIVE"], roles: ["analyst"] },
  "/fomo": { divisions: ["OPERATIONS", "EXECUTIVE"], roles: ["manager", "sales_rep"] },
  "/fleet": { divisions: ["OPERATIONS", "EXECUTIVE"], roles: ["manager", "sales_rep"] },
  "/contracts": { divisions: ["PROCUREMENT", "EXECUTIVE"], roles: ["procurement_officer"] },
  "/vendors": { divisions: ["PROCUREMENT", "EXECUTIVE"], roles: ["procurement_officer"] },
  "/marketing": { divisions: ["MARKETING", "EXECUTIVE"], roles: ["marketing_manager"] },
  "/instant-tickets": { divisions: ["MARKETING", "EXECUTIVE"], roles: ["marketing_manager"] },
  "/assets": { divisions: ["IT", "EXECUTIVE"], roles: ["it_manager"] },
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
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
  const userDivision = token.division || "";

  // Admins bypass all route checks
  if (userRole === "admin") {
    return NextResponse.next();
  }

  // Check section access
  for (const [routePrefix, rule] of Object.entries(divisionAccessMap)) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + "/")) {
      const hasDivisionAccess = rule.divisions.includes(userDivision);
      const hasRoleAccess = rule.roles.includes(userRole);

      if (!hasDivisionAccess && !hasRoleAccess) {
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
