export type IdentityStatus = "unverified" | "suggested_match" | "verified" | "conflict";
export type Priority = "urgent" | "high" | "medium" | "low";
export type InteractionChannel = "whatsapp" | "call" | "missed_call" | "web" | "referral" | "walk_in" | "staff_note";
export type InteractionDirection = "inbound" | "outbound" | "internal";
export type InteractionStatus = "new" | "triaged" | "linked" | "closed";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskSource = "healthcareos";
export type AppointmentStatus = "scheduled" | "confirmed" | "rescheduled" | "completed" | "no_show" | "cancelled";
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
export type ActorType = "staff" | "service" | "patient_link";
export type Role =
  | "front_desk"
  | "call_center"
  | "care_coordinator"
  | "nurse"
  | "doctor"
  | "admin"
  | "org_admin"
  | "integration_service"
  | "workflow_service";
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
  | "access_requests:read"
  | "access_requests:update"
  | "mobile_links:use"
  | "documents:create"
  | "followups:confirm"
  | "journeys:read"
  | "journeys:update"
  | "audit:read"
  | "service_events:ingest";

export type Organization = {
  id: string;
  displayName: string;
  status: "active" | "inactive";
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

export type User = {
  id: string;
  tenantId: string;
  displayName: string;
  email?: string;
  roles: Role[];
  branchIds: string[];
  status: "active" | "inactive";
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

export type RequestContext = {
  actorType: ActorType;
  tenantId: string;
  actorId: string;
  displayName: string;
  roles: Role[];
  branchIds: string[];
  permissions: Permission[];
  isDemoMode: boolean;
  source: "staff_session" | "demo_headers" | "service_api_key" | "mobile_link" | "system_default";
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
    | "document_metadata.create"
    | "follow_up.confirm"
    | "journey.create"
    | "journey.update"
    | "mobile_link.lookup"
    | "mobile_link.action"
    | "workflow.trigger"
    | "service_webhook.intake";
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

export type Appointment = {
  id: string;
  tenantId: string;
  patientId: string;
  doctorName: string;
  specialty: string;
  branchId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  reason: string;
  confirmation?: {
    confirmedAt: string;
    confirmedBy: "patient" | "caregiver" | "staff";
    notes?: string;
  };
  noShowRisk?: Priority;
  createdAt: string;
  updatedAt: string;
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
