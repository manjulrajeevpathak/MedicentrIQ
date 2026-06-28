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
  consultNotes?: string;
  registeredAt?: string;
  createdAt?: string;
  /** Carried through from the intake form for queue presentation. */
  age?: number;
  gender?: string;
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

/** The status filters shown across the OPD queue. */
export const QUEUE_FILTERS: { value: VisitStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "in_consult", label: "In consult" },
  { value: "completed", label: "Completed" }
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

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function visitMeta(visit: Visit): string {
  return [visit.age ? `${visit.age}y` : null, visit.gender]
    .filter(Boolean)
    .join(" · ");
}
