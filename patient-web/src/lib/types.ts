/* ---------------------------------------------------------------------------
   Patient mobile-link domain — mirrors core-api's mobile-link-session contract.
   Trimmed to the focused appointment surface: confirm, reschedule via a slot
   picker, and upload diagnostic reports.
   ------------------------------------------------------------------------- */

export type LinkStatus = "active" | "expired" | "revoked";
// Patient-visible appointment states. Mapped from core-api's richer status enum.
export type AppointmentStatus = "scheduled" | "confirmed" | "rescheduled";

export type SecureLinkAction =
  | "confirm_appointment"
  | "reschedule_request"
  | "upload_document_metadata";

/** An open slot returned by the appointment slots endpoint. */
export type AppointmentSlot = {
  start: string;
  end: string;
};

/** A diagnostic report the patient has recorded against this link. */
export type UploadedReport = {
  fileName: string;
  documentType: string;
};

export type PatientLinkState = {
  source: "api" | "mock";
  linkStatus: LinkStatus;
  secureLink: {
    tokenPreview: string;
    expiresAt: string;
    allowedActions: SecureLinkAction[];
    securityLabel: string;
  };
  provider: {
    name: string;
    branch: string;
    supportPhone: string;
  };
  patient: {
    id: string;
    displayName: string;
    maskedPhone: string;
  };
  appointment: {
    id: string;
    status: AppointmentStatus;
    /** Raw ISO timestamp (UTC wall-clock) — used to seed the slot-picker date. */
    scheduledAt: string;
    displayDate: string;
    displayTime: string;
    doctorName: string;
    department: string;
    branchName: string;
    /** Optional street address for the branch, when the session payload carries it. */
    address?: string;
    /** Optional Google Maps link for the branch, when present. */
    mapUrl?: string;
  };
  greeting: { vernacular: string; language: string };
};

export type SubmitResult = {
  ok: boolean;
  source: "api" | "mock";
  message: string;
};
