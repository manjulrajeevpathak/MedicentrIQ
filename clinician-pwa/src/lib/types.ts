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

/** An ICD-10-coded condition as core-api stores it (chief complaints, diagnosis…). */
export type CodedCondition = {
  icd10Code: string;
  label: string;
};

/** Root OPD outcome — the disposition campaigns retarget on. */
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

/** Structured clinical observations on an OPD visit (mirrors core-api). */
export type VisitClinical = {
  chiefComplaintCodes?: CodedCondition[];
  chiefComplaints?: string;
  preExistingCodes?: CodedCondition[];
  preExistingDiseases?: string;
  diagnosisText?: string;
  advisePharmacy?: string;
  adviseDiagnostics?: string;
  adviseProcedureAdmission?: string;
  adviseProcedureCodes?: CodedCondition[];
  outcome?: VisitOutcome;
  revisitAdvised?: boolean;
  revisitDate?: string;
  prescriptionDocumentIds?: string[];
};

/** AI-extracted suggestions from a prescription (POST /visits/:id/extract-prescription). */
export type PrescriptionExtract = {
  chiefComplaints: string;
  preExistingDiseases: string;
  diagnosisText: string;
  advisePharmacy: string;
  adviseDiagnostics: string;
  adviseProcedureAdmission: string;
  revisitAdvised: boolean;
  revisitDate: string;
  suggestedOutcome: VisitOutcome | null;
  documentId: string;
};

/** An OPD visit as served by GET /visits (subset the PWA needs). */
export type OpdVisit = {
  id: string;
  patientId: string;
  status: string;
  chiefComplaint?: string;
  doctorName?: string;
  registeredAt: string;
  /** Coded diagnosis (ClinicalCondition[]). */
  diagnosis?: CodedCondition[];
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
