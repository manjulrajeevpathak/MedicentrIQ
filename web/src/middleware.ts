import { NextResponse, type NextRequest } from "next/server";

/**
 * One middleware for the unified app: dispatch by path prefix to each segment's
 * own auth model. Session cookies are kept as literals here to avoid importing
 * across the namespaced src trees.
 *   /staff     → hcos_session          (bypass NEXT_PUBLIC_AUTH_MODE=demo)
 *   /console   → hcos_platform_session (bypass PLATFORM_AUTH_MODE=open)
 *   /clinician → hcos_clinician_session
 *   /care, /   → public (patient token-in-URL flow / landing)
 */
const STAFF_COOKIE = "hcos_session";
const CONSOLE_COOKIE = "hcos_platform_session";
const CLINICIAN_COOKIE = "hcos_clinician_session";

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const isPublic = (path: string, prefixes: string[]) => prefixes.some((p) => isUnder(path, p));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const gate = (cookie: string, loginPath: string) => {
    if (request.cookies.get(cookie)?.value) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = "";
    return NextResponse.redirect(url);
  };

  // Staff console.
  if (isUnder(pathname, "/staff")) {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === "demo") return NextResponse.next();
    if (isPublic(pathname, ["/staff/login", "/staff/forgot-password", "/staff/reset-password", "/staff/f"]))
      return NextResponse.next();
    // /staff/api/whatsapp/send self-guards (checks the session cookie itself).
    if (pathname.startsWith("/staff/api/")) return NextResponse.next();
    return gate(STAFF_COOKIE, "/staff/login");
  }

  // Platform superadmin console.
  if (isUnder(pathname, "/console")) {
    if (process.env.PLATFORM_AUTH_MODE === "open") return NextResponse.next();
    if (isPublic(pathname, ["/console/login", "/console/reset-password"])) return NextResponse.next();
    return gate(CONSOLE_COOKIE, "/console/login");
  }

  // Clinician PWA. Note: /clinician/api/conditions stays gated (it does not self-guard).
  if (isUnder(pathname, "/clinician")) {
    if (isPublic(pathname, ["/clinician/login"])) return NextResponse.next();
    return gate(CLINICIAN_COOKIE, "/clinician/login");
  }

  // /care (patient token flow) and the landing page are public.
  return NextResponse.next();
}

export const config = {
  // Exclude Next internals, favicon, and any file with an extension (static
  // assets incl. /clinician/sw.js + manifest). Segment branches handle API paths.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
