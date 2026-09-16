import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth-constants";

const PUBLIC_PATHS = ["/login", "/api/health", "/offline"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    // The official IVS logo file has not been received yet (see
    // REVIEW_REPORT.md, Etapa 5) — this stays ready for when it's added to
    // public/, but there is currently no ivs-logo.png being served, so
    // referencing it here is dead configuration, not a broken feature.
    pathname === "/ivs-logo.png";

  if (isPublic || isStaticAsset) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession && !pathname.startsWith("/api/admin/import")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
