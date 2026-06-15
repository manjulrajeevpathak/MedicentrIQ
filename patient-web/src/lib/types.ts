/* ---------------------------------------------------------------------------
   Patient mobile-link domain — mirrors core-api's mobile-link-session contract
   (same endpoints as patient-web v1), trimmed to what the v2 surface renders.
   ------------------------------------------------------------------------- */

export type LinkStatus = "active" | "expired" | "revoked";
export type AppointmentStatus = "pending_confirmation" | "confirmed" | "reschedule_requested" | "expired";
export type FollowUpStatus = "pending" | "confirmed" | "needs_callback";

export type SecureLinkAction =
  | "confirm_appointment"
  | "reschedule_request"
  | "upload_document_metadata"
  | "confirm_follow_up"
  | "update_consent"
  | "opt_out";

export type ChecklistItem = {
  id: string;
  title: string;
  note: string;
  completed: boolean;
  required: boolean;
};

export type DocumentRequest = {
  id: string;
  title: string;
  note: string;
  status: "pending" | "uploaded";
};

export type ConsentState = {
  whatsApp: boolean;
  calls: boolean;
  documentSharing: boolean;
  optedOut: boolean;
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
    ageLabel: string;
    preferredLanguage: string;
    maskedPhone: string;
  };
  caregiver: {
    displayName: string;
    relationship: string;
    actingForPatient: boolean;
    consentStatus: "granted" | "revoked" | "unknown";
    permissions: string[];
  };
  appointment: {
    id: string;
    status: AppointmentStatus;
    displayDate: string;
    displayTime: string;
    doctorName: string;
    department: string;
    location: string;
    statusCopy: string;
  };
  checklist: ChecklistItem[];
  documents: DocumentRequest[];
  followUp: {
    id: string;
    title: string;
    status: FollowUpStatus;
    dueLabel: string;
    instructions: string;
    nextSteps: string[];
  };
  consent: ConsentState;
  greeting: { vernacular: string; language: string };
};

export type SubmitActionPayload =
  | { type: "confirm_appointment"; appointmentId: string }
  | { type: "request_reschedule"; appointmentId: string; reason: string }
  | { type: "update_checklist"; itemId: string; completed: boolean }
  | { type: "mark_document_uploaded"; documentId: string; appointmentId: string; documentType: string; fileName: string; mimeType: string; sizeBytes: number }
  | { type: "confirm_follow_up"; followUpId: string; status: "confirmed" | "needs_callback" }
  | { type: "update_consent"; channel: "whatsapp" | "calls" | "documents"; enabled: boolean }
  | { type: "opt_out" };

export type SubmitResult = {
  ok: boolean;
  source: "api" | "mock";
  message: string;
};
