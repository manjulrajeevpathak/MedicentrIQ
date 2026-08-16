import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type {
  ClinicalRecord,
  ConditionCatalogEntry,
  DirectoryPatient,
  PatientDetail,
  PatientDocument,
  PatientVisit,
  TimelineEvent
} from "./patients-types";

/**
 * Server-only fetch helpers for the Patients / Patient 360 surface. Each reuses
 * the session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./patients-types.
 */

export type { ApiResult } from "./users-types";

export async function fetchPatientDirectory(): Promise<ApiResult<DirectoryPatient[]>> {
  return coreApi<DirectoryPatient[]>("/patients");
}

export async function fetchPatientDetail(id: string): Promise<ApiResult<PatientDetail>> {
  return coreApi<PatientDetail>(`/patients/${encodeURIComponent(id)}`);
}

export async function fetchPatientTimeline(id: string): Promise<ApiResult<TimelineEvent[]>> {
  return coreApi<TimelineEvent[]>(`/patients/${encodeURIComponent(id)}/timeline`);
}

export async function fetchConditionCatalog(): Promise<ApiResult<ConditionCatalogEntry[]>> {
  return coreApi<ConditionCatalogEntry[]>("/clinical/conditions");
}

export async function fetchPatientClinical(id: string): Promise<ApiResult<ClinicalRecord>> {
  return coreApi<ClinicalRecord>(`/patients/${encodeURIComponent(id)}/clinical`);
}

export async function fetchPatientDocuments(id: string): Promise<ApiResult<PatientDocument[]>> {
  return coreApi<PatientDocument[]>(`/patients/${encodeURIComponent(id)}/documents`);
}

export async function fetchPatientVisits(id: string): Promise<ApiResult<PatientVisit[]>> {
  return coreApi<PatientVisit[]>(`/appointments?patientId=${encodeURIComponent(id)}`);
}
