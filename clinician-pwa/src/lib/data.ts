import { coreApi } from "./core-api";
import type {
  Appointment,
  ClinicalDocument,
  ClinicalRecord,
  ConditionOption,
  Patient
} from "./types";

/**
 * Server-only read helpers. Each one tolerates the slightly different shapes
 * core-api may return (bare array, `{items}`, `{patients}`, etc.) and falls
 * back to empty/null so the UI always renders a sensible state.
 */

function asArray<T>(value: unknown, ...keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    for (const key of keys) {
      const inner = (value as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

export async function listPatients(): Promise<Patient[]> {
  const result = await coreApi<unknown>("/patients");
  if (!result.ok) return [];
  return asArray<Patient>(result.data, "items", "patients", "data");
}

export async function getPatient(id: string): Promise<Patient | null> {
  const result = await coreApi<unknown>(`/patients/${encodeURIComponent(id)}`);
  if (!result.ok || !result.data) return null;
  const data = result.data as { patient?: Patient } & Patient;
  return data.patient ?? data;
}

export async function getClinical(id: string): Promise<ClinicalRecord> {
  const result = await coreApi<unknown>(`/patients/${encodeURIComponent(id)}/clinical`);
  if (!result.ok || !result.data) return { conditions: [], allergies: [] };
  const data = result.data as Partial<ClinicalRecord>;
  return {
    conditions: Array.isArray(data.conditions) ? data.conditions : [],
    allergies: Array.isArray(data.allergies) ? data.allergies : []
  };
}

export async function getDocuments(id: string): Promise<ClinicalDocument[]> {
  const result = await coreApi<unknown>(`/patients/${encodeURIComponent(id)}/documents`);
  if (!result.ok) return [];
  return asArray<ClinicalDocument>(result.data, "items", "documents", "data");
}

export async function getAppointments(patientId: string): Promise<Appointment[]> {
  const result = await coreApi<unknown>(`/appointments?patientId=${encodeURIComponent(patientId)}`);
  if (!result.ok) return [];
  return asArray<Appointment>(result.data, "items", "appointments", "data");
}

export async function searchConditions(query: string): Promise<ConditionOption[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  const result = await coreApi<unknown>(`/clinical/conditions${qs}`);
  if (!result.ok) return [];
  return asArray<ConditionOption>(result.data, "items", "conditions", "data");
}

/** Pick the most recent appointment (by start time) for the disposition form. */
export function latestAppointment(appointments: Appointment[]): Appointment | null {
  if (appointments.length === 0) return null;
  return [...appointments].sort((a, b) => {
    const ta = a.startsAt ? Date.parse(a.startsAt) : 0;
    const tb = b.startsAt ? Date.parse(b.startsAt) : 0;
    return tb - ta;
  })[0];
}
