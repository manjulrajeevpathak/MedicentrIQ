/* ---------------------------------------------------------------------------
   HealthcareOS staff console — domain types
   Mirrors the core-api dashboard contract and extends it with the richer
   per-workspace detail the next-generation UI renders.
   ------------------------------------------------------------------------- */

import type { ModuleKey } from "./ia";

export type ServiceHealth = "online" | "degraded" | "offline";
export type QueuePriority = "critical" | "high" | "medium" | "low";
export type Channel = "WhatsApp" | "Call" | "Web" | "Walk-in" | "Referral";

export type StaffRole =
  | "front_desk"
  | "call_center"
  | "care_coordinator"
  | "nurse"
  | "doctor"
  | "department_admin"
  | "org_admin";

export type PermissionKey =
  | "workbench:manage"
  | "inbox:assign"
  | "patient360:view"
  | "patients:create"
  | "appointment:write"
  | "visits:read"
  | "followup:manage"
  | "audit:view"
  | "analytics:view"
  | "campaign:send"
  | "journey:manage";

export type MetricTone = "good" | "watch" | "risk";

export type Metric = {
  label: string;
  value: string;
  delta: string;
  tone: MetricTone;
  /** 0-100 sparkline samples for the trend chip. */
  trend?: number[];
  hint?: string;
};

export type WorkbenchItem = {
  id: string;
  priority: QueuePriority;
  owner: string;
  patient: string;
  summary: string;
  due: string;
  reason: string;
  channel?: Channel;
  slaMinutes?: number;
};

export type InteractionMessage = {
  id: string;
  author: "patient" | "staff" | "system";
  authorName: string;
  at: string;
  body: string;
  internal?: boolean;
};

export type InboxItem = {
  id: string;
  channel: Channel;
  patient: string;
  preview: string;
  intent: string;
  status: "new" | "waiting" | "assigned" | "escalated";
  age: string;
  assignee: string;
  language?: string;
  confidence?: number;
  unread?: number;
  thread?: InteractionMessage[];
  /** Set when staff link the conversation to a patient record. */
  linkedPatient?: string;
};

export type TimelineItem = {
  at: string;
  title: string;
  note: string;
  kind?: "clinical" | "message" | "task" | "system";
};

export type HouseholdContext = {
  id: string;
  name: string;
  primaryPhone: string;
  preferredLanguage: string;
  riskNotes: string[];
  members: Array<{
    patientId: string;
    displayName: string;
    relationship: string;
    primaryContact: boolean;
  }>;
  caregivers: Array<{
    id: string;
    displayName: string;
    relationship: string;
    consentStatus: "granted" | "revoked" | "unknown";
    permissions: string[];
  }>;
};

export type PatientSummary = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  caregiver: string;
  language: string;
  branch: string;
  doctor: string;
  condition: string;
  risk: QueuePriority;
  nextBestAction: string;
  openItems: string[];
  household?: HouseholdContext;
  timeline: TimelineItem[];
};

export type DirectoryPatient = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  uhid: string;
  branch: string;
  doctor: string;
  condition: string;
  risk: QueuePriority;
  lastSeen: string;
  tags: string[];
};

export type MatchCandidate = {
  id: string;
  name: string;
  phone: string;
  uhid: string;
  branch: string;
  confidence: number;
  signals: string[];
};

export type AccessSlot = {
  id: string;
  label: string;
  doctor: string;
  branch: string;
  status: "open" | "held" | "limited";
};

export type AccessState = "open" | "held" | "confirmed" | "link_sent";

export type AccessQueueItem = {
  id: string;
  patient: string;
  request: string;
  branch: string;
  doctor: string;
  slot: string;
  risk: QueuePriority;
  blocker: string;
  channel?: Channel;
  noShowRisk?: number;
  slots?: AccessSlot[];
  /** Optimistic progress state set by staff actions. */
  state?: AccessState;
};

export type JourneyStage = {
  label: string;
  state: "done" | "active" | "pending" | "missed";
};

export type FollowUpQueueItem = {
  id: string;
  patient: string;
  journey: string;
  stage: string;
  due: string;
  owner: string;
  risk: QueuePriority;
  nextStep: string;
  leakageRisk?: number;
  stages?: JourneyStage[];
  protocol?: Array<{ label: string; done: boolean }>;
};

export type ServiceStatus = {
  name: string;
  health: ServiceHealth;
  detail: string;
  latency: string;
  authMode?: string;
  scope?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  actorRole: StaffRole | "system" | "service";
  action: string;
  resource: string;
  tenantId: string;
  branchId?: string;
  outcome: "allowed" | "denied" | "system";
  summary: string;
};

export type TenantContext = { id: string; name: string };
export type BranchContext = { id: string; name: string };

export type DemoUser = {
  id: string;
  name: string;
  role: StaffRole;
  title: string;
  permissions: PermissionKey[];
};

export type PermissionBadge = {
  key: PermissionKey;
  label: string;
  granted: boolean;
};

export type DemoAuthContext = {
  mode: "staff-session" | "demo-headers" | "fallback";
  tenant: TenantContext;
  branch: BranchContext;
  activeUser: DemoUser;
  availableUsers: DemoUser[];
  permissionBadges: PermissionBadge[];
  /** True when a real logged-in session drives activeUser (disables "view as"). */
  isRealSession?: boolean;
};

/** The real authenticated principal, surfaced by core-api when logged in. */
export type SessionUser = { id: string; displayName: string; roles: string[]; email: string | null };

export type FloorVitalTone = "neutral" | "good" | "watch" | "risk";

/** A single operational vital on the front-desk Today cockpit. */
export type FloorVital = {
  label: string;
  value: string;
  hint?: string;
  tone?: FloorVitalTone;
};

/** One hour of today's patient load, for the "Today's flow" curve. */
export type FlowHour = {
  hour: string;
  load: number;
  state?: "now" | "busy" | "quiet" | "normal";
};

/** A person in the waiting room / freshly arrived. */
export type WaitingPatient = {
  id: string;
  name: string;
  context: string;
  waitMin: number;
  note?: string;
  action: string;
  tone?: "neutral" | "watch";
};

/** A patient the floor lead should reach personally, framed by their situation. */
export type NeedsPersonCard = {
  id: string;
  name: string;
  age: number;
  note: string;
};

export type DashboardData = {
  generatedAt: string;
  source: "core-api" | "mock";
  /** Entitlements for the active tenant; drives which nav surfaces render. */
  entitlements?: { planId: string | null; enabledModules: ModuleKey[] };
  /** Real authenticated principal (present only on a live logged-in session). */
  sessionUser?: SessionUser | null;
  authContext: DemoAuthContext;
  metrics: Metric[];
  daySummary: string;
  floorVitals: FloorVital[];
  todayFlow: FlowHour[];
  waitingRoom: WaitingPatient[];
  needsPerson: NeedsPersonCard;
  workbench: WorkbenchItem[];
  inbox: InboxItem[];
  patient360: PatientSummary;
  /** Full Patient 360 record keyed by patient id — every directory patient has one. */
  patientProfiles: Record<string, PatientSummary>;
  directory: DirectoryPatient[];
  matchCandidates: MatchCandidate[];
  accessQueue: AccessQueueItem[];
  followUpQueue: FollowUpQueueItem[];
  serviceStatus: ServiceStatus[];
  auditEvents: AuditEvent[];
};
