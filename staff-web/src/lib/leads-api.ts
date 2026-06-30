import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type {
  EnrichedCallback,
  Lead,
  LeadConfig,
  LeadDetail,
  LeadForm,
  LeadFunnel
} from "./leads-types";
import { resolveLeadConfig } from "./leads-types";

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

/**
 * Full lead-detail bundle (the lead + its notes, callbacks and merged timeline)
 * served by `GET /leads/:leadId`. The arrays may be empty.
 */
export async function fetchLeadDetail(leadId: string): Promise<ApiResult<LeadDetail>> {
  return coreApi<LeadDetail>(`/leads/${encodeURIComponent(leadId)}`);
}

/**
 * All open callbacks across every lead, enriched with `leadName` + `leadPhone`
 * and sorted most-overdue-first by the backend. Powers the Tasks subtab.
 */
export async function fetchOpenCallbacks(): Promise<ApiResult<EnrichedCallback[]>> {
  return coreApi<EnrichedCallback[]>("/lead-callbacks?status=open");
}

/**
 * Tenant-configured lead sources + ordered funnel stages. Always resolves to
 * non-empty, usable lists: if the endpoint is unavailable or returns empty, it
 * falls back to sensible defaults so the board still renders.
 */
export async function fetchLeadConfig(): Promise<LeadConfig> {
  const result = await coreApi<Partial<LeadConfig>>("/tenant/lead-config");
  return resolveLeadConfig(result.ok ? result.data : null);
}
