import "server-only";

import { cookies } from "next/headers";

/**
 * Server-only client for the core-api platform endpoints.
 *
 * Auth wiring:
 *  - If a per-admin session cookie (`hcos_platform_session`) is present, its
 *    token is sent as `Authorization: Bearer <token>` and the shared platform
 *    API key is DROPPED.
 *  - Otherwise we fall back to the shared `x-platform-api-key` so dev still
 *    works before anyone has logged in.
 *
 * The platform API key MUST stay server-side. It is read from the
 * non-public env var `PLATFORM_API_KEY` and is only ever attached to
 * requests made from Server Components / Server Actions. It must never
 * be exposed to client code or serialized to the browser.
 */

const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:4100";
const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY ?? "platform_demo_key";

export const SESSION_COOKIE = "hcos_platform_session";

export type PlanId = "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  label: string;
  description: string;
  modules: string[];
}

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  alwaysOn: boolean;
}

export type TenantType = "hospital" | "clinic";
export type TenantStatus = "active" | "suspended" | string;

export interface TenantView {
  id: string;
  displayName: string;
  type: TenantType;
  status: TenantStatus;
  planId: PlanId;
  moduleOverrides: Record<string, boolean>;
  enabledModules: string[];
  branchCount: number;
  userCount: number;
  createdAt: string;
}

export interface TenantBranch {
  id: string;
  displayName: string;
  city: string;
  status: string;
}

export interface TenantAdmin {
  id: string;
  displayName: string;
  email: string;
}

export interface TenantDetail extends TenantView {
  branches: TenantBranch[];
  admins: TenantAdmin[];
}

export interface CreateTenantInput {
  displayName: string;
  type: TenantType;
  planId: PlanId;
  branchName: string;
  branchCity: string;
  adminName: string;
  adminEmail: string;
  moduleOverrides?: Record<string, boolean>;
}

export interface UpdateTenantPatch {
  planId?: PlanId;
  status?: TenantStatus;
  type?: TenantType;
  displayName?: string;
  moduleOverrides?: Record<string, boolean>;
}

interface ApiSuccess<T> {
  data: T;
  error?: undefined;
}

interface ApiFailure {
  data?: undefined;
  error: { message: string };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Resolve the auth headers for a platform call. Prefers the per-admin session
 * token (Bearer) and falls back to the shared platform API key. Reading
 * `cookies()` is async, so this helper is async too.
 */
async function authHeaders(): Promise<Record<string, string>> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  } catch {
    // cookies() can throw outside a request scope; fall back to the API key.
    token = undefined;
  }

  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return { "x-platform-api-key": PLATFORM_API_KEY };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${CORE_API_URL}${path}`, {
    ...init,
    headers: {
      ...auth,
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // fall through to status-based error below
  }

  if (body && "error" in body && body.error) {
    throw new Error(body.error.message);
  }

  if (!res.ok) {
    throw new Error(`core-api request failed (${res.status}) for ${path}`);
  }

  if (!body || !("data" in body) || body.data === undefined) {
    throw new Error(`Malformed response from core-api for ${path}`);
  }

  return body.data;
}

export function listPlans(): Promise<Plan[]> {
  return request<Plan[]>("/platform/plans");
}

export function listModules(): Promise<ModuleDefinition[]> {
  return request<ModuleDefinition[]>("/platform/modules");
}

export function listTenants(): Promise<TenantView[]> {
  return request<TenantView[]>("/platform/tenants");
}

export function getTenant(id: string): Promise<TenantDetail> {
  return request<TenantDetail>(`/platform/tenants/${encodeURIComponent(id)}`);
}

export function createTenant(input: CreateTenantInput): Promise<TenantDetail> {
  return request<TenantDetail>("/platform/tenants", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTenant(
  id: string,
  patch: UpdateTenantPatch
): Promise<TenantDetail> {
  return request<TenantDetail>(`/platform/tenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export function updateTenantUser(
  tenantId: string,
  userId: string,
  patch: { displayName?: string; email?: string; status?: string }
): Promise<{ user: { id: string; displayName: string; email?: string; status: string } }> {
  return request(`/platform/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

/* ----------------------------------------------------------------------------
   Auth — per-admin login, OTP verification, forced password change.

   These endpoints return their payload directly (not wrapped in `{data}`),
   except on failure where the shape is `{error:{message}}`. We call core-api
   without the session cookie / shared key (login is unauthenticated; the
   password-change call carries an explicit Bearer token).
   ------------------------------------------------------------------------- */

export interface AdminPrincipal {
  id: string;
  email: string;
  displayName?: string;
  roles?: string[];
  scope?: string;
}

export interface LoginSuccess {
  token: string;
  expiresAt: string;
  principal: AdminPrincipal;
  mfaRequired?: undefined;
  mustResetPassword?: undefined;
}

export interface LoginMfaRequired {
  mfaRequired: true;
  challengeId: string;
  email: string;
  token?: undefined;
}

export interface LoginMustReset {
  mustResetPassword: true;
  token: string;
  expiresAt?: string;
  principal?: AdminPrincipal;
}

export type LoginResult = LoginSuccess | LoginMfaRequired | LoginMustReset;

export interface PasswordChangeResult {
  ok: boolean;
  token: string;
  expiresAt: string;
}

async function authRequest<T>(
  path: string,
  body: unknown,
  bearer?: string
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (bearer) {
    headers.authorization = `Bearer ${bearer}`;
  }

  const res = await fetch(`${CORE_API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store"
  });

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // fall through to status-based error below
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    (parsed as ApiFailure).error
  ) {
    throw new Error((parsed as ApiFailure).error.message);
  }

  if (!res.ok) {
    throw new Error(`core-api request failed (${res.status}) for ${path}`);
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    (parsed as { data: unknown }).data !== undefined
  ) {
    return (parsed as { data: T }).data;
  }

  return parsed as T;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return authRequest<LoginResult>("/auth/login", { email, password });
}

export function verifyLoginOtp(
  challengeId: string,
  code: string
): Promise<LoginSuccess> {
  return authRequest<LoginSuccess>("/auth/login/verify-otp", {
    challengeId,
    code
  });
}

export function changePassword(
  token: string,
  newPassword: string
): Promise<PasswordChangeResult> {
  return authRequest<PasswordChangeResult>(
    "/auth/password/change",
    { newPassword },
    token
  );
}

/* ----------------------------------------------------------------------------
   Platform admins management (Bearer or shared key via request()).
   ------------------------------------------------------------------------- */

export type AdminStatus = "active" | "inactive" | string;

export interface PlatformAdmin {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  status: AdminStatus;
  mfaEnabled: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateAdminResult {
  admin: PlatformAdmin;
  tempPassword: string;
}

export function listAdmins(): Promise<PlatformAdmin[]> {
  return request<PlatformAdmin[]>("/platform/admins");
}

export function createAdmin(input: {
  displayName: string;
  email: string;
  password?: string;
}): Promise<CreateAdminResult> {
  return request<CreateAdminResult>("/platform/admins", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateAdmin(
  id: string,
  patch: { status?: AdminStatus; displayName?: string }
): Promise<{ admin: PlatformAdmin }> {
  return request<{ admin: PlatformAdmin }>(
    `/platform/admins/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch)
    }
  );
}
