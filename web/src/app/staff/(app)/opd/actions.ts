"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import { fetchVisit, fetchVisits, lookupIntake } from "@/lib/opd-api";
import type { PatientDocument } from "@/lib/patients-types";
import type {
  ConditionCatalogEntry,
  IntakeCondition,
  IntakeLookupResult,
  PrescriptionExtract,
  ProcedureCatalogEntry,
  Visit,
  VisitListFilters,
  VisitOutcome,
  Vitals
} from "@/lib/opd-types";

/**
 * OPD register server actions. Each reads the session bearer (via `coreApi`),
 * calls core-api with the `{data}`/`{error.message}` envelope, then revalidates
 * the /opd route so the server-rendered register reflects changes.
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
  revalidatePath("/staff/opd");
  return { ok: true, data: result.data, message: "Walk-in registered." };
}

// ---- Load / list visits -----------------------------------------------------
//
// There is deliberately NO status-PATCH action here: the register has no
// "start consult" step, and completion happens only through the clinical
// observations PATCH below (the backend derives disposition + fires workflows).

export async function loadVisitAction(visitId: string): Promise<ActionState<Visit>> {
  const result = await fetchVisit(visitId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load the visit." };
  return { ok: true, data: result.data };
}

/** Fetch the visit register with the current filter set (status/date-range/doctor). */
export async function listVisitsAction(filters: VisitListFilters): Promise<ActionState<Visit[]>> {
  const result = await fetchVisits(filters);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load the register." };
  return { ok: true, data: result.data };
}

// ---- Clinical observations ---------------------------------------------------

export type VisitClinicalInput = {
  chiefComplaints?: string;
  preExistingDiseases?: string;
  diagnosisText?: string;
  advisePharmacy?: string;
  adviseDiagnostics?: string;
  adviseProcedureAdmission?: string;
  /** ICD-10 coded chief complaints (goes to Visit.clinical.chiefComplaintCodes). */
  chiefComplaintCodes?: IntakeCondition[];
  /** ICD-10 coded comorbidities (goes to Visit.clinical.preExistingCodes). */
  preExistingCodes?: IntakeCondition[];
  /** ICD-10 coded diagnosis (goes to Visit.diagnosis). */
  diagnosis?: IntakeCondition[];
  /** Coded procedures advised (goes to Visit.clinical.adviseProcedureCodes). */
  adviseProcedureCodes?: IntakeCondition[];
  /** The clinical outcome — required to complete the visit. */
  outcome?: VisitOutcome;
  revisitAdvised?: boolean;
  /** YYYY-MM-DD. Send "" to clear. */
  revisitDate?: string;
  /** New prescription document ids to attach (backend unions + dedupes). */
  prescriptionDocumentIds?: string[];
  /**
   * Send `false` to save a draft without completing the visit. Omit it and the
   * backend completes the visit, derives the disposition and fires workflows —
   * the UI must never PATCH status alongside this.
   */
  complete?: false;
};

export async function updateVisitClinicalAction(
  visitId: string,
  input: VisitClinicalInput
): Promise<ActionState<Visit>> {
  const body: Record<string, unknown> = {};
  const textKeys = [
    "chiefComplaints",
    "preExistingDiseases",
    "diagnosisText",
    "advisePharmacy",
    "adviseDiagnostics",
    "adviseProcedureAdmission",
    "revisitDate"
  ] as const;
  for (const key of textKeys) {
    if (input[key] !== undefined) body[key] = input[key];
  }
  // Coded arrays are sent whenever defined (an empty array clears the codes).
  if (input.chiefComplaintCodes !== undefined) body.chiefComplaintCodes = input.chiefComplaintCodes;
  if (input.preExistingCodes !== undefined) body.preExistingCodes = input.preExistingCodes;
  if (input.diagnosis !== undefined) body.diagnosis = input.diagnosis;
  if (input.adviseProcedureCodes !== undefined) body.adviseProcedureCodes = input.adviseProcedureCodes;
  if (input.outcome) body.outcome = input.outcome;
  if (input.revisitAdvised !== undefined) body.revisitAdvised = input.revisitAdvised;
  if (input.prescriptionDocumentIds?.length) body.prescriptionDocumentIds = input.prescriptionDocumentIds;
  if (input.complete === false) body.complete = false;

  const result = await coreApi<Visit>(`/visits/${encodeURIComponent(visitId)}/clinical`, {
    method: "PATCH",
    body
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the observations." };
  revalidatePath("/staff/opd");
  return { ok: true, data: result.data, message: "Observations saved." };
}

// ---- ICD-10 condition search (typeahead for the clinical pickers) -----------

/**
 * Search the shared ICD-10 catalog (GET /clinical/conditions?q=). Powers the
 * chief-complaint / pre-existing / diagnosis pickers on the visit page. With no
 * query the backend returns the first ~100 common entries.
 */
export async function searchConditionsAction(q: string): Promise<ActionState<ConditionCatalogEntry[]>> {
  const query = q.trim();
  const path = query ? `/clinical/conditions?q=${encodeURIComponent(query)}` : "/clinical/conditions";
  const result = await coreApi<ConditionCatalogEntry[]>(path);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not search conditions." };
  return { ok: true, data: result.data };
}

// ---- Procedure catalog search (Advise → Procedure / Admission picker) -------

/**
 * Search the curated procedure catalog (GET /clinical/procedures?q=). Token-AND
 * over code + label, ~40 items; an empty query returns the full list. Powers the
 * procedure typeahead in the clinical "Advise" section.
 */
export async function searchProceduresAction(q: string): Promise<ActionState<ProcedureCatalogEntry[]>> {
  const query = q.trim();
  const path = query ? `/clinical/procedures?q=${encodeURIComponent(query)}` : "/clinical/procedures";
  const result = await coreApi<ProcedureCatalogEntry[]>(path);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not search procedures." };
  return { ok: true, data: result.data };
}

// ---- AI note → ICD-10 coding -----------------------------------------------

/**
 * Map a field's free-text notes onto ICD-10 codes with AI (POST
 * /clinical/code-conditions), catalog-normalised. `kind` biases the model toward
 * symptoms / comorbidities / diagnoses. Powers the per-field "Auto-code from
 * notes" action — the doctor reviews the chips before saving. Nothing is saved.
 */
export async function codeConditionsAction(
  text: string,
  kind?: "symptom" | "comorbidity" | "diagnosis"
): Promise<ActionState<IntakeCondition[]>> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, data: [] };
  const result = await coreApi<{ conditions: IntakeCondition[] }>("/clinical/code-conditions", {
    method: "POST",
    body: { text: trimmed, ...(kind ? { kind } : {}) }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not code the notes." };
  return { ok: true, data: result.data?.conditions ?? [] };
}

// ---- AI prescription extraction --------------------------------------------

/**
 * Read an uploaded prescription with AI vision (POST /visits/:id/extract-prescription).
 * Returns structured suggestions WITHOUT saving them — the doctor reviews the
 * pre-filled fields, then submits. `documentId` targets a specific prescription;
 * omit it and the backend reads the visit's latest. Surfaces the backend's
 * message so 503 (AI off) / 400 (no prescription) / 502 (read error) read clearly.
 */
export async function extractPrescriptionAction(
  visitId: string,
  documentId?: string
): Promise<ActionState<PrescriptionExtract>> {
  const result = await coreApi<PrescriptionExtract>(
    `/visits/${encodeURIComponent(visitId)}/extract-prescription`,
    { method: "POST", body: documentId ? { documentId } : {} }
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not read the prescription." };
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

  const urlResult = await coreApi<{ uploadUrl: string; key?: string; storageKey?: string; documentId?: string }>(
    `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
    { method: "POST", body: { filename, contentType, type } }
  );
  if (!urlResult.ok) return { ok: false, error: urlResult.error ?? "Could not start the upload." };
  if (!urlResult.data?.uploadUrl) return { ok: false, error: "Could not start the upload." };

  const { uploadUrl } = urlResult.data;
  const key = urlResult.data.key ?? urlResult.data.storageKey;

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
    body: {
      filename,
      contentType,
      type,
      ...(key ? { key } : {}),
      ...(urlResult.data.documentId ? { documentId: urlResult.data.documentId } : {}),
      ...(visitId ? { visitId } : {})
    }
  });
  if (!recordResult.ok) return { ok: false, error: recordResult.error ?? "Could not record the document." };

  revalidatePath("/staff/opd");
  return { ok: true, data: recordResult.data, message: "Document uploaded." };
}

/** Resolve a viewing URL for an uploaded document (prescription links etc.). */
export async function getDocumentUrlAction(documentId: string): Promise<ActionState<{ url: string }>> {
  const result = await coreApi<{ downloadUrl?: string; url?: string }>(
    `/documents/${encodeURIComponent(documentId)}/url`
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not get the document link." };
  const url = result.data?.downloadUrl ?? result.data?.url;
  if (!url) return { ok: false, error: "No document link was returned." };
  return { ok: true, data: { url } };
}
