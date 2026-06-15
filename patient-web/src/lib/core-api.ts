import { mockPatientLink } from "./mock";
import type { PatientLinkState, SubmitActionPayload, SubmitResult } from "./types";

/* ---------------------------------------------------------------------------
   core-api client — same governed mobile-link-session endpoints as v1.
   Demo-first: without NEXT_PUBLIC_CORE_API_URL the rich mock session renders
   and actions resolve optimistically.
   ------------------------------------------------------------------------- */

const coreApiUrl = process.env.NEXT_PUBLIC_CORE_API_URL;

export async function loadPatientLink(token: string): Promise<PatientLinkState> {
  if (!coreApiUrl) return mockPatientLink(token);

  try {
    const response = await fetch(`${coreApiUrl}/mobile-link-sessions/${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000)
    });

    if (response.status === 410) return inactive(token, "expired", "This secure link has expired.");
    if (!response.ok) return inactive(token, "revoked", "This secure link is no longer active.");

    const envelope = (await response.json()) as { data?: CoreSession };
    if (!envelope.data) return inactive(token, "revoked", "This secure link is no longer active.");
    return mapSession(token, envelope.data);
  } catch {
    // Live API unreachable — degrade to demo session so the journey still renders.
    return { ...mockPatientLink(token), source: "mock" };
  }
}

export async function submitPatientAction(token: string, payload: SubmitActionPayload): Promise<SubmitResult> {
  if (!coreApiUrl) {
    return { ok: true, source: "mock", message: "Saved (demo mode)." };
  }

  const encoded = encodeURIComponent(token);
  const request = ((): { path: string; body: Record<string, unknown> } => {
    switch (payload.type) {
      case "confirm_appointment":
        return {
          path: `/mobile-link-sessions/${encoded}/appointments/${encodeURIComponent(payload.appointmentId)}/confirm`,
          body: { confirmedBy: "patient", notes: "Confirmed from secure patient mobile link." }
        };
      case "request_reschedule":
        return {
          path: `/mobile-link-sessions/${encoded}/appointments/${encodeURIComponent(payload.appointmentId)}/reschedule-requests`,
          body: { reason: payload.reason }
        };
      case "update_checklist":
        return {
          path: `/mobile-link-sessions/${encoded}/checklist/${encodeURIComponent(payload.itemId)}`,
          body: { completed: payload.completed }
        };
      case "mark_document_uploaded":
        return {
          path: `/mobile-link-sessions/${encoded}/document-metadata`,
          body: {
            appointmentId: payload.appointmentId,
            documentType: payload.documentType,
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            sizeBytes: payload.sizeBytes,
            notes: `Captured against secure link document request ${payload.documentId}.`
          }
        };
      case "confirm_follow_up":
        return {
          path: `/mobile-link-sessions/${encoded}/follow-ups/${encodeURIComponent(payload.followUpId)}/confirm`,
          body: { patientResponse: payload.status }
        };
      case "update_consent":
        return {
          path: `/mobile-link-sessions/${encoded}/consent`,
          body: { channel: payload.channel, enabled: payload.enabled }
        };
      case "opt_out":
        return { path: `/mobile-link-sessions/${encoded}/opt-out`, body: { scope: "non_care_messages" } };
    }
  })();

  try {
    const response = await fetch(`${coreApiUrl}${request.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request.body)
    });
    const envelope = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    return {
      ok: response.ok,
      source: "api",
      message: response.ok ? "Saved with your care team." : envelope.error?.message ?? `Could not save (${response.status}).`
    };
  } catch {
    return { ok: false, source: "api", message: "Provider system is temporarily unavailable. Please try again." };
  }
}

/* --------------------------- live-session mapping ------------------------ */

type CoreSession = {
  session: { token: string; expiresAt: string; allowedActions: string[] };
  patient: {
    id: string;
    displayName: string;
    age?: number;
    primaryPhone?: string;
    preferredLanguage?: string;
    consent?: { communications?: string; documentSharing?: string };
    caregivers?: Array<{ displayName: string; relationship: string; consentStatus?: string; permissions?: string[] }>;
  };
  appointments: Array<{
    id: string;
    status: string;
    doctorName: string;
    specialty: string;
    branchId: string;
    scheduledAt: string;
  }>;
  followUps: Array<{ id: string; title: string; dueAt: string; status: string; instructions: string; nextSteps?: string[] }>;
  accessWorkflow?: { state?: string; confirmationCopy?: string };
};

function mapSession(token: string, core: CoreSession): PatientLinkState {
  const base = mockPatientLink(token); // checklist/doc scaffolding + copy defaults
  const appointment = core.appointments[0];
  const followUp = core.followUps[0];
  const caregiver = core.patient.caregivers?.[0];
  const status = mapStatus(core.accessWorkflow?.state ?? appointment?.status);

  return {
    ...base,
    source: "api",
    secureLink: {
      ...base.secureLink,
      expiresAt: core.session.expiresAt,
      allowedActions: core.session.allowedActions.filter(isAllowedAction)
    },
    patient: {
      id: core.patient.id,
      displayName: core.patient.displayName,
      ageLabel: core.patient.age ? `${core.patient.age} years` : "Age not shared",
      preferredLanguage: core.patient.preferredLanguage ?? "Not set",
      maskedPhone: maskPhone(core.patient.primaryPhone)
    },
    caregiver: caregiver
      ? {
          displayName: caregiver.displayName,
          relationship: caregiver.relationship,
          actingForPatient: true,
          consentStatus: (caregiver.consentStatus as PatientLinkState["caregiver"]["consentStatus"]) ?? "unknown",
          permissions: caregiver.permissions ?? []
        }
      : { ...base.caregiver, displayName: core.patient.displayName, relationship: "Self", actingForPatient: false },
    appointment: appointment
      ? {
          id: appointment.id,
          status,
          displayDate: formatDate(appointment.scheduledAt),
          displayTime: formatTime(appointment.scheduledAt),
          doctorName: appointment.doctorName,
          department: appointment.specialty,
          location: appointment.branchId,
          statusCopy: core.accessWorkflow?.confirmationCopy ?? base.appointment.statusCopy
        }
      : base.appointment,
    followUp: followUp
      ? {
          id: followUp.id,
          title: followUp.title,
          status: followUp.status === "confirmed" || followUp.status === "completed" ? "confirmed" : "pending",
          dueLabel: `Due ${formatDate(followUp.dueAt)}`,
          instructions: followUp.instructions,
          nextSteps: followUp.nextSteps?.length ? followUp.nextSteps : base.followUp.nextSteps
        }
      : base.followUp,
    consent: {
      whatsApp: core.patient.consent?.communications === "granted",
      calls: core.patient.consent?.communications === "granted",
      documentSharing: core.patient.consent?.documentSharing === "granted",
      optedOut: core.patient.consent?.communications === "revoked"
    }
  };
}

function inactive(token: string, linkStatus: "expired" | "revoked", reason: string): PatientLinkState {
  const base = mockPatientLink(token);
  return {
    ...base,
    source: "api",
    linkStatus,
    secureLink: { ...base.secureLink, allowedActions: [], securityLabel: reason }
  };
}

const allowedActions = new Set([
  "confirm_appointment",
  "reschedule_request",
  "upload_document_metadata",
  "confirm_follow_up",
  "update_consent",
  "opt_out"
]);

function isAllowedAction(value: string): value is PatientLinkState["secureLink"]["allowedActions"][number] {
  return allowedActions.has(value);
}

function mapStatus(status?: string): PatientLinkState["appointment"]["status"] {
  if (status === "confirmed") return "confirmed";
  if (status === "rescheduled" || status === "reschedule_requested") return "reschedule_requested";
  if (status === "expired" || status === "cancelled") return "expired";
  return "pending_confirmation";
}

function maskPhone(phone?: string): string {
  if (!phone) return "Not shared";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Masked";
  return `+91 ******${digits.slice(-4)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time pending";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}
