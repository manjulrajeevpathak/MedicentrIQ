import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { Lead, LeadForm, LeadFunnel } from "./leads-types";

/**
 * Server-only fetch helpers for the Leads / Growth surface. Each reuses the
 * session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./leads-types. The PUBLIC camp-form fetch + submit
 * live in src/app/f/[slug]/actions.ts (no bearer).
 */

export type { ApiResult } from "./users-types";

export async function fetchLeads(filters?: {
  stage?: string;
  source?: string;
}): Promise<ApiResult<Lead[]>> {
  const params = new URLSearchParams();
  if (filters?.stage) params.set("stage", filters.stage);
  if (filters?.source) params.set("source", filters.source);
  const qs = params.toString();
  return coreApi<Lead[]>(`/leads${qs ? `?${qs}` : ""}`);
}

export async function fetchLeadFunnel(): Promise<ApiResult<LeadFunnel>> {
  return coreApi<LeadFunnel>("/leads/funnel");
}

export async function fetchForms(): Promise<ApiResult<LeadForm[]>> {
  return coreApi<LeadForm[]>("/forms");
}
