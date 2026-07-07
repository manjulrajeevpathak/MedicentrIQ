/** Client-safe domain types for the clinician PWA. */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error?: string };

export type Patient = {
  id: string;
  displayName: string;
  age?: number | null;
  gender?: string | null;
  primaryPhone?: string | null;
  /** Lifecycle stage, e.g. "lead", "active", "discharged". */
  lifecycleStage?: string | null;
};

export type Condition = {
  /** ICD-10 code, e.g. "E11.9". */
  code: string;
  label: string;
};

export type Allergy = {
  label: string;
  severity?: string | null;
};

export type ClinicalRecord = {
  conditions: Condition[];
  allergies: Allergy[];
};

export type ClinicalDocument = {
  id: string;
  type: string;
  filename: string;
  /** ISO date the document was created/uploaded. */
  createdAt?: string | null;
};

export type Appointment = {
  id: string;
  patientId: string;
  startsAt?: string | null;
  status?: string | null;
  reason?: string | null;
  provider?: string | null;
};

/** A catalogue condition returned by the ICD-10 lookup endpoint. */
export type ConditionOption = {
  code: string;
  label: string;
};

/** Structured clinical observations on an OPD visit (mirrors core-api). */
export type VisitClinical = {
  chiefComplaints?: string;
  preExistingDiseases?: string;
  diagnosisText?: string;
  advisePharmacy?: string;
  adviseDiagnostics?: string;
  adviseProcedureAdmission?: string;
  revisitAdvised?: boolean;
  revisitDate?: string;
  prescriptionDocumentIds?: string[];
};

/** An OPD visit as served by GET /visits (subset the PWA needs). */
export type OpdVisit = {
  id: string;
  patientId: string;
  status: string;
  chiefComplaint?: string;
  doctorName?: string;
  registeredAt: string;
  clinical?: VisitClinical;
};

export const DOCUMENT_TYPES = [
  { value: "prescription", label: "Prescription" },
  { value: "discharge", label: "Discharge summary" },
  { value: "lab", label: "Lab report" },
  { value: "other", label: "Other" }
] as const;

export const DISPOSITION_OUTCOMES = [
  { value: "advised_surgery", label: "Advised surgery" },
  { value: "follow_up", label: "Follow-up" },
  { value: "prescribed", label: "Prescribed" },
  { value: "discharged", label: "Discharged" }
] as const;
