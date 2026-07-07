"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "@/lib/constants";
import { API_BASE, coreApi, sessionToken } from "@/lib/core-api";
import type { ClinicalRecord } from "@/lib/types";

/**
 * Central Server Actions for the clinician PWA. Form-bound actions return a
 * small `{ error }` / `{ ok }` state for `useActionState`; success paths that
 * navigate throw Next's redirect signal.
 */

export type AuthState = { error?: string; mfaRequired?: boolean; challengeId?: string };

type Principal = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

type LoginData =
  | { token: string; principal?: Principal; mustResetPassword?: boolean }
  | { mfaRequired: true; challengeId: string; email?: string }
  | { mustResetPassword: true; token: string };

async function postJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
    if (!res.ok) return { ok: false, status: res.status, error: envelope.error?.message };
    return { ok: true, status: res.status, data: envelope.data };
  } catch {
    return { ok: false, status: 0, error: "Unable to reach the server. Try again." };
  }
}

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const result = await postJson<LoginData>("/auth/login", { email, password });
  if (!result.ok) {
    if (result.status === 401 || result.status === 400) return { error: "Invalid email or password." };
    return { error: result.error ?? "Sign-in failed. Try again." };
  }

  const data = result.data;
  if (!data) return { error: "Sign-in failed. Try again." };

  if ("mfaRequired" in data && data.mfaRequired) {
    return { mfaRequired: true, challengeId: data.challengeId };
  }

  if ("token" in data && data.token) {
    await setSessionCookie(data.token);
    redirect("/");
  }

  return { error: "Unexpected sign-in response." };
}

export async function verifyOtpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const challengeId = String(formData.get("challengeId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!challengeId) return { error: "Missing challenge. Start sign-in again." };
  if (!/^\d{4,8}$/.test(code)) return { mfaRequired: true, challengeId, error: "Enter the numeric code sent to you." };

  const result = await postJson<{ token: string; principal?: Principal }>("/auth/login/verify-otp", {
    challengeId,
    code
  });

  if (!result.ok || !result.data?.token) {
    if (result.status === 400 || result.status === 401) {
      return { mfaRequired: true, challengeId, error: "That code is incorrect or expired." };
    }
    return { mfaRequired: true, challengeId, error: result.error ?? "Verification failed. Try again." };
  }

  await setSessionCookie(result.data.token);
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

// --------------------------------------------------------------------------
// Clinical history — append a condition
// --------------------------------------------------------------------------

export type ActionResult = { ok?: boolean; error?: string };

export async function addConditionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();

  if (!patientId) return { error: "Missing patient." };
  if (!code || !label) return { error: "Pick a condition from the list." };

  // Read the current clinical record so we append rather than overwrite.
  const current = await coreApi<Partial<ClinicalRecord>>(`/patients/${encodeURIComponent(patientId)}/clinical`);
  const conditions = current.ok && Array.isArray(current.data?.conditions) ? current.data.conditions : [];
  const allergies = current.ok && Array.isArray(current.data?.allergies) ? current.data.allergies : [];

  if (conditions.some((c) => c.code === code)) {
    return { error: "That condition is already on the record." };
  }

  const result = await coreApi(`/patients/${encodeURIComponent(patientId)}/clinical`, {
    method: "PUT",
    body: { conditions: [...conditions, { code, label }], allergies }
  });

  if (!result.ok) return { error: result.error ?? "Could not add the condition." };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

// --------------------------------------------------------------------------
// Documents — upload via presigned URL
// --------------------------------------------------------------------------

export async function uploadDocumentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const type = String(formData.get("type") ?? "other").trim();
  const file = formData.get("file");

  if (!patientId) return { error: "Missing patient." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  const token = await sessionToken();
  if (!token) return { error: "Your session has expired. Sign in again." };

  const filename = file.name || `upload-${Date.now()}`;
  const contentType = file.type || "application/octet-stream";

  // 1) Ask core-api for a presigned upload URL.
  const presign = await coreApi<{ uploadUrl: string; key?: string; documentId?: string; storageKey?: string }>(
    `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
    { method: "POST", body: { filename, contentType, type } }
  );
  if (!presign.ok) {
    return { error: presign.error ?? "Could not start the upload." };
  }
  if (!presign.data?.uploadUrl) {
    return { error: "Could not start the upload." };
  }

  // 2) PUT the bytes straight to storage from the server.
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const put = await fetch(presign.data.uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: bytes
    });
    if (!put.ok) return { error: `Upload failed (${put.status}).` };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }

  // 3) Register the uploaded document against the patient.
  const key = presign.data.key ?? presign.data.storageKey;
  const register = await coreApi(`/patients/${encodeURIComponent(patientId)}/documents`, {
    method: "POST",
    body: {
      type,
      filename,
      contentType,
      ...(key ? { key } : {}),
      ...(presign.data.documentId ? { documentId: presign.data.documentId } : {})
    }
  });
  if (!register.ok) return { error: register.error ?? "Uploaded, but could not save the document record." };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/** Resolve a download URL for a document, then hand it back to the client. */
export async function getDocumentUrlAction(documentId: string): Promise<{ url?: string; error?: string }> {
  const result = await coreApi<{ downloadUrl?: string; url?: string }>(
    `/documents/${encodeURIComponent(documentId)}/url`
  );
  if (!result.ok) return { error: result.error ?? "Could not get the download link." };
  const url = result.data?.downloadUrl ?? result.data?.url;
  if (!url) return { error: "No download link was returned." };
  return { url };
}

// --------------------------------------------------------------------------
// Clinical observations — save + complete the OPD visit (no start-consult step)
// --------------------------------------------------------------------------

export async function saveClinicalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const visitId = String(formData.get("visitId") ?? "").trim();
  if (!patientId || !visitId) return { error: "Missing visit." };

  const text = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || undefined;
  };

  // Optional prescription upload first, so its id rides along with the save.
  const prescriptionDocumentIds: string[] = [];
  const file = formData.get("prescription");
  if (file instanceof File && file.size > 0) {
    const filename = file.name || `prescription-${Date.now()}`;
    const contentType = file.type || "application/octet-stream";
    const presign = await coreApi<{ uploadUrl: string; key?: string; storageKey?: string }>(
      `/patients/${encodeURIComponent(patientId)}/documents/upload-url`,
      { method: "POST", body: { filename, contentType, type: "prescription" } }
    );
    if (!presign.ok || !presign.data?.uploadUrl) {
      return { error: "Could not start the prescription upload." };
    }
    try {
      const put = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: new Uint8Array(await file.arrayBuffer())
      });
      if (!put.ok) return { error: `Prescription upload failed (${put.status}).` };
    } catch {
      return { error: "Prescription upload failed. Check your connection and try again." };
    }
    const key = presign.data.key ?? presign.data.storageKey;
    const register = await coreApi<{ id?: string }>(`/patients/${encodeURIComponent(patientId)}/documents`, {
      method: "POST",
      body: { type: "prescription", filename, contentType, ...(key ? { key } : {}) }
    });
    if (!register.ok) return { error: register.error ?? "Uploaded, but could not save the prescription record." };
    if (register.data?.id) prescriptionDocumentIds.push(register.data.id);
  }

  const result = await coreApi(`/visits/${encodeURIComponent(visitId)}/clinical`, {
    method: "PATCH",
    body: {
      chiefComplaints: text("chiefComplaints"),
      preExistingDiseases: text("preExistingDiseases"),
      diagnosisText: text("diagnosisText"),
      advisePharmacy: text("advisePharmacy"),
      adviseDiagnostics: text("adviseDiagnostics"),
      adviseProcedureAdmission: text("adviseProcedureAdmission"),
      revisitAdvised: formData.get("revisitAdvised") === "on",
      revisitDate: text("revisitDate"),
      ...(prescriptionDocumentIds.length > 0 ? { prescriptionDocumentIds } : {})
    }
  });
  if (!result.ok) return { error: result.error ?? "Could not save the clinical observations." };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

// --------------------------------------------------------------------------
// Visit disposition
// --------------------------------------------------------------------------

export async function dispositionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const nextStep = String(formData.get("nextStep") ?? "").trim();

  if (!appointmentId) return { error: "No appointment to record against." };
  if (!outcome) return { error: "Choose an outcome." };

  const result = await coreApi(`/appointments/${encodeURIComponent(appointmentId)}/disposition`, {
    method: "POST",
    body: {
      outcome,
      ...(notes ? { notes } : {}),
      ...(nextStep ? { nextStep } : {})
    }
  });
  if (!result.ok) return { error: result.error ?? "Could not save the disposition." };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
