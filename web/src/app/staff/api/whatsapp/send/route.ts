import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Outbound WhatsApp send for the inbox. Routes through core-api's per-tenant
 * channel layer (transactional → the hospital's own UltraMsg config), so no
 * global credential is used and each hospital sends from its own number.
 */
const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Sign in to send messages." }, { status: 401 });
  }

  let payload: { to?: string; body?: string };
  try {
    payload = (await request.json()) as { to?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const to = (payload.to ?? "").trim();
  const body = (payload.body ?? "").trim();
  if (!to) return NextResponse.json({ ok: false, error: "Recipient number (to) is required." }, { status: 400 });
  if (!body) return NextResponse.json({ ok: false, error: "Message body is required." }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/messages/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ to, type: "transactional", body })
    });
    const envelope = (await res.json().catch(() => ({}))) as { data?: { ok: boolean; providerId?: string; error?: string }; error?: { message?: string } };
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: envelope.error?.message ?? "WhatsApp channel is not configured for this hospital." }, { status: res.status });
    }
    const result = envelope.data;
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error ?? "The provider rejected the message." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: result.providerId ?? null, to });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to reach the messaging service.", detail: String(error) }, { status: 502 });
  }
}
