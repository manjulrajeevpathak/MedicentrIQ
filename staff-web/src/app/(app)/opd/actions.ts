"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import { fetchVisit, fetchVisits, lookupIntake } from "@/lib/opd-api";
import type { PatientDocument } from "@/lib/patients-types";
import type {
  Disposition,
  IntakeCondition,
  IntakeLookupResult,
  Visit,
  VisitStatus,
  Vitals
} from "@/lib/opd-types";

/**
 * OPD walk-in intake server actions. Each reads the session bearer (via
 * `coreApi`), calls core-api with the `{data}`/`{error.message}` envelope, then
 * revalidates the /opd route so the server-rendered queue reflects changes.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Phone-first lookup ----------------------------------------------------

export async function intakeLookupAction(phone: string): Promise<ActionState<IntakeLookupResult>> {
  const raw = phone.trim();
  if (!raw) return { ok: false, error: "Enter a phone number to look up." };
  const result = await lookupIntake(raw);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not look up that number." };
  return { ok: true, data: result.data };
}

// ---- Register a walk-in visit ---------------------------------------------

export type RegisterVisitInput = {
  /** Existing patient: send the id. */
  patientId?: string;
  /** New patient: send identity fields. */
  name?: string;
  age?: number;
  gender?: string;
  phone?: string;
  branchId?: string;
  /** Visit details. Reason for visit is now optional — captured at the encounter. */
  chiefComplaint?: string;
  doctorId?: string;
  department?: string;
  /** Link this walk-in to the patient's existing appointment today. */
  appointmentId?: string;
  intakeConditions?: IntakeCondition[];
  intakeAllergies?: string[];
  vitals?: Vitals;
  intakeNotes?: string;
};

export async function registerVisitAction(input: RegisterVisitInput): Promise<ActionState<Visit>> {
  // Reason for visit is optional at registration — the doctor captures it at the encounter.
  const chiefComplaint = input.chiefComplaint?.trim() ?? "";

  const body: Record<string, unknown> = {
    visitType: "walk_in"
  };
  if (chiefComplaint) body.chiefComplaint = chiefComplaint;

  if (input.patientId) {
    body.patientId = input.patientId;
  } else {
    const name = (input.name ?? "").trim();
    if (!name) return { ok: false, error: "Enter the patient's name." };
    body.name = name;
    if (typeof input.age === "number" && !Number.isNaN(input.age)) body.age = input.age;
    if (input.gender) body.gender = input.gender;
    if (input.phone?.trim()) body.phone = input.phone.trim();
    if (input.branchId) body.branchId = input.branchId;
  }

  if (input.doctorId) body.doctorId = input.doctorId;
  if (input.appointmentId) body.appointmentId = input.appointmentId;
  if (input.department?.trim()) body.department = input.department.trim();
  if (input.intakeConditions?.length) body.intakeConditions = input.intakeConditions;
  if (input.intakeAllergies?.length) body.intakeAllergies = input.intakeAllergies;
  if (input.vitals && Object.keys(input.vitals).length) body.vitals = input.vitals;
  if (input.intakeNotes?.trim()) body.intakeNotes = input.intakeNotes.trim();

  const result = await coreApi<Visit>("/visits", { method: "POST", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not register the walk-in." };
  revalidatePath("/opd");
  return { ok: true, data: result.data, message: "Walk-in registered." };
}

// ---- Update / progress a visit --------------------------------------------

export type UpdateVisitInput = {
  status?: VisitStatus;
  doctorId?: string;
  /** Reason for visit — captured/edited at the encounter. */
  chiefComplaint?: string;
  vitals?: Vitals;
  diagnosis?: IntakeCondition[];
  disposition?: Disposition;
  consultNotes?: string;
};

export async function updateVisitAction(
  visitId: string,
  input: UpdateVisitInput
): Promise<ActionState<Visit>> {
  const body: Record<string, unknown> = {};
  if (input.status) body.status = input.status;
  if (input.doctorId) body.doctorId = input.doctorId;
  if (input.chiefComplaint !== undefined) body.chiefComplaint = input.chiefComplaint.trim();
  if (input.vitals && Object.keys(input.vitals).length) body.vitals = input.vitals;
  if (input.diagnosis) body.diagnosis = input.diagnosis;
  if (input.disposition) body.disposition = input.disposition;
  if (input.consultNotes !== undefined) body.consultNotes = input.consultNotes;

  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to update." };

  const result = await coreApi<Visit>(`/visits/${encodeURIComponent(visitId)}`, {
    method: "PATCH",
    body
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the visit." };
  revalidatePath("/opd");
  return { ok: true, data: result.data, message: "Visit updated." };
}

export async function loadVisitAction(visitId: string): Promise<ActionState<Visit>> {
  const result = await fetchVisit(visitId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load the visit." };
  return { ok: true, data: result.data };
}

export async function refreshVisitsAction(date: string): Promise<ActionState<Visit[]>> {
  const result = await fetchVisits({ date });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not refresh the queue." };
  return { ok: true, data: result.data };
}

// ---- Visit documents (reuses the patient documents flow) -------------------

/**
 * Upload a visit document end-to-end, server-side (avoids browser CORS),
 * reusing core-api's patient documents endpoints. Mirrors the patient detail
 * upload flow, threading the visit's id as `visitId` and a `prescription` /
 * `diagnostic_report` document type:
 *   1. POST /patients/:id/documents/upload-url → { uploadUrl, key }
 *   2. PUT the raw file bytes to uploadUrl
 *   3. POST /patients/:id/documents            → record the metadata
 */
export async function uploadVisitDocumentAction(formData: FormData): Promise<ActionState<PatientDocument>> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const visitId = String(formData.get("visitId") ?? "").trim();
  const type = String(formData.get("type") ?? "other").trim() || "other";
  const file = formData.get("file");

  if (!patientId) return { ok: false, error: "Missing patient." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

  const filename = file.name || "upload";
  const contentType = file.type || "application/octet-stream";

  const urlResult = await coreApi<{ uploadUrl: string; key: string }>(
    `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
    { method: "POST", body: { filename, contentType, type } }
  );
  if (!urlResult.ok) return { ok: false, error: urlResult.error ?? "Could not start the upload." };

  const { uploadUrl, key } = urlResult.data;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: bytes,
      cache: "no-store"
    });
    if (!putRes.ok) {
      return { ok: false, error: `Upload failed (${putRes.status}). Try again.` };
    }
  } catch {
    return { ok: false, error: "Unable to upload the file. Try again." };
  }

  const recordResult = await coreApi<PatientDocument>(`/patients/${encodeURIComponent(patientId)}/documents`, {
    method: "POST",
    body: { key, filename, contentType, type, ...(visitId ? { visitId } : {}) }
  });
  if (!recordResult.ok) return { ok: false, error: recordResult.error ?? "Could not record the document." };

  revalidatePath("/opd");
  return { ok: true, data: recordResult.data, message: "Document uploaded." };
}
