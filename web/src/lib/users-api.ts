import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import type { ApiResult, Branch, ChannelStatus, UsersPayload } from "./users-types";

/**
 * Server-only helpers for the org-admin User Management surface. Reads the
 * logged-in session bearer from the httpOnly cookie and talks to core-api with
 * the `{data}` / `{error:{message}}` envelope convention used across the app.
 * Client-safe types + label constants live in ./users-types.
 */

const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export type {
  ApiResult,
  Branch,
  ChannelStatus,
  ManagedUser,
  MfaPolicy,
  Seats,
  StaffRole,
  UsersPayload
} from "./users-types";

async function sessionToken(): Promise<string | undefined> {
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

export async function fetchUsers(): Promise<ApiResult<UsersPayload>> {
  return coreApi<UsersPayload>("/users");
}

type MePayload = {
  context?: { roles?: string[] } & Record<string, unknown>;
  branches?: Branch[];
  entitlements?: Record<string, unknown>;
};

export async function fetchBranches(): Promise<Branch[]> {
  const result = await coreApi<MePayload>("/auth/me");
  if (!result.ok) return [];
  return result.data.branches ?? [];
}

/** Roles that may edit tenant-level config (e.g. the lead funnel). */
const ADMIN_ROLES = new Set(["org_admin", "department_admin", "platform_admin"]);

/** True when the signed-in user can edit tenant config (funnel, etc.). */
export async function fetchIsTenantAdmin(): Promise<boolean> {
  const result = await coreApi<MePayload>("/auth/me");
  if (!result.ok) return false;
  const roles = result.data.context?.roles ?? [];
  return roles.some((r) => ADMIN_ROLES.has(r));
}

/**
 * Tenant branches with the patient-facing contact + map fields (phone, address,
 * mapUrl) — backs the Admin → Clinic locations panel.
 */
export async function fetchTenantBranches(): Promise<Branch[]> {
  const result = await coreApi<{ branches: Branch[] }>("/tenant/branches");
  if (!result.ok) return [];
  return result.data.branches ?? [];
}

export async function fetchChannels(): Promise<ApiResult<ChannelStatus>> {
  return coreApi<ChannelStatus>("/tenant/channels");
}
