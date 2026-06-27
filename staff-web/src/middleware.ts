import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Gate the authed app behind a session cookie. Public auth routes and static
 * assets pass through. In `demo` auth mode the whole check is bypassed so the
 * existing cookie-less demo experience keeps working.
 */
// `/f/<slug>` is the public camp/lead-capture form — shared with the world, so
// it must resolve without a session, like the auth pages.
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/f"];

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === "demo") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Public auth pages (covers /login, /login/verify, /forgot-password, /reset-password).
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
  // Exclude Next internals, the API routes, the favicon, and any file with an
  // extension (static assets) from the auth check.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\..*).*)"]
};
