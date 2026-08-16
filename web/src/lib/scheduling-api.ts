import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type {
  Appointment,
  BranchOption,
  Doctor,
  PatientOption,
  Slot
} from "./scheduling-types";

/**
 * Server-only fetch helpers for the Appointments / scheduling surface. Each
 * reuses the session-bearing `coreApi` wrapper and unwraps the `{data}`
 * envelope. Client-safe types live in ./scheduling-types.
 */

export type { ApiResult } from "./users-types";

export async function fetchDoctors(): Promise<ApiResult<Doctor[]>> {
  return coreApi<Doctor[]>("/doctors");
}

/** core-api returns the rich PatientSummary; we narrow to the picker shape. */
type RawPatient = { id: string; displayName: string };

export async function fetchPatients(): Promise<ApiResult<PatientOption[]>> {
  const result = await coreApi<RawPatient[]>("/patients");
  if (!result.ok) return result;
  const patients: PatientOption[] = (result.data ?? []).map((p) => ({
    id: p.id,
    displayName: p.displayName
  }));
  return { ok: true, data: patients };
}

type MePayload = {
  branches?: BranchOption[];
  context?: { permissions?: string[] };
};

export async function fetchMe(): Promise<{ branches: BranchOption[]; permissions: string[] }> {
  const result = await coreApi<MePayload>("/auth/me");
  if (!result.ok) return { branches: [], permissions: [] };
  return {
    branches: result.data.branches ?? [],
    permissions: result.data.context?.permissions ?? []
  };
}

export async function fetchDoctorSlots(
  doctorId: string,
  date: string,
  branchId?: string
): Promise<ApiResult<Slot[]>> {
  const params = new URLSearchParams({ date });
  if (branchId) params.set("branchId", branchId);
  return coreApi<Slot[]>(`/doctors/${encodeURIComponent(doctorId)}/slots?${params.toString()}`);
}

export async function fetchAppointments(opts: {
  doctorId?: string;
  date?: string;
  status?: string;
}): Promise<ApiResult<Appointment[]>> {
  const params = new URLSearchParams();
  if (opts.doctorId) params.set("doctorId", opts.doctorId);
  if (opts.date) params.set("date", opts.date);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return coreApi<Appointment[]>(`/appointments${qs ? `?${qs}` : ""}`);
}
