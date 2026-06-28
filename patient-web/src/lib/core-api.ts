import { mockAppointmentSlots, mockPatientLink } from "./mock";
import type { AppointmentSlot, PatientLinkState, SubmitResult, UploadedReport } from "./types";

/* ---------------------------------------------------------------------------
   core-api client — token-authed mobile-link-session endpoints. The token in
   the path authenticates; there is no bearer.

   Demo-first: without NEXT_PUBLIC_CORE_API_URL the mock session renders and
   the actions resolve optimistically so the surface never crashes.
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
    // Live API unreachable — degrade to demo session so the surface still renders.
    return { ...mockPatientLink(token), source: "mock" };
  }
}

/** Patient confirms the current slot. */
export async function confirmAppointment(token: string, appointmentId: string): Promise<SubmitResult> {
  return postAction(token, `/appointments/${encodeURIComponent(appointmentId)}/confirm`, { confirmedBy: "patient" });
}

/**
 * Open slots for the appointment's doctor on a date. The slots endpoint defaults
 * to the appointment's own date when `date` is omitted.
 */
export async function fetchAppointmentSlots(
  token: string,
  appointmentId: string,
  date?: string
): Promise<AppointmentSlot[]> {
  if (!coreApiUrl) return mockAppointmentSlots(date ?? new Date().toISOString().slice(0, 10));

  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const response = await fetch(
      `${coreApiUrl}/mobile-link-sessions/${encodeURIComponent(token)}/appointments/${encodeURIComponent(
        appointmentId
      )}/slots${query}`,
      { cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!response.ok) return [];
    const envelope = (await response.json().catch(() => ({}))) as { data?: AppointmentSlot[] };
    return Array.isArray(envelope.data) ? envelope.data : [];
  } catch {
    return [];
  }
}

/**
 * Patient picks a slot → move the appointment. The backend sends its own
 * "rescheduled" message, so the UI should NOT prompt to confirm afterwards.
 */
export async function rescheduleAppointment(
  token: string,
  appointmentId: string,
  scheduledAt: string
): Promise<SubmitResult> {
  return postAction(token, `/appointments/${encodeURIComponent(appointmentId)}/reschedule`, { scheduledAt });
}

/**
 * Record a diagnostic report against the link. Token-side only metadata is
 * supported, so we store fileName + documentType; the full S3 byte upload is a
 * follow-up.
 */
export async function uploadReport(
  token: string,
  appointmentId: string,
  report: UploadedReport
): Promise<SubmitResult> {
  return postAction(token, `/document-metadata`, {
    appointmentId,
    documentType: report.documentType,
    fileName: report.fileName,
    notes: "Diagnostic report uploaded from the secure patient link."
  });
}

/* ----------------------------- shared POST ------------------------------- */

async function postAction(token: string, path: string, body: Record<string, unknown>): Promise<SubmitResult> {
  if (!coreApiUrl) {
    return { ok: true, source: "mock", message: "Saved (demo mode)." };
  }
  try {
    const response = await fetch(
      `${coreApiUrl}/mobile-link-sessions/${encodeURIComponent(token)}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      }
    );
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

type CoreAppointment = {
  id: string;
  status: string;
  doctorName: string;
  specialty: string;
  branchId: string;
  branchName?: string;
  address?: string;
  mapUrl?: string;
  scheduledAt: string;
};

type CoreSession = {
  session: { token: string; expiresAt: string; allowedActions: string[] };
  patient: { id: string; displayName: string; primaryPhone?: string };
  appointments: CoreAppointment[];
  // Branch contact info may ride alongside the session rather than on the appointment.
  branch?: { name?: string; address?: string; mapUrl?: string };
  provider?: { name?: string; supportPhone?: string };
};

function mapSession(token: string, core: CoreSession): PatientLinkState {
  const base = mockPatientLink(token); // copy/branding defaults
  const appointment = core.appointments[0];

  // Branch address/mapUrl may be on the appointment or on a session-level branch object.
  const address = appointment?.address ?? core.branch?.address;
  const mapUrl = appointment?.mapUrl ?? core.branch?.mapUrl;
  const branchName = appointment?.branchName ?? core.branch?.name ?? appointment?.branchId ?? base.provider.branch;

  return {
    ...base,
    source: "api",
    secureLink: {
      ...base.secureLink,
      expiresAt: core.session.expiresAt,
      allowedActions: core.session.allowedActions.filter(isAllowedAction)
    },
    provider: {
      name: core.provider?.name ?? base.provider.name,
      branch: branchName,
      supportPhone: core.provider?.supportPhone ?? base.provider.supportPhone
    },
    patient: {
      id: core.patient.id,
      displayName: core.patient.displayName,
      maskedPhone: maskPhone(core.patient.primaryPhone)
    },
    appointment: appointment
      ? {
          id: appointment.id,
          status: mapStatus(appointment.status),
          scheduledAt: appointment.scheduledAt,
          displayDate: formatDate(appointment.scheduledAt),
          displayTime: formatTime(appointment.scheduledAt),
          doctorName: appointment.doctorName,
          department: appointment.specialty,
          branchName,
          ...(address ? { address } : {}),
          ...(mapUrl ? { mapUrl } : {})
        }
      : base.appointment
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

const allowedActions = new Set(["confirm_appointment", "reschedule_request", "upload_document_metadata"]);

function isAllowedAction(value: string): value is PatientLinkState["secureLink"]["allowedActions"][number] {
  return allowedActions.has(value);
}

function mapStatus(status?: string): PatientLinkState["appointment"]["status"] {
  if (status === "confirmed" || status === "checked_in" || status === "in_consult" || status === "completed") {
    return "confirmed";
  }
  if (status === "rescheduled") return "rescheduled";
  return "scheduled";
}

function maskPhone(phone?: string): string {
  if (!phone) return "Not shared";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Masked";
  return `+91 ******${digits.slice(-4)}`;
}

// Appointment times are the doctor's wall-clock hours encoded as UTC
// (e.g. a 13:45 slot → ...T13:45:00Z). Format in UTC so the patient sees the time
// as booked (1:45 pm), not shifted into the device's timezone (which turned it into 7:15 pm).
export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time pending";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}
