import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hcos_platform_session";

// Public routes that never require an authenticated session.
const PUBLIC_PATHS = ["/login", "/login/verify", "/reset-password"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function middleware(req: NextRequest) {
  // Dev escape hatch: keep local iteration easy when explicitly opted in.
  if (process.env.PLATFORM_AUTH_MODE === "open") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const authed = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (authed) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclude Next internals, static assets, and the favicon from auth checks.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"]
};
