import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Gate the app behind the clinician session cookie. The login route and PWA
 * assets pass through; everything else redirects to /login when signed out.
 */
const PUBLIC_PREFIXES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const authenticated = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (authenticated) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclude Next internals, the favicon, the PWA manifest + service worker, and
  // any file with an extension (static assets) from the auth check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\..*).*)"]
};
