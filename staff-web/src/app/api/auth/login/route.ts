import { NextResponse } from "next/server";
import { SEED_USERS, verifyPassword, signSession, SESSION_COOKIE_NAME, SESSION_EXPIRY_SECONDS } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = SEED_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Constant-time delay to prevent timing attacks
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const { passwordHash: _ph, ...session } = user;
  const token = await signSession(session);

  const response = NextResponse.json({ ok: true, name: user.name, role: user.role });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_EXPIRY_SECONDS,
    path: "/"
  });
  return response;
}
