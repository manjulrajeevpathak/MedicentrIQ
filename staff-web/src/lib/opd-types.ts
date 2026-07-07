/**
 * Client-safe types + label/constants for the OPD walk-in intake surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's intake/visits contract (served under the `{data}`
 * envelope with a Bearer session).
 */

// ---- Conditions ------------------------------------------------------------

export type IntakeCondition = {
  icd10Code: string;
  label: string;
};

// ---- Vitals ----------------------------------------------------------------

export type Vitals = {
  bp?: string;
  pulseBpm?: number;
  spo2?: number;
  tempC?: number;
  weightKg?: number;
  heightCm?: number;
  visualAcuityOD?: string;
  visualAcuityOS?: string;
  iopOD?: number;
  iopOS?: number;
};

// ---- Disposition -----------------------------------------------------------

export type Disposition = {
  outcome: string;
  notes?: string;
  nextStep?: string;
  nextActionDate?: string;
};

// ---- Visit outcome ---------------------------------------------------------

/**
 * The clinical outcome of an OPD encounter — the key field the doctor sets when
 * completing the visit (drives disposition, revisit reminders and campaign
 * audiences). Kept in sync with core-api's `VisitOutcome`.
 */
export type VisitOutcome =
  | "medicine_advised"
  | "surgery_advised"
  | "revisit_advised"
  | "diagnostics_advised"
  | "referred"
  | "admitted"
  | "discharged"
  | "observation";

export const VISIT_OUTCOME_OPTIONS: { value: VisitOutcome; label: string }[] = [
  { value: "medicine_advised", label: "Medicine advised" },
  { value: "surgery_advised", label: "Surgery advised" },
  { value: "revisit_advised", label: "Revisit advised" },
  { value: "diagnostics_advised", label: "Diagnostics advised" },
  { value: "referred", label: "Referred out" },
  { value: "admitted", label: "Admitted" },
  { value: "discharged", label: "Discharged" },
  { value: "observation", label: "Watchful observation" }
];

export const VISIT_OUTCOME_LABELS: Record<VisitOutcome, string> = Object.fromEntries(
  VISIT_OUTCOME_OPTIONS.map((o) => [o.value, o.label])
) as Record<VisitOutcome, string>;

// ---- Clinical observations ---------------------------------------------------

/**
 * Structured clinical observations captured after the consult. Saving these via
 * PATCH /visits/:visitId/clinical completes the visit (unless `complete: false`
 * is sent for a draft) — the backend derives the disposition and fires
 * workflows, so the UI never PATCHes status itself.
 */
export type VisitClinical = {
  chiefComplaints?: string;
  preExistingDiseases?: string;
  diagnosisText?: string;
  advisePharmacy?: string;
  adviseDiagnostics?: string;
  adviseProcedureAdmission?: string;
  /** ICD-10 coded chief complaints (the free-text `chiefComplaints` note rides alongside). */
  chiefComplaintCodes?: IntakeCondition[];
  /** ICD-10 coded comorbidities (the free-text `preExistingDiseases` note rides alongside). */
  preExistingCodes?: IntakeCondition[];
  /**
   * Coded procedures advised (from the curated procedure catalog). The picker maps
   * a catalog `{code,label}` onto the `IntakeCondition` shape (code → icd10Code),
   * so a `{code:"66984"}` catalog entry becomes `{icd10Code:"66984", label}`.
   */
  adviseProcedureCodes?: IntakeCondition[];
  /** The clinical outcome that completes the visit. */
  outcome?: VisitOutcome;
  revisitAdvised?: boolean;
  /** ISO date (YYYY-MM-DD) the patient was asked to return. */
  revisitDate?: string;
  /** Uploaded prescription documents (document ids) for this visit. */
  prescriptionDocumentIds?: string[];
  updatedBy?: string;
  updatedAt?: string;
};

// ---- Visit -----------------------------------------------------------------

export type VisitStatus = "registered" | "in_consult" | "completed" | "left_without_seen";

export type Visit = {
  id: string;
  patientId: string;
  patientName?: string;
  branchId?: string;
  visitType?: string;
  appointmentId?: string;
  doctorId?: string;
  doctorName?: string;
  department?: string;
  status: VisitStatus;
  chiefComplaint: string;
  intakeConditions?: IntakeCondition[];
  intakeAllergies?: string[];
  vitals?: Vitals;
  intakeNotes?: string;
  diagnosis?: IntakeCondition[];
  disposition?: Disposition;
  /** Structured clinical observations (chief complaints → advise → revisit). */
  clinical?: VisitClinical;
  consultNotes?: string;
  registeredAt?: string;
  createdAt?: string;
  /** Carried through from the intake form for register presentation. */
  age?: number;
  gender?: string;
};

/** Filters the register list sends to GET /visits. */
export type VisitListFilters = {
  status?: VisitStatus;
  patientId?: string;
  /** Single day (YYYY-MM-DD). */
  date?: string;
  /** Range start (YYYY-MM-DD, inclusive). */
  from?: string;
  /** Range end (YYYY-MM-DD, inclusive). */
  to?: string;
  doctorId?: string;
};

// ---- Intake lookup ---------------------------------------------------------

export type IntakeLookupPatient = {
  id: string;
  displayName: string;
  age?: number;
  gender?: string;
  primaryPhone?: string;
  branchId?: string;
};

export type IntakeLookupLead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  formData?: Record<string, unknown>;
};

export type IntakeTodayAppointment = {
  id: string;
  scheduledAt: string;
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  status: string;
};

export type IntakeLookupResult = {
  match: "patient" | "lead" | "none";
  patient?: IntakeLookupPatient;
  clinical?: {
    conditions: IntakeCondition[];
    allergies?: string[];
    notes?: string;
  };
  lead?: IntakeLookupLead;
  recentVisits?: Visit[];
  /** Today's still-open appointments for a matched patient — for OPD linking. */
  todaysAppointments?: IntakeTodayAppointment[];
};

// ---- Doctors / catalog -----------------------------------------------------

export type IntakeDoctor = {
  id: string;
  name: string;
  specialty?: string;
  status?: string;
};

export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category?: string;
  kind?: "symptom" | "diagnosis" | "comorbidity";
};

/**
 * An entry in the curated procedure catalog (GET /clinical/procedures?q=). The
 * "Advise → Procedure / Admission" picker maps a chosen entry onto the shared
 * `IntakeCondition` shape (`code` → `icd10Code`) for storage in
 * `VisitClinical.adviseProcedureCodes`.
 */
export type ProcedureCatalogEntry = {
  code: string;
  label: string;
  category: string;
};

/**
 * What POST /visits/:visitId/extract-prescription returns — AI-read suggestions
 * from an uploaded prescription. Nothing is saved server-side; the doctor
 * reviews the pre-filled free-text fields before submitting.
 */
export type PrescriptionExtract = {
  chiefComplaints: string;
  preExistingDiseases: string;
  diagnosisText: string;
  advisePharmacy: string;
  adviseDiagnostics: string;
  adviseProcedureAdmission: string;
  revisitAdvised: boolean;
  /** YYYY-MM-DD or "". */
  revisitDate: string;
  suggestedOutcome: VisitOutcome | null;
  documentId: string;
};

// ---- Documents (reuses the patient document contract) ----------------------

export type VisitDocumentType = "prescription" | "diagnostic_report";

export const VISIT_DOCUMENT_TYPES: { value: VisitDocumentType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "diagnostic_report", label: "Diagnostic report" }
];

// ---- Presentation constants ------------------------------------------------

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  registered: "Registered",
  in_consult: "In consult",
  completed: "Completed",
  left_without_seen: "Left without seen"
};

export const VISIT_STATUS_TONE: Record<VisitStatus, "neutral" | "brand" | "good" | "high" | "critical" | "violet"> = {
  registered: "brand",
  in_consult: "violet",
  completed: "good",
  left_without_seen: "high"
};

/**
 * The status chips shown on the OPD register. `in_consult` is intentionally
 * absent — the register has no "start consult" step (the enum survives only for
 * legacy rows).
 */
export const REGISTER_STATUS_FILTERS: { value: VisitStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "completed", label: "Completed" },
  { value: "left_without_seen", label: "Left without seen" }
];

export const DISPOSITION_OUTCOMES: { value: string; label: string }[] = [
  { value: "prescribed", label: "Prescribed" },
  { value: "follow_up", label: "Follow-up" },
  { value: "referred", label: "Referred" },
  { value: "surgery_advised", label: "Surgery advised" },
  { value: "admitted", label: "Admitted" },
  { value: "discharged", label: "Discharged" },
  { value: "no_action", label: "No action" }
];

export const DISPOSITION_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  DISPOSITION_OUTCOMES.map((o) => [o.value, o.label])
);

/** Eye-first chief-complaint quick picks. */
export const CHIEF_COMPLAINT_CHIPS = [
  "Blurred vision",
  "Eye pain",
  "Redness",
  "Watering",
  "Itching",
  "Foreign-body sensation",
  "Double vision",
  "Headache",
  "Routine check-up"
];

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" }
];

// ---- Date helpers ----------------------------------------------------------

/** Today's date as YYYY-MM-DD in local timezone. */
export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The date `days` before today as YYYY-MM-DD in local timezone. */
export function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata",  hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",  day: "numeric", month: "short", year: "numeric" });
}

/** Date + time for register rows — year shown only when it isn't the current one. */
export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit"
  });
}

export function visitMeta(visit: Visit): string {
  return [visit.age ? `${visit.age}y` : null, visit.gender]
    .filter(Boolean)
    .join(" · ");
}
