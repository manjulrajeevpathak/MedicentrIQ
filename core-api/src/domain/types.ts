import type { ModuleKey, PlanId } from "./platform.js";

export type IdentityStatus = "unverified" | "suggested_match" | "verified" | "conflict";
export type Priority = "urgent" | "high" | "medium" | "low";
export type InteractionChannel = "whatsapp" | "call" | "missed_call" | "web" | "referral" | "walk_in" | "staff_note";
export type InteractionDirection = "inbound" | "outbound" | "internal";
export type InteractionStatus = "new" | "triaged" | "linked" | "closed";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskSource = "healthcareos";
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_consult"
  | "rescheduled"
  | "completed"
  | "no_show"
  | "cancelled";
export type DoctorStatus = "active" | "inactive";
export type FollowUpStatus = "due" | "confirmed" | "completed" | "missed" | "escalated";
export type AccessRequestStatus =
  | "requested"
  | "triaged"
  | "slot_offered"
  | "hold_created"
  | "booked"
  | "mobile_link_sent"
  | "confirmed"
  | "reschedule_requested"
  | "cancelled";
export type JourneyTemplateStatus = "draft" | "active" | "retired";
export type PatientJourneyStatus = "planned" | "active" | "paused" | "completed" | "cancelled";
export type JourneyTaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "skipped";
export type ConsentStatus = "granted" | "revoked" | "unknown";
export type ActorType = "staff" | "service" | "patient_link" | "platform";
export type Role =
  | "front_desk"
  | "call_center"
  | "care_coordinator"
  | "nurse"
  | "doctor"
  | "admin"
  | "org_admin"
  | "integration_service"
  | "workflow_service"
  | "platform_admin";
export type Permission =
  | "auth:read_self"
  | "patients:read"
  | "patients:create"
  | "identity:resolve"
  | "interactions:read"
  | "interactions:create"
  | "interactions:update"
  | "tasks:read"
  | "tasks:update"
  | "appointments:read"
  | "appointments:create"
  | "appointments:confirm"
  | "doctors:read"
  | "doctors:manage"
  | "access_requests:read"
  | "access_requests:update"
  | "mobile_links:use"
  | "documents:create"
  | "documents:read"
  | "clinical:read"
  | "clinical:write"
  | "followups:confirm"
  | "journeys:read"
  | "journeys:update"
  | "audit:read"
  | "service_events:ingest"
  | "users:read"
  | "users:manage"
  | "messages:send"
  | "tenant:settings:manage"
  | "platform:tenants:read"
  | "platform:tenants:manage"
  | "platform:entitlements:manage"
  | "platform:admins:read"
  | "platform:admins:manage";

export type TenantType = "hospital" | "clinic";

export type Organization = {
  id: string;
  displayName: string;
  status: "active" | "inactive" | "suspended";
  /** Hospital vs clinic — drives defaults and labelling in the superadmin console. */
  type: TenantType;
  /** Plan tier assigned by the HealthOS superadmin team. */
  planId: PlanId;
  /** Per-module on/off overrides on top of the plan bundle (sparse). */
  moduleOverrides?: Partial<Record<ModuleKey, boolean>>;
  /** Superadmin override of the plan's default seat limit (null = unlimited). */
  seatLimitOverride?: number | null;
  /** Tenant-wide 2FA stance; "required" forces email-OTP for all staff. */
  mfaPolicy?: "optional" | "required";
  createdAt: string;
};

export type Branch = {
  id: string;
  tenantId: string;
  displayName: string;
  city: string;
  status: "active" | "inactive";
  createdAt: string;
};

/** Credentials + auth lifecycle shared by staff users and platform admins. */
export type AuthCredentials = {
  passwordHash?: string;
  passwordSalt?: string;
  /** Bumped on password reset / suspend / MFA change to invalidate live tokens. */
  credentialVersion: number;
  /** True until a forced first-login password reset is completed. */
  mustResetPassword?: boolean;
  /** Per-principal email-OTP 2FA opt-in (a tenant policy of "required" overrides). */
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
};

export type User = AuthCredentials & {
  id: string;
  tenantId: string;
  displayName: string;
  email?: string;
  roles: Role[];
  branchIds: string[];
  status: "active" | "inactive" | "suspended";
  createdAt: string;
};

/** HealthOS superadmin (platform tier). Not tenant-scoped — global rows. */
export type PlatformAdmin = AuthCredentials & {
  id: string;
  email: string;
  displayName: string;
  roles: Extract<Role, "platform_admin">[];
  status: "active" | "inactive" | "suspended";
  createdAt: string;
};

export type PrincipalType = "staff" | "platform";

/** Short-lived email-OTP challenge issued mid-login. Persisted, keyed by token. */
export type LoginChallenge = {
  token: string;
  principalType: PrincipalType;
  principalId: string;
  tenantId: string;
  codeHash: string;
  codeSalt: string;
  purpose: "login_mfa";
  attempts: number;
  expiresAt: string;
  createdAt: string;
};

/** Short-lived single-use password reset token. Persisted, keyed by token. */
export type PasswordResetToken = {
  token: string;
  principalType: PrincipalType;
  principalId: string;
  tenantId: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

export type ServiceApiKey = {
  id: string;
  tenantId: string;
  displayName: string;
  key: string;
  role: Extract<Role, "integration_service" | "workflow_service">;
  status: "active" | "inactive";
  createdAt: string;
};

// ---- Messaging channels (per-tenant) --------------------------------------

export type ChannelProvider = "ultramsg" | "aisensy";
export type MessageType = "transactional" | "marketing";

/** Per-tenant WhatsApp channel credentials. recordId = tenantId. Secrets are
 *  redacted on read everywhere except the manage path. */
export type TenantChannelConfig = {
  tenantId: string;
  /** UltraMsg — free-form/session (transactional). */
  ultramsg?: { instanceId: string; token: string; enabled: boolean };
  /** AISensy — template/campaign (marketing). */
  aisensy?: { apiKey: string; enabled: boolean };
  createdAt: string;
  updatedAt: string;
};

/** Outbound message audit log (basis for future campaign delivery tracking). */
export type MessageLog = {
  id: string;
  tenantId: string;
  to: string;
  channel: ChannelProvider;
  type: MessageType;
  status: "sent" | "failed";
  body?: string;
  campaign?: string;
  providerId?: string;
  error?: string;
  createdAt: string;
};

export type RequestContext = {
  actorType: ActorType;
  tenantId: string;
  actorId: string;
  displayName: string;
  roles: Role[];
  branchIds: string[];
  permissions: Permission[];
  isDemoMode: boolean;
  source: "staff_session" | "demo_headers" | "service_api_key" | "mobile_link" | "system_default" | "platform_api_key" | "platform_session";
  sessionId?: string;
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  actorType: ActorType;
  actorId: string;
  actorDisplayName: string;
  action:
    | "patient.view"
    | "patient.create"
    | "patient.identity_resolve"
    | "household.update"
    | "interaction.create"
    | "interaction.assign"
    | "interaction.update"
    | "task.update"
    | "access_request.create"
    | "access_request.update"
    | "appointment.create"
    | "appointment.update"
    | "appointment.confirm"
    | "appointment.book"
    | "appointment.disposition"
    | "clinical.update"
    | "document.upload"
    | "doctor.create"
    | "doctor.update"
    | "scheduling.send_confirmations"
    | "document_metadata.create"
    | "follow_up.confirm"
    | "journey.create"
    | "journey.update"
    | "mobile_link.lookup"
    | "mobile_link.action"
    | "workflow.trigger"
    | "service_webhook.intake"
    | "tenant.create"
    | "tenant.update"
    | "tenant.settings_update"
    | "message.send"
    | "auth.login"
    | "auth.login_failed"
    | "auth.logout"
    | "auth.mfa_challenge"
    | "auth.password_reset_requested"
    | "auth.password_reset"
    | "auth.password_change"
    | "user.create"
    | "user.update"
    | "platform_admin.create"
    | "platform_admin.update";
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type Caregiver = {
  id: string;
  displayName: string;
  relationship: string;
  phone: string;
  consentStatus: ConsentStatus;
};

export type HouseholdMember = {
  patientId: string;
  displayName: string;
  relationship: string;
  branchId: string;
  primaryContact: boolean;
};

export type HouseholdCaregiverPermission = {
  caregiverId: string;
  caregiverName: string;
  relationship: string;
  phone?: string;
  consentStatus: ConsentStatus;
  permissions: Array<"book" | "reschedule" | "receive_reminders" | "upload_documents" | "receive_reports" | "make_payments">;
  expiresAt?: string;
};

export type Household = {
  id: string;
  tenantId: string;
  displayName: string;
  primaryPhone?: string;
  alternatePhones: string[];
  preferredLanguage?: string;
  defaultCaregiverId?: string;
  riskNotes: string[];
  members: HouseholdMember[];
  caregiverPermissions: HouseholdCaregiverPermission[];
  createdAt: string;
  updatedAt: string;
};

export type Patient = {
  id: string;
  tenantId: string;
  householdId?: string;
  displayName: string;
  age?: number;
  gender?: "female" | "male" | "other" | "unknown";
  primaryPhone?: string;
  preferredLanguage?: string;
  branchId: string;
  uhid?: string;
  abhaId?: string;
  identityStatus: IdentityStatus;
  tags: string[];
  caregivers: Caregiver[];
  consent: {
    communications: ConsentStatus;
    aiProcessing: ConsentStatus;
    documentSharing: ConsentStatus;
  };
  createdAt: string;
  updatedAt: string;
};

export type Interaction = {
  id: string;
  tenantId: string;
  patientId?: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  status: InteractionStatus;
  subject: string;
  body: string;
  from?: string;
  to?: string;
  language?: string;
  intent?: string;
  urgency?: Priority;
  receivedAt: string;
  createdTaskIds: string[];
  sourceExternalId?: string;
  assignedToRole?: WorkbenchTask["ownerRole"];
  assignedToUserId?: string;
  linkedResourceIds?: string[];
  notes?: InteractionThreadNote[];
  drafts?: InteractionDraft[];
};

export type InteractionThreadNote = {
  id: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  visibility: "internal" | "patient_visible";
  createdAt: string;
};

export type InteractionDraft = {
  id: string;
  authorId: string;
  authorDisplayName: string;
  channel: InteractionChannel;
  body: string;
  status: "draft" | "ready_to_send" | "sent" | "discarded";
  createdAt: string;
  updatedAt: string;
};

export type AccessRequest = {
  id: string;
  tenantId: string;
  patientId?: string;
  householdId?: string;
  interactionId?: string;
  requesterName?: string;
  requesterPhone?: string;
  requestedSpecialty?: string;
  requestedBranchId?: string;
  reason: string;
  priority: Priority;
  status: AccessRequestStatus;
  candidateSlot?: {
    doctorName: string;
    specialty: string;
    branchId: string;
    scheduledAt: string;
  };
  hold?: {
    heldAt: string;
    expiresAt: string;
    heldBy: string;
  };
  appointmentId?: string;
  mobileLinkToken?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

/** A working window within a doctor's weekly availability. Times are local "HH:MM". */
export type DoctorWorkingWindow = {
  start: string;
  end: string;
  branchId?: string;
};

export type Doctor = {
  id: string;
  tenantId: string;
  displayName: string;
  specialty?: string;
  branchIds: string[];
  /** Phone used for the daily confirm message. */
  phone?: string;
  /** Slot granularity in minutes (default 15). */
  slotMinutes: number;
  /** Weekly availability: day 0=Sun..6=Sat → working windows. */
  weeklyHours: Record<number, DoctorWorkingWindow[]>;
  status: DoctorStatus;
  /** Optional link to a staff User record. */
  userId?: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId?: string;
  doctorName: string;
  specialty: string;
  branchId: string;
  scheduledAt: string;
  durationMinutes?: number;
  status: AppointmentStatus;
  reason: string;
  confirmation?: {
    confirmedAt: string;
    confirmedBy: "patient" | "caregiver" | "staff";
    notes?: string;
  };
  /** Captured when the visit reaches "completed" — the clinical outcome + next step. */
  disposition?: AppointmentDisposition;
  noShowRisk?: Priority;
  createdAt: string;
  updatedAt: string;
};

/** Outcome of a completed visit (the patient funnel's terminal "Disposition" stage). */
export type AppointmentDisposition = {
  /** e.g. "advised_surgery" | "follow_up" | "prescribed" | "discharged" (free-form). */
  outcome: string;
  notes?: string;
  nextStep?: string;
  nextActionDate?: string;
  recordedBy?: string;
  recordedAt: string;
};

export type WorkbenchTask = {
  id: string;
  tenantId: string;
  patientId?: string;
  interactionId?: string;
  appointmentId?: string;
  title: string;
  priority: Priority;
  dueAt: string;
  status: TaskStatus;
  ownerRole: "front_desk" | "call_center" | "care_coordinator" | "nurse" | "doctor" | "admin";
  reason: string;
  recommendedAction: string;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  outcome?: string;
};

export type MobileLinkSession = {
  token: string;
  tenantId: string;
  patientId: string;
  expiresAt: string;
  allowedActions: Array<
    | "confirm_appointment"
    | "upload_document_metadata"
    | "confirm_follow_up"
    | "reschedule_request"
    | "update_checklist"
    | "update_consent"
    | "opt_out"
  >;
  createdAt: string;
};

/** Clinical document classification used by the staff upload→store→download flow. */
export type DocumentType = "prescription" | "discharge" | "lab" | "other";

export type DocumentMetadata = {
  id: string;
  tenantId: string;
  patientId: string;
  sessionToken?: string;
  appointmentId?: string;
  documentType: "lab_report" | "prescription" | "insurance" | "id_proof" | "referral" | "other";
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  storageStatus: "metadata_only" | "pending_upload" | "uploaded" | "rejected";
  notes?: string;
  /** Object-storage key (S3 or local fallback) once a file is uploaded. */
  storageKey?: string;
  contentType?: string;
  /** Original filename as provided by the uploader (mirrors fileName for staff uploads). */
  filename?: string;
  /** Staff-facing document classification (prescription/discharge/lab/other). */
  type?: DocumentType;
  uploadedBy?: string;
  createdAt: string;
};

/** Per-patient clinical history (ICD-10 conditions, allergies). recordId = patientId. */
export type ClinicalCondition = {
  icd10Code: string;
  label: string;
  since?: string;
  notes?: string;
};

export type ClinicalRecord = {
  patientId: string;
  tenantId: string;
  conditions: ClinicalCondition[];
  allergies?: string[];
  notes?: string;
  updatedAt: string;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  title: string;
  dueAt: string;
  status: FollowUpStatus;
  instructions: string;
  confirmedAt?: string;
  patientResponse?: string;
  createdAt: string;
  updatedAt: string;
};

export type JourneyTemplate = {
  id: string;
  tenantId: string;
  name: string;
  condition: string;
  status: JourneyTemplateStatus;
  defaultOwnerRole: WorkbenchTask["ownerRole"];
  steps: Array<{
    key: string;
    title: string;
    offsetDays: number;
    instructions: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type PatientJourney = {
  id: string;
  tenantId: string;
  patientId: string;
  templateId?: string;
  title: string;
  status: PatientJourneyStatus;
  ownerRole: WorkbenchTask["ownerRole"];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type JourneyTask = {
  id: string;
  tenantId: string;
  journeyId: string;
  patientId: string;
  followUpId?: string;
  title: string;
  status: JourneyTaskStatus;
  dueAt: string;
  ownerRole: WorkbenchTask["ownerRole"];
  instructions: string;
  completedAt?: string;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
};

export type JourneyEvent = {
  id: string;
  tenantId: string;
  journeyId: string;
  patientId: string;
  type: "created" | "started" | "task_created" | "task_updated" | "follow_up_confirmed" | "workflow_callback" | "note" | "completed";
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type TimelineEvent = {
  id: string;
  patientId: string;
  occurredAt: string;
  type: "interaction" | "appointment" | "task" | "document" | "follow_up";
  title: string;
  description: string;
  sourceId: string;
};

export type PatientSummary = Patient & {
  openTaskCount: number;
  upcomingAppointmentCount: number;
  pendingFollowUpCount: number;
  lastInteractionAt?: string;
  household?: Household;
};

export type WorkbenchTaskView = WorkbenchTask & {
  patient?: Pick<Patient, "id" | "displayName" | "primaryPhone" | "preferredLanguage" | "identityStatus">;
};
