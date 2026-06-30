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
  | "followups:manage"
  | "billing:read"
  | "billing:manage"
  | "journeys:read"
  | "journeys:update"
  | "audit:read"
  | "service_events:ingest"
  | "users:read"
  | "users:manage"
  | "messages:send"
  | "tenant:settings:manage"
  | "leads:read"
  | "leads:manage"
  | "forms:manage"
  | "campaigns:read"
  | "campaigns:manage"
  | "campaigns:send"
  | "calls:read"
  | "calls:manage"
  | "visits:read"
  | "visits:manage"
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
  /** Public-facing contact phone for this branch (used in appointment messages / PWA). */
  phone?: string;
  /** Postal address shown to patients ({{address}} token). */
  address?: string;
  /** Google Maps URL / share link ({{mapLink}} token). */
  mapUrl?: string;
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
  /** Telephony — per-tenant click-to-call / call-log provider (stub for now). */
  telephony?: { provider?: string; apiKey?: string; callerId?: string; enabled: boolean };
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
  /** Communication-workflow template this message was rendered from (delivery attribution). */
  templateId?: string;
  providerId?: string;
  error?: string;
  createdAt: string;
};

// ---- Communication Workflows (config / data layer) ------------------------

export type TemplateChannel = "whatsapp" | "call_script";
export type TemplateKind = "text" | "form";

/** A reusable message/call-script body (or a form reference) used by workflow stages. */
export type CommTemplate = {
  id: string;
  tenantId: string;
  name: string;
  channel: TemplateChannel;
  kind: TemplateKind;
  /** kind="text": message body with {{tokens}}. */
  body?: string;
  /** kind="form": references a LeadForm (forms collection). */
  formId?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type WorkflowAnchor = "appointment" | "visit" | "manual";
export type StageAction = "message" | "call" | "form" | "task";
export type StageTrigger =
  | { type: "on_enroll" } // fire immediately when a run starts
  | { type: "on_event"; event: string } // e.g. "cancelled","rescheduled","checked_in","visit_completed"
  | { type: "relative"; anchorEvent: string; offsetHours: number }; // anchorEvent e.g. "appointment_start","enrollment","visit_end"; offsetHours negative = before

export type WorkflowStage = {
  key: string;
  name: string;
  action: StageAction;
  /** required for message/call/form. */
  templateId?: string;
  trigger: StageTrigger;
  enabled: boolean;
  /** for action="task". */
  ownerRole?: string;
};

export type Workflow = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  anchor: WorkflowAnchor;
  status: "draft" | "active" | "archived";
  stages: WorkflowStage[];
  createdAt: string;
  updatedAt: string;
};

export type StageRunStatus = "pending" | "scheduled" | "sent" | "done" | "skipped" | "failed";

export type StageRun = {
  stageKey: string;
  status: StageRunStatus;
  dueAt?: string;
  firedAt?: string;
  messageId?: string;
  callId?: string;
  sessionToken?: string;
  formResponse?: Record<string, string>;
  outcome?: string;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  tenantId: string;
  workflowId: string;
  patientId: string;
  anchorType?: "appointment" | "visit";
  anchorId?: string;
  status: "active" | "completed" | "cancelled";
  stageRuns: StageRun[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  /** Stamped when the appointment/visit is completed — the anchor for any
   *  `visit_end`-relative stages (e.g. a revisit reminder N days after the visit). */
  visitEndAt?: string;
};

// ---- Telephony (per-tenant call log) --------------------------------------

export type CallDirection = "outbound" | "inbound";
export type CallStatus = "queued" | "ringing" | "completed" | "missed" | "failed";

/** A telephony call-log row. The seam: dialing is via a provider stub today, so
 *  most rows are logged interactions; providerId is set when a stub call queues. */
export type Call = {
  id: string;
  tenantId: string;
  to: string;
  from?: string;
  direction: CallDirection;
  status: CallStatus;
  leadId?: string;
  patientId?: string;
  disposition?: string;
  notes?: string;
  recordingUrl?: string;
  providerId?: string;
  createdAt: string;
  updatedAt: string;
};

// ---- Leads & data sources (top of funnel) ---------------------------------

/** Default lead-source keys. Tenants may add/remove their own via LeadConfig;
 *  Lead.source is a free string of configured keys, not this closed union. */
export type LeadSource = "camp" | "meta" | "referral" | "form" | "import" | "walk_in";
/** Default funnel-stage keys. Tenants configure their own ordered set via LeadConfig;
 *  Lead.stage is a free string of configured keys, not this closed union. */
export type LeadStage = "new" | "contacted" | "qualified" | "booked" | "converted" | "lost";

/** A tenant-configurable lead source (where a lead came from). */
export type LeadSourceOption = { key: string; label: string };

/** A tenant-configurable funnel stage. The ordered list IS the funnel order. */
export type LeadFunnelStage = { key: string; label: string };

/** Per-tenant CRM funnel configuration. recordId = tenantId (one per tenant). */
export type LeadConfig = {
  tenantId: string;
  /** Where leads come from (order is display order). */
  sources: LeadSourceOption[];
  /** Funnel stages in funnel order (first = entry stage). */
  stages: LeadFunnelStage[];
  createdAt: string;
  updatedAt: string;
};

/** Maps CSV column headers (values) to lead fields (keys) for Google-Sheet import. */
export type LeadSheetMapping = { name?: string; phone?: string; email?: string };

/** Per-tenant Google-Sheet lead ingest config (CRM Phase 3). recordId = tenantId.
 *  The sheet is published to the web as CSV (no OAuth); we fetch + parse that public
 *  URL and create a lead per NEW row, deduped by normalized phone. */
export type LeadSheetConfig = {
  tenantId: string;
  enabled: boolean;
  /** Public "Publish to web → CSV" URL of the Google Sheet. */
  csvUrl?: string;
  mapping: LeadSheetMapping;
  /** Which configured lead source to tag imported leads with (default "import"). */
  sourceKey?: string;
  /** Normalized phones already imported (dedup across syncs). */
  importedKeys: string[];
  lastSyncedAt?: string;
  lastResult?: { imported: number; skipped: number; total: number; error?: string; at: string };
  createdAt: string;
  updatedAt: string;
};

/** A person who entered from marketing/top-of-funnel and may convert into a Patient. */
export type Lead = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  /** A configured LeadSource key (see LeadConfig.sources). */
  source: string;
  /** e.g. campaign/camp name, form title. */
  sourceDetail?: string;
  /** A configured LeadFunnelStage key (see LeadConfig.stages). */
  stage: string;
  /** Staff user id the lead is assigned to. */
  assignedTo?: string;
  branchId?: string;
  /** Captured custom fields (from a form/import). */
  formData?: Record<string, string>;
  notes?: string;
  /** Set once the lead converts into a clinical Patient record. */
  convertedPatientId?: string;
  /** Hint set at creation when the phone matches an existing patient (no auto-convert). */
  matchedPatientId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadFormFieldType = "text" | "phone" | "email" | "number" | "select" | "multiselect" | "textarea";

export type LeadFormField = {
  key: string;
  label: string;
  type: LeadFormFieldType;
  required?: boolean;
  options?: string[];
};

/** A public form (e.g. for a camp) that captures Leads via a tenant-scoped slug. */
export type LeadForm = {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  /** Public, unique-ish within the tenant. */
  slug: string;
  fields: LeadFormField[];
  status: "active" | "inactive";
  branchId?: string;
  submissions: number;
  createdAt: string;
};

// ---- Lead CRM record (notes, callbacks, merged timeline) ------------------

/** A free-text note logged against a lead by a staff member. */
export type LeadNote = {
  id: string;
  tenantId: string;
  leadId: string;
  body: string;
  /** Staff user id who wrote the note (from request context). */
  authorId?: string;
  /** Display name of the author at write time. */
  authorName?: string;
  createdAt: string;
};

export type LeadCallbackChannel = "whatsapp" | "call" | "manual";
export type LeadCallbackStatus = "open" | "done" | "cancelled";

/** A scheduled "call back in N days / on a date" task against a lead. */
export type LeadCallback = {
  id: string;
  tenantId: string;
  leadId: string;
  title: string;
  /** When the callback is due (ISO timestamp). */
  dueAt: string;
  channel: LeadCallbackChannel;
  status: LeadCallbackStatus;
  /** Staff user id the callback is assigned to. */
  assignedTo?: string;
  note?: string;
  createdAt: string;
  /** Set when the callback transitions to "done". */
  completedAt?: string;
};

/** A single entry in a lead's merged activity timeline (newest-first). */
export type LeadTimelineEntry = {
  id: string;
  type:
    | "created"
    | "note"
    | "stage_change"
    | "source_change"
    | "callback_scheduled"
    | "callback_done"
    | "callback_cancelled";
  at: string;
  text: string;
  by?: string;
};

// ---- Campaigns (segmented broadcasts over the channel layer) --------------

export type CampaignChannelType = "transactional" | "marketing";
export type CampaignTrigger = "manual" | "automated";
export type CampaignAutomatedOn = "new_lead" | "appointment_missed" | "opd_done";
export type CampaignStatus = "draft" | "sending" | "sent" | "scheduled";

/** Audience segment for a campaign — leads and/or patients, filtered. */
export type CampaignAudience = {
  include: "leads" | "patients" | "both";
  /** Filter leads by stage (new/contacted/qualified/booked/converted/lost). */
  leadStages?: string[];
  /** Filter leads by source (camp/meta/referral/form/import/walk_in). */
  leadSources?: string[];
  /** Filter patients by computed lifecycle.stage. */
  patientStages?: string[];
  /** Patients having any of these ICD-10 codes (from clinicalRecords). */
  conditionCodes?: string[];
  /** Patients having any of these tags. */
  tags?: string[];
};

/** A segmented broadcast that targets leads+patients and sends via the channel layer. */
export type Campaign = {
  id: string;
  tenantId: string;
  name: string;
  /** Message category (label + WhatsApp category): marketing vs transactional. */
  channelType: CampaignChannelType;
  /** Delivery provider — decoupled from category, so a marketing broadcast can go
   *  via UltraMsg (free text) or AISensy (template). Defaults from channelType. */
  provider?: ChannelProvider;
  audience: CampaignAudience;
  /** transactional: free text; supports {{name}} token. */
  body?: string;
  /** marketing: AISensy campaign/template name. */
  aisensyCampaign?: string;
  /** marketing: positional template params (may include {{name}}). */
  templateParams?: string[];
  trigger: CampaignTrigger;
  /** Recorded only; automated execution is deferred to workflow-worker. */
  automatedOn?: CampaignAutomatedOn;
  status: CampaignStatus;
  stats?: { audienceSize?: number; sent: number; failed: number; lastRunAt?: string };
  createdAt: string;
  updatedAt: string;
};

/** A resolved campaign recipient (de-duplicated by phone). */
export type CampaignRecipient = {
  name: string;
  phone: string;
  kind: "lead" | "patient";
  id: string;
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
    | "follow_up.create"
    | "follow_up.update"
    | "follow_up.remind"
    | "journey.create"
    | "journey.update"
    | "journey.message"
    | "invoice.create"
    | "payment.record"
    | "mobile_link.lookup"
    | "mobile_link.action"
    | "workflow.trigger"
    | "service_webhook.intake"
    | "tenant.create"
    | "tenant.update"
    | "branch.update"
    | "tenant.settings_update"
    | "message.send"
    | "lead.create"
    | "lead.update"
    | "lead.convert"
    | "lead.import"
    | "lead_note.create"
    | "lead_callback.create"
    | "lead_callback.update"
    | "lead_config.update"
    | "lead_sheet.update"
    | "lead_sheet.sync"
    | "form.create"
    | "form.submit"
    | "campaign.create"
    | "campaign.update"
    | "campaign.send"
    | "template.create"
    | "template.update"
    | "template.delete"
    | "workflow.create"
    | "workflow.update"
    | "workflow.delete"
    | "call.create"
    | "call.update"
    | "visit.register"
    | "visit.update"
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
  /** Set when the appointment was moved to a new slot — who initiated the move. */
  rescheduledBy?: "staff" | "patient";
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
  /** Optional link to the OPD visit (encounter) this document belongs to. */
  visitId?: string;
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

// ---- OPD walk-in Visit (encounter) ----------------------------------------

export type VisitType = "walk_in" | "appointment";
export type VisitStatus = "registered" | "in_consult" | "completed" | "left_without_seen";

/** Vitals captured at OPD intake (eye-first product → visual acuity + IOP). */
export type VisitVitals = {
  bp?: string;
  pulseBpm?: number;
  spo2?: number;
  tempC?: number;
  weightKg?: number;
  heightCm?: number;
  // eye-specific:
  visualAcuityOD?: string;
  visualAcuityOS?: string;
  iopOD?: number;
  iopOS?: number;
};

export type VisitDisposition = {
  outcome: string;
  notes?: string;
  nextStep?: string;
  nextActionDate?: string;
};

/** An OPD encounter — a walk-in (or appointment-backed) clinical visit. */
export type Visit = {
  id: string;
  tenantId: string;
  patientId: string;
  branchId?: string;
  visitType: VisitType;
  appointmentId?: string;
  doctorId?: string;
  doctorName?: string;
  /** Specialty / queue the visit belongs to. */
  department?: string;
  status: VisitStatus;
  // intake (captured at registration):
  chiefComplaint: string;
  intakeConditions?: ClinicalCondition[];
  intakeAllergies?: string[];
  vitals?: VisitVitals;
  intakeNotes?: string;
  registeredBy?: string;
  registeredAt: string;
  // post-consult:
  diagnosis?: ClinicalCondition[];
  disposition?: VisitDisposition;
  consultNotes?: string;
  consultedBy?: string;
  consultedAt?: string;
  createdAt: string;
  updatedAt: string;
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

export type InvoiceStatus = "unpaid" | "partial" | "paid";

export type InvoiceLineItem = {
  description: string;
  amount: number;
};

export type InvoicePayment = {
  amount: number;
  method?: string;
  at: string;
  note?: string;
};

export type Invoice = {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  items: InvoiceLineItem[];
  currency: "INR";
  /** Sum of item amounts. */
  total: number;
  /** Running total settled across payments. */
  amountSettled: number;
  status: InvoiceStatus;
  payments: InvoicePayment[];
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
  type: "created" | "started" | "task_created" | "task_updated" | "follow_up_confirmed" | "message_sent" | "workflow_callback" | "note" | "completed";
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
