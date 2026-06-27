import "server-only";

/**
 * Server-only client for the core-api platform endpoints.
 *
 * The platform API key MUST stay server-side. It is read from the
 * non-public env var `PLATFORM_API_KEY` and is only ever attached to
 * requests made from Server Components / Server Actions. It must never
 * be exposed to client code or serialized to the browser.
 */

const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:4100";
const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY ?? "platform_demo_key";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CORE_API_URL}${path}`, {
    ...init,
    headers: {
      "x-platform-api-key": PLATFORM_API_KEY,
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
