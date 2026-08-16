import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { Campaign, ConditionCatalogEntry } from "./campaigns-types";

/**
 * Server-only fetch helpers for the Campaigns surface. Each reuses the
 * session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./campaigns-types. Mutations + the live
 * audience-preview action live in src/app/(app)/campaigns/actions.ts.
 */

export type { ApiResult } from "./users-types";

export async function fetchCampaigns(): Promise<ApiResult<Campaign[]>> {
  return coreApi<Campaign[]>("/campaigns");
}

export async function fetchConditionCatalog(): Promise<ApiResult<ConditionCatalogEntry[]>> {
  return coreApi<ConditionCatalogEntry[]>("/clinical/conditions");
}
