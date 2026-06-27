/**
 * Client-safe types + label constants for the Patients / Patient 360 surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's patient, clinical, documents and disposition
 * contracts (all served under the `{data}` envelope with a Bearer session).
 */

// ---- Directory & detail ----------------------------------------------------

export type DirectoryPatient = {
  id: string;
  displayName: string;
  age?: number;
  gender?: string;
  primaryPhone?: string;
  tags?: string[];
  branchId?: string;
};

/** The visit-funnel stage core-api derives from the patient's latest appointment. */
export type LifecycleStage =
  | "no_visit"
  | "scheduled"
  | "checked_in"
  | "in_consult"
  | "opd_done"
  | "missed"
  | "cancelled";

export type PatientLifecycle = {
  stage: LifecycleStage;
  latestStatus?: string;
  latestAppointmentId?: string;
  lastVisitAt?: string;
  lastDisposition?: AppointmentDisposition;
  openNextAction?: { description: string; dueAt?: string };
};

/** A full patient record returned by `GET /patients/:id` (summary + lifecycle). */
export type PatientDetail = DirectoryPatient & {
  preferredLanguage?: string;
  lifecycle: PatientLifecycle;
};

// ---- Timeline --------------------------------------------------------------

export type TimelineEvent = {
  id: string;
  occurredAt: string;
  type: string;
  title: string;
  description: string;
};

// ---- Clinical history ------------------------------------------------------

export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category?: string;
};

export type ClinicalCondition = {
  icd10Code: string;
  label: string;
  since?: string;
  notes?: string;
};

export type ClinicalRecord = {
  conditions: ClinicalCondition[];
  allergies: string[];
  notes?: string;
};

// ---- Documents -------------------------------------------------------------

export type DocumentType = "prescription" | "discharge" | "lab" | "other";

export type PatientDocument = {
  id: string;
  type?: DocumentType;
  documentType?: string;
  filename?: string;
  fileName?: string;
  contentType?: string;
  mimeType?: string;
  createdAt?: string;
  uploadedAt?: string;
};

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "discharge", label: "Discharge summary" },
  { value: "lab", label: "Lab report" },
  { value: "other", label: "Other" }
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.value, d.label])
) as Record<DocumentType, string>;

/** Normalise the document type from either the new `type` or legacy `documentType`. */
export function documentTypeLabel(doc: PatientDocument): string {
  const t = doc.type ?? (doc.documentType === "lab_report" ? "lab" : doc.documentType);
  if (t && (t in DOCUMENT_TYPE_LABELS)) return DOCUMENT_TYPE_LABELS[t as DocumentType];
  return "Document";
}

export function documentFilename(doc: PatientDocument): string {
  return doc.filename ?? doc.fileName ?? "Untitled";
}

export function documentDate(doc: PatientDocument): string | undefined {
  return doc.uploadedAt ?? doc.createdAt;
}

// ---- Appointments / visits -------------------------------------------------

export type AppointmentDisposition = {
  outcome: string;
  notes?: string;
  nextStep?: string;
  nextActionDate?: string;
  recordedAt?: string;
};

export type PatientVisit = {
  id: string;
  doctorId: string;
  doctorName?: string;
  scheduledAt: string;
  status: string;
  reason?: string;
  disposition?: AppointmentDisposition;
};

export const DISPOSITION_OUTCOMES: { value: string; label: string }[] = [
  { value: "advised_surgery", label: "Advised surgery" },
  { value: "follow_up", label: "Follow-up" },
  { value: "prescribed", label: "Prescribed" },
  { value: "discharged", label: "Discharged" }
];

export const DISPOSITION_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  DISPOSITION_OUTCOMES.map((o) => [o.value, o.label])
);

// ---- Lifecycle presentation -----------------------------------------------

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  no_visit: "No visit yet",
  scheduled: "Scheduled",
  checked_in: "Checked in",
  in_consult: "In consult",
  opd_done: "OPD done",
  missed: "Missed",
  cancelled: "Cancelled"
};

export const LIFECYCLE_STAGE_TONE: Record<
  LifecycleStage,
  "neutral" | "brand" | "good" | "high" | "critical"
> = {
  no_visit: "neutral",
  scheduled: "brand",
  checked_in: "brand",
  in_consult: "brand",
  opd_done: "good",
  missed: "high",
  cancelled: "critical"
};

export const VISIT_STATUS_TONE: Record<string, "neutral" | "brand" | "good" | "high" | "critical"> = {
  scheduled: "brand",
  confirmed: "good",
  rescheduled: "brand",
  checked_in: "brand",
  in_consult: "brand",
  completed: "good",
  cancelled: "critical",
  no_show: "high"
};

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
