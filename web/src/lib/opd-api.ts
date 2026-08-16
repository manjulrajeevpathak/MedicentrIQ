import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type {
  IntakeDoctor,
  IntakeLookupResult,
  Visit,
  VisitListFilters
} from "./opd-types";

/**
 * Server-only fetch helpers for the OPD walk-in intake surface. Each reuses the
 * session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./opd-types; server actions in
 * src/app/(app)/opd/actions.ts.
 */

export type { ApiResult } from "./users-types";

export async function fetchVisits(filter?: VisitListFilters): Promise<ApiResult<Visit[]>> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.date) params.set("date", filter.date);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  if (filter?.doctorId) params.set("doctorId", filter.doctorId);
  if (filter?.patientId) params.set("patientId", filter.patientId);
  const qs = params.toString();
  return coreApi<Visit[]>(`/visits${qs ? `?${qs}` : ""}`);
}

export async function fetchVisit(id: string): Promise<ApiResult<Visit>> {
  return coreApi<Visit>(`/visits/${encodeURIComponent(id)}`);
}

/** core-api returns `[{id,name,specialty,status}]` for the OPD doctor select. */
export async function fetchIntakeDoctors(): Promise<ApiResult<IntakeDoctor[]>> {
  return coreApi<IntakeDoctor[]>("/doctors");
}

export async function lookupIntake(phone: string): Promise<ApiResult<IntakeLookupResult>> {
  return coreApi<IntakeLookupResult>(`/intake/lookup?phone=${encodeURIComponent(phone)}`);
}
