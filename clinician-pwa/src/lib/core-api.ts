import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import type { ApiResult } from "./types";

/**
 * Server-only core-api client for the clinician PWA. Reads the logged-in
 * bearer from the httpOnly session cookie and talks to core-api with the
 * `{data}` / `{error:{message}}` envelope convention used across HealthcareOS.
 *
 * This module must never be imported from a client component — it touches
 * `next/headers` cookies and the bearer token.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export async function sessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || undefined;
}

/** Core fetch wrapper: attaches the session bearer and unwraps the envelope. */
export async function coreApi<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown> }
): Promise<ApiResult<T>> {
  const token = await sessionToken();
  if (!token) return { ok: false, status: 401, error: "Your session has expired. Sign in again." };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body ? { "content-type": "application/json" } : {})
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {})
    });
    const envelope = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, status: res.status, error: envelope.error?.message };
    }
    return { ok: true, data: envelope.data as T };
  } catch {
    return { ok: false, status: 0, error: "Unable to reach the server. Try again." };
  }
}
