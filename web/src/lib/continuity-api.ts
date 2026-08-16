import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { FollowUp } from "./continuity-types";

/**
 * Server-only fetch helpers for the Continuity / follow-up surface. Each reuses
 * the session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./continuity-types.
 */

export type { ApiResult } from "./users-types";

export async function fetchFollowUps(filters?: {
  status?: string;
}): Promise<ApiResult<FollowUp[]>> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return coreApi<FollowUp[]>(`/followups${qs ? `?${qs}` : ""}`);
}
