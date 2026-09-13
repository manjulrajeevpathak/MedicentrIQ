"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import {
  fetchPatientClinical,
  fetchPatientDocuments,
  fetchPatientTimeline,
  fetchPatientVisits
} from "@/lib/patients-api";
import type {
  ClinicalCondition,
  ClinicalRecord,
  DirectoryPatient,
  PatientDocument,
  PatientVisit,
  TimelineEvent
} from "@/lib/patients-types";

/**
 * Patients / Patient 360 server actions. Each reads the session bearer (via
 * `coreApi`), calls core-api with the `{data}`/`{error.message}` envelope, then
 * revalidates the /patients route so the server-rendered view reflects changes.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Create patient --------------------------------------------------------

export async function createPatientAction(input: {
  displayName: string;
  age?: number;
  gender?: string;
  primaryPhone?: string;
  preferredLanguage?: string;
}): Promise<ActionState<DirectoryPatient>> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Enter a patient name." };

  const result = await coreApi<DirectoryPatient>("/patients", {
    method: "POST",
    body: {
      displayName,
      ...(typeof input.age === "number" && !Number.isNaN(input.age) ? { age: input.age } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.primaryPhone?.trim() ? { primaryPhone: input.primaryPhone.trim() } : {}),
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the patient." };
  revalidatePath("/staff/patients");
  return { ok: true, data: result.data, message: "Patient added." };
}

// ---- Clinical history ------------------------------------------------------

export async function loadClinicalAction(patientId: string): Promise<ActionState<ClinicalRecord>> {
  const result = await fetchPatientClinical(patientId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load clinical history." };
  return { ok: true, data: result.data };
}

export async function saveClinicalAction(
  patientId: string,
  record: { conditions: ClinicalCondition[]; allergies: string[]; notes?: string }
): Promise<ActionState<ClinicalRecord>> {
  const result = await coreApi<ClinicalRecord>(`/patients/${encodeURIComponent(patientId)}/clinical`, {
    method: "PUT",
    body: {
      conditions: record.conditions,
      allergies: record.allergies,
      ...(record.notes?.trim() ? { notes: record.notes.trim() } : { notes: "" })
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save clinical history." };
  revalidatePath("/staff/patients");
  return { ok: true, data: result.data, message: "Clinical history saved." };
}

// ---- Documents -------------------------------------------------------------

export async function loadDocumentsAction(patientId: string): Promise<ActionState<PatientDocument[]>> {
  const result = await fetchPatientDocuments(patientId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load documents." };
  return { ok: true, data: result.data };
}

/** Resolve a document's download URL (server-side), returning it to the client to open. */
export async function getDocumentUrlAction(docId: string): Promise<ActionState<{ downloadUrl: string }>> {
  const result = await coreApi<{ downloadUrl: string }>(`/documents/${encodeURIComponent(docId)}/url`);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not get the download link." };
  return { ok: true, data: { downloadUrl: result.data.downloadUrl } };
}

/**
 * Upload a patient document end-to-end, server-side (avoids browser CORS):
 *   1. POST /patients/:id/documents/upload-url  → { uploadUrl, key }
 *   2. PUT the raw file bytes to uploadUrl (S3 presigned PUT or local fallback)
 *   3. POST /patients/:id/documents             → record the metadata
 */
export async function uploadDocumentAction(formData: FormData): Promise<ActionState<PatientDocument>> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const type = String(formData.get("type") ?? "other").trim() || "other";
  const file = formData.get("file");

  if (!patientId) return { ok: false, error: "Missing patient." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };

  const filename = file.name || "upload";
  const contentType = file.type || "application/octet-stream";

  // 1. Ask core-api for an upload target.
  const urlResult = await coreApi<{ uploadUrl: string; key: string }>(
    `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
    { method: "POST", body: { filename, contentType, type } }
  );
  if (!urlResult.ok) return { ok: false, error: urlResult.error ?? "Could not start the upload." };

  const { uploadUrl, key } = urlResult.data;

  // 2. PUT the bytes server-side (no auth header — presigned / unguessable key).
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

  // 3. Record the metadata.
  const recordResult = await coreApi<PatientDocument>(`/patients/${encodeURIComponent(patientId)}/documents`, {
    method: "POST",
    body: { key, filename, contentType, type }
  });
  if (!recordResult.ok) return { ok: false, error: recordResult.error ?? "Could not record the document." };

  revalidatePath("/staff/patients");
  return { ok: true, data: recordResult.data, message: "Document uploaded." };
}

// ---- Visits / dispositions -------------------------------------------------

export async function loadVisitsAction(patientId: string): Promise<ActionState<PatientVisit[]>> {
  const result = await fetchPatientVisits(patientId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load visits." };
  return { ok: true, data: result.data };
}

export async function recordDispositionAction(
  appointmentId: string,
  input: { outcome: string; notes?: string; nextStep?: string; nextActionDate?: string }
): Promise<ActionState<PatientVisit>> {
  if (!input.outcome) return { ok: false, error: "Pick an outcome." };
  const result = await coreApi<PatientVisit>(
    `/appointments/${encodeURIComponent(appointmentId)}/disposition`,
    {
      method: "POST",
      body: {
        outcome: input.outcome,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        ...(input.nextStep?.trim() ? { nextStep: input.nextStep.trim() } : {}),
        ...(input.nextActionDate ? { nextActionDate: input.nextActionDate } : {})
      }
    }
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not record the disposition." };
  revalidatePath("/staff/patients");
  return { ok: true, data: result.data, message: "Visit completed." };
}

export async function loadTimelineAction(patientId: string): Promise<ActionState<TimelineEvent[]>> {
  const result = await fetchPatientTimeline(patientId);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load the timeline." };
  return { ok: true, data: result.data };
}
