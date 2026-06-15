export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type CopilotTask = "summarize" | "draft" | "extract_intent" | "explain_identity_match";

export type ControlTowerTask =
  | "prioritize"
  | "detect_leakage"
  | "next_best_actions"
  | "access_next_actions"
  | "follow_up_leakage";

export interface SourceRef {
  id: string;
  type: "message" | "call_note" | "appointment" | "visit" | "report" | "task" | "payment" | "profile";
  label: string;
  excerpt?: string;
}

export interface DecisionTraceStep {
  id: string;
  label: string;
  rationale: string;
  weight?: number;
}

export interface DecisionTrace {
  traceId: string;
  mode: "mock";
  policyVersion: string;
  generatedAt: string;
  tenantId?: string;
  requestActor?: string;
  steps: DecisionTraceStep[];
}

export interface IntelligenceResponse<T> {
  requestId: string;
  status: "ok" | "fallback";
  task: CopilotTask | ControlTowerTask;
  confidence: number;
  data: T;
  result?: T;
  sources: SourceRef[];
  decisionTrace: DecisionTrace;
  fallback?: {
    reason: string;
    behavior: string;
  };
}

export interface PatientSignal {
  patientId?: string;
  patientName?: string;
  age?: number;
  gender?: string;
  preferredLanguage?: string;
  phone?: string;
  caregiverName?: string;
  specialty?: string;
  branch?: string;
  doctorName?: string;
  messages?: string[];
  callNotes?: string[];
  appointmentStatus?: string;
  appointmentAt?: string;
  lastVisitAt?: string;
  nextFollowUpAt?: string;
  diagnoses?: string[];
  medications?: string[];
  reports?: ReportSignal[];
  openTasks?: TaskSignal[];
  payments?: PaymentSignal[];
  context?: Record<string, unknown>;
}

export interface ReportSignal {
  id?: string;
  name: string;
  status?: "normal" | "abnormal" | "critical" | "unknown";
  summary?: string;
  reportedAt?: string;
  reviewed?: boolean;
}

export interface TaskSignal {
  id?: string;
  title: string;
  status?: "open" | "in_progress" | "done" | "cancelled";
  dueAt?: string;
  ownerRole?: string;
  priority?: UrgencyLevel;
}

export interface PaymentSignal {
  id?: string;
  amount?: number;
  status?: "pending" | "paid" | "failed" | "waived";
  label?: string;
}

export interface SummarizeRequest {
  requestId?: string;
  patient: PatientSignal;
  summaryType?: "patient_brief" | "visit_brief" | "handoff" | "timeline";
}

export interface SummaryResult {
  title: string;
  summary: string;
  highlights: string[];
  risks: string[];
  recommendedFollowUps: string[];
}

export interface DraftRequest {
  requestId?: string;
  patient: PatientSignal;
  channel?: "whatsapp" | "sms" | "call_script";
  language?: string;
  intent?: string;
  tone?: "warm" | "formal" | "urgent";
}

export interface DraftResult {
  channel: "whatsapp" | "sms" | "call_script";
  language: string;
  message: string;
  approvalRequired: boolean;
  guardrails: string[];
}

export interface ExtractIntentRequest {
  requestId?: string;
  text: string;
  patient?: PatientSignal;
}

export interface ExtractIntentResult {
  primaryIntent: string;
  secondaryIntents: string[];
  urgency: UrgencyLevel;
  specialtyHint?: string;
  entities: Record<string, string[]>;
  suggestedQueue: string;
}

export interface PrioritizeRequest {
  requestId?: string;
  items: PatientSignal[];
  objective?: "follow_up" | "access" | "revenue" | "clinical_risk";
}

export interface PrioritizedItem {
  patientId?: string;
  patientName?: string;
  score: number;
  urgency: UrgencyLevel;
  reasons: string[];
  recommendedOwnerRole: string;
}

export interface PrioritizeResult {
  objective: string;
  orderedItems: PrioritizedItem[];
}

export interface LeakageRequest {
  requestId?: string;
  items: PatientSignal[];
  leakageType?: "follow_up" | "diagnostics" | "procedure" | "payment" | "all";
}

export interface LeakageItem {
  patientId?: string;
  patientName?: string;
  leakageType: "follow_up" | "diagnostics" | "procedure" | "payment";
  severity: UrgencyLevel;
  evidence: string[];
  suggestedAction: string;
}

export interface LeakageResult {
  leakageType: string;
  items: LeakageItem[];
  totalDetected: number;
}

export interface NextBestActionRequest {
  requestId?: string;
  patient: PatientSignal;
  objective?: "continue_care" | "convert_visit" | "recover_leakage" | "prepare_visit";
}

export interface NextBestAction {
  actionId: string;
  label: string;
  ownerRole: string;
  urgency: UrgencyLevel;
  rationale: string;
  draftAvailable: boolean;
}

export interface NextBestActionResult {
  objective: string;
  actions: NextBestAction[];
}

export interface IdentityCandidate {
  patientId?: string;
  patientName?: string;
  householdId?: string;
  householdName?: string;
  phone?: string;
  uhid?: string;
  branch?: string;
  age?: number;
  gender?: string;
  caregiverName?: string;
}

export interface ExplainIdentityMatchRequest {
  requestId?: string;
  requester: {
    phone?: string;
    name?: string;
    relationship?: string;
    message?: string;
  };
  candidates: IdentityCandidate[];
}

export interface IdentityMatchExplanation {
  candidateId: string;
  patientName?: string;
  householdId?: string;
  confidence: number;
  recommendation: "link_patient" | "link_household" | "create_patient" | "manual_review";
  reasons: string[];
  warnings: string[];
}

export interface ExplainIdentityMatchResult {
  requesterType: "patient" | "caregiver" | "family_member" | "unknown";
  explanations: IdentityMatchExplanation[];
  recommendedAction: string;
}

export interface AccessNextActionRequest {
  requestId?: string;
  patient: PatientSignal;
  accessRequest?: {
    specialty?: string;
    preferredDoctor?: string;
    preferredBranch?: string;
    preferredDate?: string;
    status?: string;
    source?: string;
  };
}

export interface AccessNextActionResult {
  noShowRisk: UrgencyLevel;
  recommendedQueue: string;
  slotStrategy: string;
  actions: NextBestAction[];
}

export interface FollowUpLeakageRequest {
  requestId?: string;
  patient: PatientSignal;
  journey?: {
    journeyId?: string;
    type?: string;
    stage?: string;
    dueAt?: string;
    lastContactAt?: string;
    status?: string;
  };
}

export interface FollowUpLeakageResult {
  leakageDetected: boolean;
  severity: UrgencyLevel;
  reasons: string[];
  recommendedOwnerRole: string;
  nextAction: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
