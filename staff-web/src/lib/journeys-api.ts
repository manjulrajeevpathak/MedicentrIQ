import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { JourneyTemplate, PatientJourney } from "./journeys-types";

/**
 * Server-only fetch helpers for the Journeys surface. Each reuses the
 * session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./journeys-types.
 */

export type { ApiResult } from "./users-types";

export async function fetchJourneyTemplates(): Promise<ApiResult<JourneyTemplate[]>> {
  return coreApi<JourneyTemplate[]>("/journey-templates");
}

export async function fetchPatientJourneys(filters?: {
  patientId?: string;
  status?: string;
}): Promise<ApiResult<PatientJourney[]>> {
  const params = new URLSearchParams();
  if (filters?.patientId) params.set("patientId", filters.patientId);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return coreApi<PatientJourney[]>(`/patient-journeys${qs ? `?${qs}` : ""}`);
}

export async function fetchPatientJourney(id: string): Promise<ApiResult<PatientJourney>> {
  return coreApi<PatientJourney>(`/patient-journeys/${encodeURIComponent(id)}`);
}
