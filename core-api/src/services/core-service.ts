import { randomUUID } from "node:crypto";
import { DEMO_STAFF_USER_ID, DEMO_TENANT_ID, type SeedData } from "../domain/seed.js";
import { hasPermission, permissionsForRoles } from "../auth/permissions.js";
import { bearerTokenFromAuthorization, createStaffSessionToken, verifyStaffSessionToken, type SessionScope } from "../auth/staff-session.js";
import { hashPassword, verifyPassword, generateTempPassword, generateNumericCode } from "../auth/passwords.js";
import {
  createEmailService,
  otpEmail,
  passwordResetEmail,
  inviteEmail,
  type EmailService,
  type OutboxEntry
} from "../integrations/email.js";
import { sendUltraMsg } from "../integrations/channels/ultramsg.js";
import { sendAiSensy } from "../integrations/channels/aisensy.js";
import { placeCall } from "../integrations/channels/telephony.js";
import { createStorageService, type StorageService } from "../integrations/storage.js";
import { OPHTHALMOLOGY_CONDITION_CATALOG } from "../domain/clinical-catalog.js";
import type {
  AccessRequest,
  Appointment,
  AppointmentDisposition,
  AppointmentStatus,
  AuditEvent,
  Call,
  CallDirection,
  CallStatus,
  Campaign,
  CampaignAudience,
  CampaignAutomatedOn,
  CampaignChannelType,
  CampaignRecipient,
  CampaignSchedule,
  CampaignStatus,
  CampaignTrigger,
  Caregiver,
  ClinicalCondition,
  ClinicalRecord,
  Doctor,
  DoctorWorkingWindow,
  DocumentMetadata,
  DocumentType,
  FollowUp,
  Household,
  HouseholdCaregiverPermission,
  Interaction,
  InteractionChannel,
  InteractionDirection,
  Invoice,
  InvoiceLineItem,
  JourneyEvent,
  JourneyTask,
  JourneyTaskStatus,
  JourneyTemplate,
  Lead,
  LeadCallback,
  LeadCallbackChannel,
  LeadConfig,
  LeadIntake,
  LeadSheetConfig,
  LeadSheetMapping,
  LeadForm,
  LeadFormField,
  LeadNote,
  LeadTimelineEntry,
  LeadFunnelStage,
  LeadSourceOption,
  MobileLinkSession,
  PatientJourney,
  PatientJourneyStatus,
  Organization,
  Branch,
  User,
  PlatformAdmin,
  LoginChallenge,
  PasswordResetToken,
  PrincipalType,
  AuthCredentials,
  TenantChannelConfig,
  MessageLog,
  ChannelProvider,
  MessageType,
  Patient,
  PatientSummary,
  Permission,
  Priority,
  RequestContext,
  Role,
  TaskStatus,
  TenantType,
  TimelineEvent,
  Visit,
  VisitDisposition,
  VisitStatus,
  VisitType,
  VisitVitals,
  WorkbenchTask,
  WorkbenchTaskView,
  CommTemplate,
  TemplateChannel,
  TemplateKind,
  Workflow,
  WorkflowAnchor,
  WorkflowStage,
  WorkflowRun,
  StageRun,
  StageRunStatus,
  StageAction,
  StageTrigger
} from "../domain/types.js";
import {
  MODULE_CATALOG,
  PLAN_CATALOG,
  DEFAULT_PLAN_ID,
  isPlanId,
  resolveEnabledModules,
  resolveSeatLimit,
  type ModuleKey,
  type PlanId
} from "../domain/platform.js";
import { createPersistence, type CorePersistence } from "../persistence/index.js";
import { createOutboundClients, type OutboundClients } from "../integrations/outbound-clients.js";

/** Sentinel tenant id for platform-tier actors that operate across all tenants. */
export const PLATFORM_SCOPE = "*";

type CreatePatientInput = {
  householdId?: string;
  displayName?: string;
  age?: number;
  gender?: Patient["gender"];
  primaryPhone?: string;
  preferredLanguage?: string;
  branchId?: string;
  tags?: string[];
};

type CreateStaffSessionInput = {
  tenantId?: string;
  userId?: string;
  expiresInSeconds?: number;
};

type CreateInteractionInput = {
  patientId?: string;
  channel?: InteractionChannel;
  direction?: InteractionDirection;
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
  language?: string;
  intent?: string;
  urgency?: Priority;
  createTask?: boolean;
};

type CreateAppointmentInput = {
  patientId?: string;
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  branchId?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  reason?: string;
};

type BookAppointmentInput = {
  patientId?: string;
  /** Phone-first booking: when no patientId, create the patient from these. */
  patient?: { name?: string; phone?: string; gender?: Patient["gender"]; age?: number };
  doctorId?: string;
  branchId?: string;
  scheduledAt?: string;
  reason?: string;
};

type UpdateTaskInput = {
  status?: TaskStatus;
  ownerRole?: WorkbenchTask["ownerRole"];
  outcome?: string;
};

type AssignInteractionInput = {
  ownerRole?: WorkbenchTask["ownerRole"];
  assignedToUserId?: string;
  createTask?: boolean;
};

type UpdateInteractionInput = {
  status?: Interaction["status"];
  patientId?: string;
  linkedResourceId?: string;
};

type AddThreadNoteInput = {
  body?: string;
  visibility?: "internal" | "patient_visible";
};

type UpsertDraftInput = {
  draftId?: string;
  channel?: InteractionChannel;
  body?: string;
  status?: "draft" | "ready_to_send" | "sent" | "discarded";
};

type IdentitySearchInput = {
  query?: string;
  phone?: string;
  uhid?: string;
  abhaId?: string;
};

type ResolveIdentityInput = {
  patientId?: string;
  interactionId?: string;
  identityStatus?: Patient["identityStatus"];
  householdId?: string;
};

type UpdateHouseholdLinkInput = {
  householdId?: string;
  displayName?: string;
  relationship?: string;
  primaryContact?: boolean;
};

type UpsertCaregiverInput = {
  caregiverId?: string;
  caregiverName?: string;
  displayName?: string;
  relationship?: string;
  phone?: string;
  consentStatus?: HouseholdCaregiverPermission["consentStatus"];
  permissions?: HouseholdCaregiverPermission["permissions"];
};

type CreateAccessRequestInput = {
  patientId?: string;
  interactionId?: string;
  requesterName?: string;
  requesterPhone?: string;
  requestedSpecialty?: string;
  requestedBranchId?: string;
  reason?: string;
  priority?: Priority;
};

type OfferAccessSlotInput = {
  doctorName?: string;
  specialty?: string;
  branchId?: string;
  scheduledAt?: string;
  holdMinutes?: number;
};

type BookAccessRequestInput = {
  doctorName?: string;
  specialty?: string;
  branchId?: string;
  scheduledAt?: string;
  reason?: string;
};

type SendMobileLinkInput = {
  expiresInHours?: number;
};

type RescheduleAccessRequestInput = {
  reason?: string;
  scheduledAt?: string;
  doctorName?: string;
};

type CreateJourneyTemplateInput = {
  name?: string;
  condition?: string;
  defaultOwnerRole?: WorkbenchTask["ownerRole"];
  steps?: JourneyTemplate["steps"];
};

type CreatePatientJourneyInput = {
  patientId?: string;
  templateId?: string;
  title?: string;
  ownerRole?: WorkbenchTask["ownerRole"];
  start?: boolean;
};

type UpdatePatientJourneyInput = {
  status?: PatientJourneyStatus;
  outcome?: string;
};

type CreateJourneyTaskInput = {
  title?: string;
  dueAt?: string;
  ownerRole?: WorkbenchTask["ownerRole"];
  instructions?: string;
  createFollowUp?: boolean;
};

type UpdateJourneyTaskInput = {
  status?: JourneyTaskStatus;
  outcome?: string;
};

type CreateJourneyEventInput = {
  type?: JourneyEvent["type"];
  payload?: Record<string, unknown>;
};

type JourneySendMessageInput = {
  body?: string;
};

type CreateFollowUpInput = {
  patientId?: string;
  title?: string;
  dueAt?: string;
  instructions?: string;
  journeyId?: string;
};

type UpdateFollowUpInput = {
  status?: FollowUp["status"];
  dueAt?: string;
  instructions?: string;
};

type CreateInvoiceInput = {
  patientId?: string;
  appointmentId?: string;
  items?: unknown;
};

type RecordPaymentInput = {
  amount?: unknown;
  method?: string;
  note?: string;
};

type DispositionInput = {
  outcome?: string;
  notes?: string;
  nextStep?: string;
  nextActionDate?: string;
};

type UpdateAppointmentInput = {
  status?: Appointment["status"];
  outcome?: string;
  disposition?: DispositionInput;
};

type SetClinicalRecordInput = {
  conditions?: unknown;
  allergies?: unknown;
  notes?: unknown;
};

type DocumentUploadUrlInput = {
  filename?: string;
  contentType?: string;
  type?: DocumentType;
};

type RecordDocumentInput = {
  key?: string;
  filename?: string;
  contentType?: string;
  type?: DocumentType;
};

type ConfirmAppointmentInput = {
  confirmedBy?: "patient" | "caregiver" | "staff";
  notes?: string;
};

type CreateDocumentMetadataInput = {
  appointmentId?: string;
  visitId?: string;
  documentType?: DocumentMetadata["documentType"];
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  notes?: string;
};

type ConfirmFollowUpInput = {
  patientResponse?: string;
};

type RequestRescheduleInput = {
  reason?: string;
};

type UpdateChecklistInput = {
  completed?: boolean;
};

type UpdateConsentInput = {
  channel?: "whatsApp" | "calls" | "aiProcessing" | "documentSharing";
  enabled?: boolean;
};

type OptOutInput = {
  scope?: string;
};

type TriggerWorkflowInput = {
  workflowType?: "appointment-reminder" | "no-show-recovery" | "post-visit-follow-up" | "pending-diagnostics-reminder" | "sla-timer";
  patientId?: string;
  appointmentId?: string;
  followUpId?: string;
  taskId?: string;
  trigger?: string;
};

type CreateLeadInput = {
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  intake?: string;
  sourceDetail?: string;
  stage?: string;
  assignedTo?: string;
  branchId?: string;
  formData?: Record<string, string>;
  notes?: string;
};

type UpdateLeadInput = {
  name?: string;
  phone?: string;
  email?: string;
  stage?: string;
  source?: string;
  assignedTo?: string | null;
  branchId?: string;
  notes?: string;
  sourceDetail?: string;
};

type LeadConfigInput = {
  sources?: unknown;
  stages?: unknown;
};

type LeadSheetConfigInput = {
  enabled?: unknown;
  csvUrl?: unknown;
  mapping?: unknown;
  sourceKey?: unknown;
};

type ConvertLeadInput = {
  patientId?: string;
};

type ImportLeadsInput = {
  source?: string;
  rows?: Array<Record<string, unknown>>;
  mapping?: { name?: string; phone?: string; email?: string };
};

type CreateLeadNoteInput = {
  body?: string;
};

type CreateLeadCallbackInput = {
  title?: string;
  dueAt?: string;
  channel?: string;
  assignedTo?: string;
  note?: string;
};

type UpdateLeadCallbackInput = {
  status?: string;
  title?: string;
  dueAt?: string;
  channel?: string;
  assignedTo?: string | null;
  note?: string;
};

type CreateFormInput = {
  title?: string;
  description?: string;
  fields?: unknown;
  status?: string;
  branchId?: string;
  source?: string;
};

type UpdateFormInput = {
  title?: string;
  description?: string;
  fields?: unknown;
  status?: string;
  branchId?: string;
  source?: string;
};

type PublicFormSubmitInput = {
  values?: Record<string, unknown>;
};

type CampaignAudienceInput = {
  include?: unknown;
  leadStages?: unknown;
  leadSources?: unknown;
  patientStages?: unknown;
  conditionCodes?: unknown;
  tags?: unknown;
};

type UpsertCampaignInput = {
  name?: unknown;
  channelType?: unknown;
  provider?: unknown;
  audience?: unknown;
  body?: unknown;
  aisensyCampaign?: unknown;
  templateParams?: unknown;
  trigger?: unknown;
  automatedOn?: unknown;
  sendOncePerContact?: unknown;
  schedule?: unknown;
  status?: unknown;
};

type UpsertTemplateInput = {
  name?: unknown;
  channel?: unknown;
  kind?: unknown;
  body?: unknown;
  formId?: unknown;
  status?: unknown;
};

type UpsertWorkflowInput = {
  name?: unknown;
  description?: unknown;
  anchor?: unknown;
  status?: unknown;
  stages?: unknown;
};

type CreateVisitInput = {
  // existing patient OR new-patient fields:
  patientId?: string;
  name?: string;
  age?: number;
  gender?: Patient["gender"];
  phone?: string;
  branchId?: string;
  // visit fields:
  chiefComplaint?: string;
  visitType?: string;
  doctorId?: string;
  /** Explicitly link this walk-in to an existing appointment (chosen at registration). */
  appointmentId?: string;
  department?: string;
  intakeConditions?: unknown;
  intakeAllergies?: unknown;
  vitals?: unknown;
  intakeNotes?: string;
};

type UpdateVisitInput = {
  status?: string;
  doctorId?: string;
  /** Reason for visit — fillable during the encounter if skipped at registration. */
  chiefComplaint?: string;
  vitals?: unknown;
  diagnosis?: unknown;
  disposition?: unknown;
  consultNotes?: string;
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

const asPriority = (value: unknown, fallback: Priority = "medium"): Priority => {
  if (value === "urgent" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return fallback;
};

const ensureString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `Missing required field: ${field}`);
  }
  return value.trim();
};

const sanitizeSlotMinutes = (value: unknown): number => {
  const minutes = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 15;
  }
  return Math.min(Math.max(Math.round(minutes), 5), 240);
};

/** "HH:MM" → minutes-since-midnight, or null if malformed/out of range. */
const parseHhMm = (value: unknown): number | null => {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

const isoFromDateAndMinutes = (dateISO: string, minutes: number): string => {
  const base = new Date(`${dateISO}T00:00:00.000Z`).getTime();
  return new Date(base + minutes * 60_000).toISOString();
};

/** Coerce arbitrary input into a validated weekly availability map (day 0..6 → windows). */
const sanitizeWeeklyHours = (value: unknown): Record<number, DoctorWorkingWindow[]> => {
  const result: Record<number, DoctorWorkingWindow[]> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }
  for (const [rawDay, rawWindows] of Object.entries(value as Record<string, unknown>)) {
    const day = Number.parseInt(rawDay, 10);
    if (!Number.isInteger(day) || day < 0 || day > 6 || !Array.isArray(rawWindows)) {
      continue;
    }
    const windows: DoctorWorkingWindow[] = [];
    for (const entry of rawWindows) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const candidate = entry as Record<string, unknown>;
      const start = parseHhMm(candidate.start);
      const end = parseHhMm(candidate.end);
      if (start === null || end === null || end <= start) {
        continue;
      }
      windows.push({
        start: typeof candidate.start === "string" ? candidate.start.trim() : "",
        end: typeof candidate.end === "string" ? candidate.end.trim() : "",
        ...(typeof candidate.branchId === "string" && candidate.branchId.length > 0
          ? { branchId: candidate.branchId }
          : {})
      });
    }
    if (windows.length > 0) {
      result[day] = windows;
    }
  }
  return result;
};

const validModuleKeys = new Set<ModuleKey>(MODULE_CATALOG.map((module) => module.key));

const sanitizeModuleOverrides = (value: unknown): Partial<Record<ModuleKey, boolean>> | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const overrides: Partial<Record<ModuleKey, boolean>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (validModuleKeys.has(key as ModuleKey) && typeof raw === "boolean") {
      overrides[key as ModuleKey] = raw;
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

/** Default CRM funnel config, used to lazy-provision a tenant that has none. The
 *  source/stage keys here are the platform defaults (LeadSource / LeadStage unions). */
// Marketing/attribution sources ONLY — how a lead is classified for campaigns &
// ROI, NOT how it was imported (form/excel/sheet = intake mechanism, see LeadIntake).
const DEFAULT_LEAD_SOURCES: LeadSourceOption[] = [
  { key: "meta_ads", label: "Meta Ads" },
  { key: "google_ads", label: "Google Ads" },
  { key: "doctor_referral", label: "Doctor Referral" },
  { key: "camp_self", label: "Camp – Self" },
  { key: "camp_outsourced", label: "Camp – Outsourced" },
  { key: "walk_in", label: "Walk-in" },
  { key: "website", label: "Website" }
];

// The legacy default that mixed marketing sources with import mechanisms. A tenant
// whose sources still EXACTLY match this never curated them, so it's safe to
// auto-upgrade them to the clean marketing-only defaults above.
const LEGACY_DEFAULT_SOURCE_KEYS = ["camp", "meta", "referral", "form", "walk_in", "import"];

const validLeadIntake = (value: unknown): LeadIntake | undefined => {
  const allowed: LeadIntake[] = ["manual", "web_form", "excel_import", "google_sheet", "walk_in", "api"];
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as LeadIntake) : undefined;
};
const DEFAULT_LEAD_STAGES: LeadFunnelStage[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "booked", label: "Booked" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Lost" }
];
const LEAD_FIELD_TYPES = new Set<LeadFormField["type"]>(["text", "phone", "email", "number", "select", "multiselect", "textarea"]);
const LEAD_CALLBACK_CHANNELS = new Set<LeadCallbackChannel>(["whatsapp", "call", "manual"]);

const CAMPAIGN_AUTOMATED_ON: CampaignAutomatedOn[] = ["new_lead", "appointment_missed", "opd_done"];
const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "sending", "sent", "scheduled"];

const TEMPLATE_CHANNELS = new Set<TemplateChannel>(["whatsapp", "call_script"]);
const TEMPLATE_KINDS = new Set<TemplateKind>(["text", "form"]);
const WORKFLOW_ANCHORS = new Set<WorkflowAnchor>(["appointment", "visit", "manual"]);
const STAGE_ACTIONS = new Set<StageAction>(["message", "call", "form", "task"]);
/** Stage actions that must reference an existing active template. */
const TEMPLATE_BACKED_ACTIONS = new Set<StageAction>(["message", "call", "form"]);

/** Coerce arbitrary input into a validated StageTrigger, or throw. */
const sanitizeStageTrigger = (value: unknown, stageKey: string): StageTrigger => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, `Stage "${stageKey}" is missing a valid trigger`);
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "on_enroll") {
    return { type: "on_enroll" };
  }
  if (candidate.type === "on_event") {
    const event = ensureString(candidate.event, `stage "${stageKey}" trigger.event`);
    return { type: "on_event", event };
  }
  if (candidate.type === "relative") {
    const anchorEvent = ensureString(candidate.anchorEvent, `stage "${stageKey}" trigger.anchorEvent`);
    const offsetHours = typeof candidate.offsetHours === "number" ? candidate.offsetHours : Number(candidate.offsetHours);
    if (!Number.isFinite(offsetHours)) {
      throw new ApiError(400, `Stage "${stageKey}" relative trigger needs a numeric offsetHours`);
    }
    return { type: "relative", anchorEvent, offsetHours };
  }
  throw new ApiError(400, `Stage "${stageKey}" has an unknown trigger type`);
};

/** Coerce an arbitrary value into a clean string[] (trimmed, non-empty), or undefined. */
const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const list = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim());
  return list.length > 0 ? list : undefined;
};

/** First word of a display name (falls back to "there"). */
const firstName = (name: string): string => name.trim().split(/\s+/)[0] || "there";

/**
 * Default appointment-lifecycle message bodies — the verbatim bodies the retired
 * fixed notification path used, now cloned per-tenant by the workflow runtime's
 * lazy default provisioning so every tenant keeps parity. Tokens supported:
 * {{patientName}} {{doctorName}} {{date}} {{time}} {{branch}} {{mapLink}} {{confirmLink}}.
 */
const NOTIFICATION_DEFAULTS = {
  booked: {
    body:
      "Hi {{patientName}}, your appointment with {{doctorName}} is booked for {{date}} at {{time}} at {{branch}}. Tap to confirm: {{confirmLink}}"
  },
  reminder24h: {
    body: "Reminder, {{patientName}}: your appointment with {{doctorName}} is on {{date}} at {{time}}. Confirm: {{confirmLink}}"
  },
  reminder3h: {
    body: "Hi {{patientName}}, your appointment with {{doctorName}} is coming up at {{time}}. See you at {{branch}}."
  },
  cancelled: {
    body: "Hi {{patientName}}, your appointment with {{doctorName}} on {{date}} at {{time}} has been cancelled. Call us to rebook."
  },
  rescheduled: {
    body:
      "Hi {{patientName}}, your appointment with {{doctorName}} is rescheduled to {{date}} at {{time}} at {{branch}}. {{mapLink}}"
  }
} as const;

/**
 * Minimal, dependency-free RFC-4180-ish CSV parser. Returns a 2D array of cell
 * strings (rows × columns). Handles quoted fields, embedded commas/quotes (""),
 * embedded newlines inside quotes, and CRLF/CR/LF line endings. A trailing blank
 * line is dropped. Pure (no I/O) so it's unit-testable without a live fetch.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Treat CRLF and lone CR as one line break.
      pushRow();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush the final field/row unless the input ended exactly on a line break with
  // nothing buffered (avoids a trailing empty row from a terminal newline).
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
};

/** True when `value` parses as an absolute http(s) URL. */
const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** Normalise an incoming lead-sheet column mapping to {name?,phone?,email?} of
 *  trimmed non-empty CSV header strings. */
const sanitizeSheetMapping = (value: unknown): LeadSheetMapping => {
  const record = isPlainRecord(value) ? value : {};
  const pick = (key: "name" | "phone" | "email"): string | undefined => {
    const raw = record[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  return { name: pick("name"), phone: pick("phone"), email: pick("email") };
};

/** Slugify a key candidate the same way the rest of the platform does. */
const slugifyKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Resolve a lead source against a tenant's configured source keys, falling back
 *  to "import" if configured, else the first configured key. */
const sanitizeLeadSource = (value: unknown, sources: LeadSourceOption[], fallback?: string): string => {
  const keys = sources.map((s) => s.key);
  if (typeof value === "string" && keys.includes(value)) {
    return value;
  }
  if (fallback && keys.includes(fallback)) {
    return fallback;
  }
  return keys.includes("import") ? "import" : keys[0] ?? "import";
};

/** Resolve a lead stage against a tenant's configured stage keys, falling back to
 *  the supplied fallback (when configured), else "new" if present, else the first stage. */
const sanitizeLeadStage = (value: unknown, stages: LeadFunnelStage[], fallback?: string): string => {
  const keys = stages.map((s) => s.key);
  if (typeof value === "string" && keys.includes(value)) {
    return value;
  }
  if (fallback && keys.includes(fallback)) {
    return fallback;
  }
  return keys.includes("new") ? "new" : keys[0] ?? "new";
};

/** Sort lead callbacks: open first (most overdue = earliest dueAt first), then the
 *  rest (done/cancelled) by most recent dueAt. */
const compareCallbacks = (a: LeadCallback, b: LeadCallback): number => {
  const aOpen = a.status === "open";
  const bOpen = b.status === "open";
  if (aOpen !== bOpen) {
    return aOpen ? -1 : 1;
  }
  if (aOpen) {
    return a.dueAt.localeCompare(b.dueAt);
  }
  return b.dueAt.localeCompare(a.dueAt);
};

/** Coerce an arbitrary object into a flat Record<string,string> (drops non-stringish values). */
const sanitizeStringMap = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") {
      result[key] = raw;
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      result[key] = String(raw);
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const sanitizeFormFields = (value: unknown): LeadFormField[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const fields: LeadFormField[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    if (!key || !label) {
      continue;
    }
    const type = LEAD_FIELD_TYPES.has(candidate.type as LeadFormField["type"])
      ? (candidate.type as LeadFormField["type"])
      : "text";
    const field: LeadFormField = { key, label, type };
    if (candidate.required === true) {
      field.required = true;
    }
    if (Array.isArray(candidate.options)) {
      const options = candidate.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0);
      if (options.length > 0) {
        field.options = options;
      }
    }
    fields.push(field);
  }
  return fields;
};

const staffPriority = (priority: Priority): "critical" | "high" | "medium" | "low" =>
  priority === "urgent" ? "critical" : priority;

const formatRoleLabel = (role: string) =>
  role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const patientName = (patients: Patient[], patientId?: string) =>
  patients.find((patient) => patient.id === patientId)?.displayName ?? "Unlinked patient";

const staffChannel = (channel: InteractionChannel): "WhatsApp" | "Call" | "Web" | "Walk-in" | "Referral" => {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "call" || channel === "missed_call") return "Call";
  if (channel === "web") return "Web";
  if (channel === "walk_in") return "Walk-in";
  return "Referral";
};

const staffInteractionStatus = (status: Interaction["status"]): "new" | "waiting" | "assigned" | "escalated" => {
  if (status === "new") return "new";
  if (status === "triaged" || status === "linked") return "assigned";
  return "waiting";
};

const formatAge = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
};

const formatDue = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return minutes >= 0 ? `${Math.max(1, minutes)} min` : `Overdue ${Math.abs(minutes)} min`;
  const hours = Math.round(Math.abs(minutes) / 60);
  if (Math.abs(minutes) < 24 * 60) return minutes >= 0 ? `${hours}h` : `Overdue ${hours}h`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  );
};

const maskPhone = (phone?: string) => {
  if (!phone || phone.length < 4) return "Not shared";
  return `${phone.slice(0, 3)}xxxx${phone.slice(-4)}`;
};

const normalizePhone = (phone?: string) => phone?.replace(/\D/g, "").slice(-10);

const ensureRecordArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const emptyPatientSummary = () => ({
  id: "none",
  name: "No visible patient",
  age: 0,
  gender: "unknown",
  phone: "Not shared",
  caregiver: "None",
  language: "Not set",
  branch: "No branch",
  doctor: "Care team",
  condition: "No active journey",
  risk: "low" as const,
  nextBestAction: "No visible patient records for this role.",
  openItems: [],
  household: undefined,
  timeline: []
});

const integrationEventType = (input: Record<string, unknown>): string => {
  if (typeof input.type === "string" && input.type.trim()) {
    return input.type.trim();
  }

  if (typeof input.eventType === "string" && input.eventType.trim()) {
    return input.eventType.trim();
  }

  if (typeof input.adapter === "string" && input.adapter.trim()) {
    return `${input.adapter}.event`;
  }

  return "integration.event";
};

export const createCoreService = async (): Promise<CoreService> => {
  const persistence = createPersistence();
  const data = await persistence.load();
  return new CoreService(data, persistence, createOutboundClients());
};

export class CoreService {
  constructor(
    private readonly data: SeedData,
    private readonly persistence: CorePersistence,
    private readonly outbound: OutboundClients,
    private readonly email: EmailService = createEmailService(),
    private readonly storage: StorageService = createStorageService()
  ) {}

  health() {
    return {
      service: "core-api",
      status: "ok",
      mode: this.persistence.mode,
      workflowWorkerConfigured: this.outbound.workflow.isConfigured,
      checkedAt: nowIso()
    };
  }

  authenticate(headers: Record<string, string | undefined>, mobileLinkToken?: string): RequestContext {
    if (mobileLinkToken) {
      const session = this.ensureSession(mobileLinkToken);
      return {
        actorType: "patient_link",
        tenantId: session.tenantId,
        actorId: `mobile_link:${session.token}`,
        displayName: "Patient mobile link",
        roles: [],
        branchIds: [],
        permissions: ["mobile_links:use", "appointments:confirm", "documents:create", "followups:confirm"],
        isDemoMode: false,
        source: "mobile_link"
      };
    }

    const platformApiKey = headers["x-platform-api-key"];
    const envPlatformKey = process.env.PLATFORM_API_KEY ?? "platform_demo_key";
    if (platformApiKey) {
      if (platformApiKey !== envPlatformKey) {
        throw new ApiError(401, "Invalid platform API key");
      }
      const roles: Role[] = ["platform_admin"];
      return {
        actorType: "platform",
        tenantId: PLATFORM_SCOPE,
        actorId: "platform_admin",
        displayName: "HealthOS platform admin",
        roles,
        branchIds: [],
        permissions: permissionsForRoles(roles),
        isDemoMode: process.env.PLATFORM_API_KEY ? false : true,
        source: "platform_api_key"
      };
    }

    const serviceApiKey = headers["x-service-api-key"];
    const envServiceKey = process.env.CORE_API_SERVICE_KEY;
    const matchedApiKey = serviceApiKey
      ? this.data.apiKeys.find((entry) => entry.key === serviceApiKey && entry.status === "active")
      : undefined;
    if (matchedApiKey) {
      const roles = [matchedApiKey.role];
      return {
        actorType: "service",
        tenantId: matchedApiKey.tenantId,
        actorId: matchedApiKey.id,
        displayName: matchedApiKey.displayName,
        roles,
        branchIds: [],
        permissions: permissionsForRoles(roles),
        isDemoMode: false,
        source: "service_api_key"
      };
    }

    if (serviceApiKey && envServiceKey && serviceApiKey === envServiceKey) {
      const tenantId = headers["x-demo-tenant-id"] ?? DEMO_TENANT_ID;
      const roles: Role[] = ["integration_service"];
      return {
        actorType: "service",
        tenantId,
        actorId: "service_env_key",
        displayName: "Environment service key",
        roles,
        branchIds: [],
        permissions: permissionsForRoles(roles),
        isDemoMode: false,
        source: "service_api_key"
      };
    }

    const bearerToken = bearerTokenFromAuthorization(headers.authorization);
    if (bearerToken) {
      const secret = this.sessionSecret();

      let session;
      try {
        session = verifyStaffSessionToken(bearerToken, secret);
      } catch {
        throw new ApiError(401, "Invalid or expired session");
      }

      if (session.scope === "platform") {
        const admin = this.data.platformAdmins.find((entry) => entry.id === session.userId);
        if (!admin || admin.status !== "active") {
          throw new ApiError(401, "Platform session admin was not found");
        }
        if (session.credentialVersion !== admin.credentialVersion) {
          throw new ApiError(401, "Session has been revoked. Sign in again.");
        }
        return {
          actorType: "platform",
          tenantId: PLATFORM_SCOPE,
          actorId: admin.id,
          displayName: admin.displayName,
          roles: admin.roles,
          branchIds: [],
          permissions: permissionsForRoles(admin.roles),
          isDemoMode: false,
          source: "platform_session",
          sessionId: session.sessionId
        };
      }

      const user = this.data.users.find((entry) => entry.id === session.userId && entry.tenantId === session.tenantId);
      if (!user || user.status !== "active") {
        throw new ApiError(401, "Session user was not found or is inactive");
      }
      if (session.credentialVersion !== user.credentialVersion) {
        throw new ApiError(401, "Session has been revoked. Sign in again.");
      }

      return {
        actorType: "staff",
        tenantId: user.tenantId,
        actorId: user.id,
        displayName: user.displayName,
        roles: user.roles,
        branchIds: user.branchIds,
        permissions: permissionsForRoles(user.roles),
        isDemoMode: false,
        source: "staff_session",
        sessionId: session.sessionId
      };
    }

    const allowDemoFallback = process.env.ALLOW_DEMO_AUTH_FALLBACK === "true";
    const tenantId = headers["x-demo-tenant-id"] ?? (allowDemoFallback ? process.env.DEMO_TENANT_ID ?? DEMO_TENANT_ID : undefined);
    const userId = headers["x-demo-user-id"] ?? (allowDemoFallback ? process.env.DEMO_USER_ID ?? DEMO_STAFF_USER_ID : undefined);
    if (!tenantId || !userId) {
      throw new ApiError(401, "Authentication headers are required");
    }
    const user = this.data.users.find((entry) => entry.id === userId && entry.tenantId === tenantId && entry.status === "active");
    if (!user) {
      throw new ApiError(401, "Demo user or tenant was not found");
    }

    return {
      actorType: "staff",
      tenantId: user.tenantId,
      actorId: user.id,
      displayName: user.displayName,
      roles: user.roles,
      branchIds: user.branchIds,
      permissions: permissionsForRoles(user.roles),
      isDemoMode: true,
      source: headers["x-demo-user-id"] || headers["x-demo-tenant-id"] ? "demo_headers" : "system_default"
    };
  }

  ensurePermission(context: RequestContext, permission: Permission) {
    if (!hasPermission(context, permission)) {
      throw new ApiError(403, `Missing permission: ${permission}`);
    }
  }

  /**
   * Entitlement guard: staff actors may only reach a module their tenant's plan
   * (plus overrides) enables. Platform/service/patient-link actors are not
   * module-gated (they operate outside the per-hospital module model).
   */
  ensureModuleEnabled(context: RequestContext, module: ModuleKey) {
    if (context.actorType !== "staff") {
      return;
    }
    const tenant = this.data.organizations.find((entry) => entry.id === context.tenantId);
    const enabled = tenant
      ? resolveEnabledModules(tenant.planId, tenant.moduleOverrides)
      : MODULE_CATALOG.map((entry) => entry.key);
    if (!enabled.includes(module)) {
      throw new ApiError(403, `Module not enabled for this tenant: ${module}`);
    }
  }

  getCurrentUser(context: RequestContext) {
    const tenant = this.data.organizations.find((entry) => entry.id === context.tenantId);
    const enabledModules: ModuleKey[] = tenant
      ? resolveEnabledModules(tenant.planId, tenant.moduleOverrides)
      : MODULE_CATALOG.map((module) => module.key);
    return {
      tenant,
      context,
      branches: this.data.branches.filter((entry) => entry.tenantId === context.tenantId),
      entitlements: {
        planId: tenant?.planId ?? null,
        enabledModules
      }
    };
  }

  createStaffSession(input: CreateStaffSessionInput) {
    const secret = process.env.STAFF_SESSION_SECRET;
    if (!secret) {
      throw new ApiError(503, "Staff session auth is not configured");
    }

    const demoIssuerAllowed = process.env.ALLOW_DEMO_SESSION_ISSUER === "true" || process.env.NODE_ENV !== "production";
    if (!demoIssuerAllowed) {
      throw new ApiError(403, "Demo staff session issuer is disabled");
    }

    const tenantId = input.tenantId ?? DEMO_TENANT_ID;
    const userId = input.userId ?? DEMO_STAFF_USER_ID;
    const user = this.data.users.find((entry) => entry.id === userId && entry.tenantId === tenantId && entry.status === "active");
    if (!user) {
      throw new ApiError(401, "Staff user or tenant was not found");
    }

    const requestedExpiry = typeof input.expiresInSeconds === "number" ? input.expiresInSeconds : undefined;
    const expiresInSeconds = Math.min(Math.max(requestedExpiry ?? 8 * 60 * 60, 5 * 60), 24 * 60 * 60);
    const { token, payload } = createStaffSessionToken({
      tenantId: user.tenantId,
      userId: user.id,
      scope: "staff",
      credentialVersion: user.credentialVersion,
      expiresInSeconds
    }, secret);

    return {
      tokenType: "Bearer",
      accessToken: token,
      expiresAt: payload.expiresAt,
      issuedAt: payload.issuedAt,
      sessionId: payload.sessionId,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        displayName: user.displayName,
        email: user.email,
        roles: user.roles,
        branchIds: user.branchIds
      }
    };
  }

  // ---- Real authentication (login, MFA, password lifecycle) -----------------

  private sessionSecret(): string {
    const secret = process.env.STAFF_SESSION_SECRET;
    if (!secret) {
      throw new ApiError(503, "Session auth is not configured (STAFF_SESSION_SECRET).");
    }
    return secret;
  }

  private appBaseUrl(scope: PrincipalType): string {
    return scope === "platform"
      ? process.env.PLATFORM_CONSOLE_URL ?? "http://localhost:3202"
      : process.env.STAFF_WEB_URL ?? "http://localhost:3200";
  }

  /** Resolve a principal (staff user or platform admin) by globally-unique email. */
  private findPrincipalByEmail(email: string): { type: PrincipalType; principal: User | PlatformAdmin } | undefined {
    const normalized = email.trim().toLowerCase();
    const admin = this.data.platformAdmins.find((entry) => entry.email.toLowerCase() === normalized);
    if (admin) return { type: "platform", principal: admin };
    const user = this.data.users.find((entry) => (entry.email ?? "").toLowerCase() === normalized);
    if (user) return { type: "staff", principal: user };
    return undefined;
  }

  private async persistPrincipal(type: PrincipalType): Promise<void> {
    await this.persistence.saveCollection(type === "platform" ? "platformAdmins" : "users", type === "platform" ? this.data.platformAdmins : this.data.users);
  }

  private issueToken(type: PrincipalType, principal: User | PlatformAdmin) {
    const tenantId = type === "platform" ? PLATFORM_SCOPE : (principal as User).tenantId;
    const { token, payload } = createStaffSessionToken(
      {
        tenantId,
        userId: principal.id,
        scope: type as SessionScope,
        credentialVersion: principal.credentialVersion,
        mustResetPassword: principal.mustResetPassword,
        expiresInSeconds: Number.parseInt(process.env.SESSION_TTL_SECONDS ?? `${8 * 60 * 60}`, 10)
      },
      this.sessionSecret()
    );
    return { token, expiresAt: payload.expiresAt, sessionId: payload.sessionId };
  }

  private principalSummary(type: PrincipalType, principal: User | PlatformAdmin) {
    return {
      id: principal.id,
      type,
      email: principal.email,
      displayName: principal.displayName,
      roles: principal.roles,
      tenantId: type === "platform" ? null : (principal as User).tenantId,
      mustResetPassword: Boolean(principal.mustResetPassword)
    };
  }

  private mfaRequiredFor(type: PrincipalType, principal: User | PlatformAdmin): boolean {
    if (principal.mfaEnabled) return true;
    if (type === "staff") {
      const tenant = this.data.organizations.find((entry) => entry.id === (principal as User).tenantId);
      return tenant?.mfaPolicy === "required";
    }
    return false;
  }

  /**
   * Step 1 of login: verify email + password. Returns one of:
   *  - { mustResetPassword, token }  (forced first-login reset; token is valid)
   *  - { mfaRequired, challengeId }  (email OTP issued)
   *  - { token, expiresAt, principal }  (fully authenticated)
   */
  async login(input: { email?: unknown; password?: unknown }, requestId?: string) {
    const email = ensureString(input.email, "email");
    const password = ensureString(input.password, "password");
    const found = this.findPrincipalByEmail(email);

    // Uniform failure for unknown email or bad password (don't leak which).
    const fail = async (principal?: User | PlatformAdmin, type?: PrincipalType) => {
      if (principal && type) {
        principal.failedLoginAttempts = (principal.failedLoginAttempts ?? 0) + 1;
        if (principal.failedLoginAttempts >= 10) {
          principal.lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        }
        await this.persistPrincipal(type);
        await this.auditAuth("auth.login_failed", type, principal, requestId, { email });
      }
      throw new ApiError(401, "Invalid email or password.");
    };

    if (!found) {
      await this.auditAuth("auth.login_failed", "staff", undefined, requestId, { email });
      throw new ApiError(401, "Invalid email or password.");
    }
    const { type, principal } = found;
    if (principal.status !== "active") {
      throw new ApiError(403, "This account is not active. Contact your administrator.");
    }
    if (principal.lockedUntil && new Date(principal.lockedUntil).getTime() > Date.now()) {
      throw new ApiError(423, "Account temporarily locked after too many attempts. Try again later.");
    }
    if (!verifyPassword(password, { hash: principal.passwordHash ?? "", salt: principal.passwordSalt ?? "" })) {
      return fail(principal, type);
    }

    // Password correct — clear failure counters.
    principal.failedLoginAttempts = 0;
    principal.lockedUntil = undefined;

    if (principal.mustResetPassword) {
      principal.lastLoginAt = nowIso();
      await this.persistPrincipal(type);
      const { token, expiresAt } = this.issueToken(type, principal);
      return { mustResetPassword: true as const, token, expiresAt, principal: this.principalSummary(type, principal) };
    }

    if (this.mfaRequiredFor(type, principal)) {
      const challengeId = await this.createLoginChallenge(type, principal);
      return { mfaRequired: true as const, challengeId, email: principal.email };
    }

    principal.lastLoginAt = nowIso();
    await this.persistPrincipal(type);
    const issued = this.issueToken(type, principal);
    await this.auditAuth("auth.login", type, principal, requestId, { mfa: false });
    return { token: issued.token, expiresAt: issued.expiresAt, principal: this.principalSummary(type, principal) };
  }

  private async createLoginChallenge(type: PrincipalType, principal: User | PlatformAdmin): Promise<string> {
    const code = generateNumericCode(6);
    const cred = hashPassword(code.padStart(8, "0")); // reuse scrypt (min length 8)
    const challenge: LoginChallenge = {
      token: createId("challenge"),
      principalType: type,
      principalId: principal.id,
      tenantId: type === "platform" ? PLATFORM_SCOPE : (principal as User).tenantId,
      codeHash: cred.hash,
      codeSalt: cred.salt,
      purpose: "login_mfa",
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      createdAt: nowIso()
    };
    this.data.loginChallenges.push(challenge);
    await this.persistence.saveCollection("loginChallenges", this.data.loginChallenges);
    if (principal.email) {
      await this.email.send(otpEmail(principal.email, code));
    }
    await this.auditAuth("auth.mfa_challenge", type, principal, undefined, {});
    return challenge.token;
  }

  /** Step 2 of login: verify the email OTP and issue a session. */
  async verifyLoginOtp(input: { challengeId?: unknown; code?: unknown }, requestId?: string) {
    const challengeId = ensureString(input.challengeId, "challengeId");
    const code = ensureString(input.code, "code");
    const challenge = this.data.loginChallenges.find((entry) => entry.token === challengeId);
    if (!challenge) {
      throw new ApiError(401, "Invalid or expired login challenge.");
    }
    if (new Date(challenge.expiresAt).getTime() <= Date.now() || challenge.attempts >= 5) {
      this.data.loginChallenges = this.data.loginChallenges.filter((entry) => entry.token !== challengeId);
      await this.persistence.saveCollection("loginChallenges", this.data.loginChallenges);
      throw new ApiError(401, "Login challenge expired. Sign in again.");
    }
    const ok = verifyPassword(code.padStart(8, "0"), { hash: challenge.codeHash, salt: challenge.codeSalt });
    if (!ok) {
      challenge.attempts += 1;
      await this.persistence.saveCollection("loginChallenges", this.data.loginChallenges);
      throw new ApiError(401, "Incorrect code.");
    }

    const principal = this.loadPrincipal(challenge.principalType, challenge.principalId);
    if (!principal || principal.status !== "active") {
      throw new ApiError(401, "Account is no longer active.");
    }
    // Consume the challenge.
    this.data.loginChallenges = this.data.loginChallenges.filter((entry) => entry.token !== challengeId);
    await this.persistence.saveCollection("loginChallenges", this.data.loginChallenges);

    principal.lastLoginAt = nowIso();
    await this.persistPrincipal(challenge.principalType);
    const issued = this.issueToken(challenge.principalType, principal);
    await this.auditAuth("auth.login", challenge.principalType, principal, requestId, { mfa: true });
    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      principal: this.principalSummary(challenge.principalType, principal)
    };
  }

  private loadPrincipal(type: PrincipalType, id: string): User | PlatformAdmin | undefined {
    return type === "platform"
      ? this.data.platformAdmins.find((entry) => entry.id === id)
      : this.data.users.find((entry) => entry.id === id);
  }

  /** Forgot-password: always returns ok (never leaks whether the email exists). */
  async requestPasswordReset(input: { email?: unknown }, requestId?: string) {
    const email = typeof input.email === "string" ? input.email : "";
    const found = this.findPrincipalByEmail(email);
    if (found && found.principal.status === "active") {
      const reset: PasswordResetToken = {
        token: createId("reset"),
        principalType: found.type,
        principalId: found.principal.id,
        tenantId: found.type === "platform" ? PLATFORM_SCOPE : (found.principal as User).tenantId,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        createdAt: nowIso()
      };
      this.data.passwordResetTokens.push(reset);
      await this.persistence.saveCollection("passwordResetTokens", this.data.passwordResetTokens);
      if (found.principal.email) {
        const link = `${this.appBaseUrl(found.type)}/reset-password?token=${reset.token}`;
        await this.email.send(passwordResetEmail(found.principal.email, link));
      }
      await this.auditAuth("auth.password_reset_requested", found.type, found.principal, requestId, {});
    }
    return { ok: true, message: "If that email exists, a reset link has been sent." };
  }

  async resetPassword(input: { token?: unknown; newPassword?: unknown }, requestId?: string) {
    const token = ensureString(input.token, "token");
    const newPassword = ensureString(input.newPassword, "newPassword");
    const reset = this.data.passwordResetTokens.find((entry) => entry.token === token);
    if (!reset || reset.usedAt || new Date(reset.expiresAt).getTime() <= Date.now()) {
      throw new ApiError(400, "Reset link is invalid or expired.");
    }
    const principal = this.loadPrincipal(reset.principalType, reset.principalId);
    if (!principal) {
      throw new ApiError(400, "Account not found.");
    }
    this.applyNewPassword(principal, newPassword);
    reset.usedAt = nowIso();
    await this.persistPrincipal(reset.principalType);
    await this.persistence.saveCollection("passwordResetTokens", this.data.passwordResetTokens);
    await this.auditAuth("auth.password_reset", reset.principalType, principal, requestId, {});
    return { ok: true, message: "Password updated. You can now sign in." };
  }

  async changePassword(context: RequestContext, input: { currentPassword?: unknown; newPassword?: unknown }) {
    const type: PrincipalType = context.actorType === "platform" ? "platform" : "staff";
    const principal = this.loadPrincipal(type, context.actorId);
    if (!principal) {
      throw new ApiError(404, "Account not found.");
    }
    const newPassword = ensureString(input.newPassword, "newPassword");
    // Forced first-login: the principal just authenticated with their temp password,
    // so completing the mandatory reset doesn't require re-entering it.
    if (!principal.mustResetPassword) {
      const current = ensureString(input.currentPassword, "currentPassword");
      if (!verifyPassword(current, { hash: principal.passwordHash ?? "", salt: principal.passwordSalt ?? "" })) {
        throw new ApiError(401, "Current password is incorrect.");
      }
    }
    this.applyNewPassword(principal, newPassword);
    await this.persistPrincipal(type);
    await this.auditAuth("auth.password_change", type, principal, undefined, {});
    // Issue a fresh token carrying the bumped credentialVersion so the caller stays signed in.
    const issued = this.issueToken(type, principal);
    return { ok: true, token: issued.token, expiresAt: issued.expiresAt };
  }

  /** Set a new password: hash, bump credentialVersion (kills old tokens), clear reset/lock. */
  private applyNewPassword(principal: User | PlatformAdmin, newPassword: string) {
    const cred = hashPassword(newPassword);
    principal.passwordHash = cred.hash;
    principal.passwordSalt = cred.salt;
    principal.credentialVersion += 1;
    principal.mustResetPassword = false;
    principal.failedLoginAttempts = 0;
    principal.lockedUntil = undefined;
  }

  private async auditAuth(
    action: AuditEvent["action"],
    type: PrincipalType,
    principal: User | PlatformAdmin | undefined,
    requestId: string | undefined,
    details: Record<string, unknown>
  ) {
    const event: AuditEvent = {
      id: createId("audit"),
      tenantId: type === "platform" ? PLATFORM_SCOPE : ((principal as User | undefined)?.tenantId ?? "unknown"),
      actorType: type === "platform" ? "platform" : "staff",
      actorId: principal?.id ?? "anonymous",
      actorDisplayName: principal?.displayName ?? "Unknown",
      action,
      resourceType: type === "platform" ? "platform_admin" : "user",
      resourceId: principal?.id,
      requestId,
      details,
      createdAt: nowIso()
    };
    this.data.auditEvents.push(event);
    await this.persistence.saveCollection("auditEvents", this.data.auditEvents);
  }

  /** Dev-only: read the console email outbox (OTP codes / reset links) for testing. */
  getDevOutbox(): OutboxEntry[] {
    return this.email.recentOutbox(20);
  }

  // ---- Hospital user management (org admin) ---------------------------------

  private userView(user: User) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
      branchIds: user.branchIds,
      status: user.status,
      mfaEnabled: Boolean(user.mfaEnabled),
      mustResetPassword: Boolean(user.mustResetPassword),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }

  private tenantSeatUsage(tenantId: string) {
    const org = this.data.organizations.find((entry) => entry.id === tenantId);
    const used = this.data.users.filter((entry) => entry.tenantId === tenantId && entry.status !== "inactive").length;
    const limit = org ? resolveSeatLimit(org.planId, org.seatLimitOverride) : null;
    return { used, limit };
  }

  private emailTaken(email: string): boolean {
    const normalized = email.toLowerCase();
    return (
      this.data.users.some((entry) => (entry.email ?? "").toLowerCase() === normalized) ||
      this.data.platformAdmins.some((entry) => entry.email.toLowerCase() === normalized)
    );
  }

  listUsers(context: RequestContext) {
    const { used, limit } = this.tenantSeatUsage(context.tenantId);
    return {
      users: this.data.users
        .filter((entry) => entry.tenantId === context.tenantId)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((entry) => this.userView(entry)),
      seats: { used, limit },
      mfaPolicy: this.data.organizations.find((entry) => entry.id === context.tenantId)?.mfaPolicy ?? "optional"
    };
  }

  async createUser(context: RequestContext, input: Record<string, unknown>) {
    const displayName = ensureString(input.displayName, "displayName");
    const email = ensureString(input.email, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ApiError(400, "A valid email is required.");
    }
    if (this.emailTaken(email)) {
      throw new ApiError(409, "That email is already in use.");
    }
    const { used, limit } = this.tenantSeatUsage(context.tenantId);
    if (limit !== null && used >= limit) {
      throw new ApiError(403, `Seat limit reached (${limit}). Upgrade the plan or deactivate a user to add more.`);
    }
    const roles = this.sanitizeStaffRoles(input.roles);
    const branchIds = Array.isArray(input.branchIds)
      ? (input.branchIds.filter((b) => typeof b === "string") as string[])
      : [];
    const tempPassword = typeof input.password === "string" && input.password.length >= 8 ? input.password : generateTempPassword();
    const cred = hashPassword(tempPassword);
    const timestamp = nowIso();
    const user: User = {
      id: createId("user"),
      tenantId: context.tenantId,
      displayName,
      email,
      roles,
      branchIds,
      status: "active",
      passwordHash: cred.hash,
      passwordSalt: cred.salt,
      credentialVersion: 0,
      mustResetPassword: true,
      createdAt: timestamp
    };
    this.data.users.push(user);
    await this.persistence.saveCollection("users", this.data.users);
    await this.audit(context, "user.create", "user", user.id, undefined, { email, roles });
    if (user.email) {
      await this.email.send(inviteEmail(user.email, `${this.appBaseUrl("staff")}/login`, tempPassword));
    }
    return { user: this.userView(user), tempPassword };
  }

  /** Validate + apply an email change to a principal (global uniqueness). No-op if unchanged. */
  private applyEmailChange(principal: User | PlatformAdmin, rawEmail: unknown) {
    if (typeof rawEmail !== "string") return;
    const email = rawEmail.trim().toLowerCase();
    if (!email || email === (principal.email ?? "").toLowerCase()) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ApiError(400, "A valid email is required.");
    }
    if (this.emailTaken(email)) {
      throw new ApiError(409, "That email is already in use.");
    }
    principal.email = email;
  }

  async updateUser(context: RequestContext, userId: string, input: Record<string, unknown>) {
    const user = this.data.users.find((entry) => entry.id === userId && entry.tenantId === context.tenantId);
    if (!user) {
      throw new ApiError(404, `User not found: ${userId}`);
    }
    if (typeof input.displayName === "string" && input.displayName.trim()) {
      user.displayName = input.displayName.trim();
    }
    this.applyEmailChange(user, input.email);
    if (input.roles !== undefined) {
      user.roles = this.sanitizeStaffRoles(input.roles);
    }
    if (Array.isArray(input.branchIds)) {
      user.branchIds = input.branchIds.filter((b) => typeof b === "string") as string[];
    }
    if (typeof input.mfaEnabled === "boolean") {
      user.mfaEnabled = input.mfaEnabled;
    }
    if (input.status === "active" || input.status === "inactive" || input.status === "suspended") {
      if (input.status !== "active" && user.status === "active") {
        user.credentialVersion += 1; // force-logout on suspend/deactivate
      }
      user.status = input.status;
    }
    await this.persistence.saveCollection("users", this.data.users);
    await this.audit(context, "user.update", "user", user.id, undefined, { status: user.status, roles: user.roles });
    return { user: this.userView(user) };
  }

  /** Platform superadmin: edit a user inside any tenant (name/email/status). */
  async updateTenantUser(context: RequestContext, tenantId: string, userId: string, input: Record<string, unknown>) {
    const user = this.data.users.find((entry) => entry.id === userId && entry.tenantId === tenantId);
    if (!user) {
      throw new ApiError(404, `User not found in tenant ${tenantId}: ${userId}`);
    }
    if (typeof input.displayName === "string" && input.displayName.trim()) {
      user.displayName = input.displayName.trim();
    }
    this.applyEmailChange(user, input.email);
    if (input.status === "active" || input.status === "inactive" || input.status === "suspended") {
      if (input.status !== "active" && user.status === "active") {
        user.credentialVersion += 1;
      }
      user.status = input.status;
    }
    await this.persistence.saveCollection("users", this.data.users);
    await this.audit(context, "user.update", "user", user.id, undefined, { byPlatform: context.actorId, email: user.email });
    return { user: this.userView(user) };
  }

  async resetUserPassword(context: RequestContext, userId: string) {
    const user = this.data.users.find((entry) => entry.id === userId && entry.tenantId === context.tenantId);
    if (!user) {
      throw new ApiError(404, `User not found: ${userId}`);
    }
    const tempPassword = generateTempPassword();
    const cred = hashPassword(tempPassword);
    user.passwordHash = cred.hash;
    user.passwordSalt = cred.salt;
    user.credentialVersion += 1;
    user.mustResetPassword = true;
    await this.persistence.saveCollection("users", this.data.users);
    await this.audit(context, "user.update", "user", user.id, undefined, { action: "password_reset" });
    if (user.email) {
      await this.email.send(inviteEmail(user.email, `${this.appBaseUrl("staff")}/login`, tempPassword));
    }
    return { ok: true, tempPassword };
  }

  async updateTenantSettings(context: RequestContext, input: Record<string, unknown>) {
    const org = this.data.organizations.find((entry) => entry.id === context.tenantId);
    if (!org) {
      throw new ApiError(404, "Tenant not found.");
    }
    if (input.mfaPolicy === "optional" || input.mfaPolicy === "required") {
      org.mfaPolicy = input.mfaPolicy;
    }
    await this.persistence.saveCollection("organizations", this.data.organizations);
    await this.audit(context, "tenant.settings_update", "tenant", org.id, undefined, { mfaPolicy: org.mfaPolicy });
    return { ok: true, mfaPolicy: org.mfaPolicy ?? "optional" };
  }

  /** Tenant-scoped branches, projecting the patient-facing contact + map fields. */
  listTenantBranches(context: RequestContext) {
    const branches = this.data.branches
      .filter((entry) => entry.tenantId === context.tenantId)
      .map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        city: entry.city,
        phone: entry.phone ?? "",
        address: entry.address ?? "",
        mapUrl: entry.mapUrl ?? "",
        status: entry.status
      }));
    return { branches };
  }

  /**
   * Org-admin edit of a branch's patient-facing contact info (phone / address /
   * Google Maps link). Only provided fields change; an empty string clears the
   * field. Returns the updated branch.
   */
  async updateBranchContact(context: RequestContext, branchId: string, input: Record<string, unknown>) {
    const branch = this.data.branches.find(
      (entry) => entry.id === branchId && entry.tenantId === context.tenantId
    );
    if (!branch) {
      throw new ApiError(404, "Branch not found.");
    }
    const applyField = (key: "phone" | "address" | "mapUrl") => {
      const raw = input[key];
      if (raw === undefined) {
        return;
      }
      const trimmed = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
      if (trimmed.length === 0) {
        delete branch[key];
      } else {
        branch[key] = trimmed;
      }
    };
    applyField("phone");
    applyField("address");
    applyField("mapUrl");
    await this.persistence.saveCollection("branches", this.data.branches);
    await this.audit(context, "branch.update", "branch", branch.id, undefined, {
      phone: branch.phone ?? "",
      address: branch.address ?? "",
      mapUrl: branch.mapUrl ?? ""
    });
    return { branch };
  }

  private sanitizeStaffRoles(value: unknown): Role[] {
    const allowed: Role[] = ["front_desk", "call_center", "care_coordinator", "nurse", "doctor", "admin", "org_admin"];
    const list = Array.isArray(value) ? value : [];
    const roles = list.filter((r): r is Role => typeof r === "string" && (allowed as string[]).includes(r));
    return roles.length ? roles : ["front_desk"];
  }

  // ---- Messaging channels (per-tenant WhatsApp) -----------------------------

  private tenantChannelConfig(tenantId: string): TenantChannelConfig | undefined {
    return this.data.channelConfigs.find((entry) => entry.tenantId === tenantId);
  }

  /** Redacted channel status for the active tenant (never returns raw secrets). */
  getTenantChannels(context: RequestContext) {
    const c = this.tenantChannelConfig(context.tenantId);
    const tail = (s?: string) => (s && s.length > 3 ? `…${s.slice(-4)}` : s ? "…" : null);
    return {
      ultramsg: {
        configured: Boolean(c?.ultramsg?.instanceId && c.ultramsg.token),
        enabled: c?.ultramsg?.enabled ?? false,
        instanceId: c?.ultramsg?.instanceId ?? null,
        tokenTail: tail(c?.ultramsg?.token)
      },
      aisensy: {
        configured: Boolean(c?.aisensy?.apiKey),
        enabled: c?.aisensy?.enabled ?? false,
        apiKeyTail: tail(c?.aisensy?.apiKey)
      },
      telephony: {
        configured: Boolean(c?.telephony?.apiKey),
        enabled: c?.telephony?.enabled ?? false,
        provider: c?.telephony?.provider ?? null,
        callerId: c?.telephony?.callerId ?? null,
        apiKeyTail: tail(c?.telephony?.apiKey)
      }
    };
  }

  /** Set/update a tenant's channel credentials. A blank secret keeps the existing
   *  one (so admins can toggle/edit without re-entering keys). */
  async updateTenantChannels(context: RequestContext, input: Record<string, unknown>) {
    let c = this.tenantChannelConfig(context.tenantId);
    const now = nowIso();
    if (!c) {
      c = { tenantId: context.tenantId, createdAt: now, updatedAt: now };
      this.data.channelConfigs.push(c);
    }
    const um = input.ultramsg;
    if (um && typeof um === "object") {
      const u = um as Record<string, unknown>;
      const instanceId = typeof u.instanceId === "string" && u.instanceId.trim() ? u.instanceId.trim() : c.ultramsg?.instanceId ?? "";
      const token = typeof u.token === "string" && u.token.trim() ? u.token.trim() : c.ultramsg?.token ?? "";
      c.ultramsg = { instanceId, token, enabled: typeof u.enabled === "boolean" ? u.enabled : c.ultramsg?.enabled ?? true };
    }
    const ai = input.aisensy;
    if (ai && typeof ai === "object") {
      const a = ai as Record<string, unknown>;
      const apiKey = typeof a.apiKey === "string" && a.apiKey.trim() ? a.apiKey.trim() : c.aisensy?.apiKey ?? "";
      c.aisensy = { apiKey, enabled: typeof a.enabled === "boolean" ? a.enabled : c.aisensy?.enabled ?? true };
    }
    const tel = input.telephony;
    if (tel && typeof tel === "object") {
      const t = tel as Record<string, unknown>;
      const apiKey = typeof t.apiKey === "string" && t.apiKey.trim() ? t.apiKey.trim() : c.telephony?.apiKey ?? "";
      const provider =
        typeof t.provider === "string" && t.provider.trim() ? t.provider.trim() : c.telephony?.provider;
      const callerId =
        typeof t.callerId === "string" && t.callerId.trim() ? t.callerId.trim() : c.telephony?.callerId;
      c.telephony = {
        apiKey,
        provider,
        callerId,
        enabled: typeof t.enabled === "boolean" ? t.enabled : c.telephony?.enabled ?? true
      };
    }
    c.updatedAt = now;
    await this.persistence.saveCollection("channelConfigs", this.data.channelConfigs);
    await this.audit(context, "tenant.settings_update", "channel_config", context.tenantId, undefined, {
      ultramsg: c.ultramsg ? { configured: Boolean(c.ultramsg.instanceId), enabled: c.ultramsg.enabled } : null,
      aisensy: c.aisensy ? { configured: Boolean(c.aisensy.apiKey), enabled: c.aisensy.enabled } : null,
      telephony: c.telephony ? { configured: Boolean(c.telephony.apiKey), enabled: c.telephony.enabled } : null
    });
    return this.getTenantChannels(context);
  }

  // ---- Mobile-link confirm session (shared by workflow message stages) -------

  /** Mint a 72h confirm/reschedule mobile-link session for the patient (PWA deep-link). */
  private async mintConfirmSession(context: RequestContext, patientId: string): Promise<MobileLinkSession> {
    const session: MobileLinkSession = {
      token: createId("mls"),
      tenantId: context.tenantId,
      patientId,
      expiresAt: new Date(Date.now() + 72 * 60 * 60_000).toISOString(),
      allowedActions: ["confirm_appointment", "reschedule_request", "upload_document_metadata"],
      createdAt: nowIso()
    };
    this.data.sessions.push(session);
    await this.persistence.saveCollection("sessions", this.data.sessions);
    return session;
  }

  // ---- Single source of truth: resolve denormalized appointment fields --------
  //
  // Appointments store a copy of the doctor's name/specialty and the branch is
  // referenced by id only. Those stored copies are denormalized at booking time
  // and go stale when the doctor is renamed or the branch contact changes. The
  // helpers below resolve the CURRENT values from the live doctor/branch records,
  // falling back to the stored copy when the source record is missing. Every read
  // path that surfaces an appointment should go through `decorateAppointment` (or,
  // for outbound message tokens, `resolveAppointmentDoctor`/`resolveBranch`) so we
  // have one place that defines "current name/contact".

  /** Live doctor name/specialty for an appointment, falling back to the stored copy. */
  private resolveAppointmentDoctor(
    appointment: Pick<Appointment, "doctorId" | "doctorName" | "specialty">
  ): { doctorName: string; specialty: string } {
    const doctor = appointment.doctorId
      ? this.data.doctors.find((entry) => entry.id === appointment.doctorId)
      : undefined;
    return {
      doctorName: doctor?.displayName ?? appointment.doctorName,
      specialty: doctor?.specialty ?? appointment.specialty
    };
  }

  /** Live branch record for a branchId (tenant-scoped). */
  private resolveBranch(context: RequestContext, branchId: string): Branch | undefined {
    return this.data.branches.find((entry) => entry.id === branchId && entry.tenantId === context.tenantId);
  }

  /**
   * Return an appointment with its denormalized fields corrected to the live
   * source-of-truth: doctorName/specialty from the doctor record, and the branch's
   * current name/address/mapUrl/phone resolved from the branch record. Response
   * shape is a superset of `Appointment` (additive/corrective only — no fields are
   * removed), so staff-web's `Appointment[]` consumers keep working.
   */
  private decorateAppointment(context: RequestContext, appointment: Appointment) {
    const { doctorName, specialty } = this.resolveAppointmentDoctor(appointment);
    const branch = this.resolveBranch(context, appointment.branchId);
    return {
      ...appointment,
      doctorName,
      specialty,
      branchName: branch?.displayName,
      address: branch?.address,
      mapUrl: branch?.mapUrl,
      phone: branch?.phone
    };
  }

  /**
   * Build the token map for a notification. NOTE: appointment.scheduledAt encodes
   * the wall-clock time as UTC, so we format date/time from the UTC components
   * (so "09:30Z" renders as 9:30 AM, not a tz-shifted value).
   */
  private appointmentTokens(
    context: RequestContext,
    appointment: Appointment,
    patient: Patient
  ): Record<string, string> {
    const at = new Date(appointment.scheduledAt);
    const date = Number.isNaN(at.getTime())
      ? appointment.scheduledAt
      : at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
    const time = Number.isNaN(at.getTime())
      ? ""
      : at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
    const branchRecord = this.resolveBranch(context, appointment.branchId);
    const branch = branchRecord?.displayName ?? "";
    // Resolve the doctor's CURRENT name from the live record (shared with the
    // appointment decorator) — the stored copy is denormalized and goes stale.
    const { doctorName } = this.resolveAppointmentDoctor(appointment);
    return {
      patientName: firstName(patient.displayName),
      doctorName: doctorName || "your doctor",
      date,
      time,
      branch,
      address: branchRecord?.address ?? "",
      mapLink: branchRecord?.mapUrl ?? "",
      clinicPhone: branchRecord?.phone ?? ""
    };
  }

  /** Replace every {{token}} (case-insensitive, optional spaces) present in `tokens`. */
  private renderTemplate(body: string, tokens: Record<string, string>): string {
    let out = body;
    for (const [key, value] of Object.entries(tokens)) {
      out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
    }
    return out;
  }

  /** Minimal system RequestContext for a tenant (used by the workflow scheduler). */
  private systemContext(tenantId: string): RequestContext {
    return {
      actorType: "service",
      tenantId,
      actorId: "system",
      displayName: "Workflow Scheduler",
      roles: [],
      branchIds: [],
      permissions: ["appointments:create"],
      isDemoMode: false,
      source: "system_default"
    };
  }

  // ---- Communication Workflows: runtime (enroll / fire / signal / schedule) --

  /**
   * The default appointment-lifecycle templates + workflow, cloned per-tenant by
   * `ensureDefaultAppointmentWorkflow` so a tenant that never configured a workflow
   * still gets the same five messages the old fixed notification path produced.
   * Bodies are the verbatim NOTIFICATION_DEFAULTS — behavior is preserved.
   */
  private defaultAppointmentTemplateSpecs(): Array<{
    suffix: string;
    name: string;
    body: string;
  }> {
    return [
      { suffix: "booking", name: "Booking confirmation", body: NOTIFICATION_DEFAULTS.booked.body },
      { suffix: "early_reminder", name: "Early reminder", body: NOTIFICATION_DEFAULTS.reminder24h.body },
      { suffix: "final_reminder", name: "Final reminder", body: NOTIFICATION_DEFAULTS.reminder3h.body },
      { suffix: "cancellation", name: "Cancellation notice", body: NOTIFICATION_DEFAULTS.cancelled.body },
      { suffix: "reschedule", name: "Reschedule confirmation", body: NOTIFICATION_DEFAULTS.rescheduled.body }
    ];
  }

  /**
   * Lazy default provisioning: if the tenant has NO active appointment-anchored
   * workflow, clone the default five templates + the "Appointment lifecycle"
   * workflow for THIS tenant (tenant-scoped ids). Idempotent — a no-op once an
   * active appointment workflow exists. Guarantees every tenant has parity with
   * the retired per-tenant notification defaults.
   */
  async ensureDefaultAppointmentWorkflow(context: RequestContext): Promise<void> {
    const hasActive = this.data.workflows.some(
      (workflow) =>
        workflow.tenantId === context.tenantId && workflow.anchor === "appointment" && workflow.status === "active"
    );
    if (hasActive) {
      return;
    }
    const tenantId = context.tenantId;
    const timestamp = nowIso();
    const specs = this.defaultAppointmentTemplateSpecs();
    const idFor = (suffix: string) => `template_${tenantId}_${suffix}`;
    let mutatedTemplates = false;
    for (const spec of specs) {
      const id = idFor(spec.suffix);
      if (this.data.templates.some((entry) => entry.id === id && entry.tenantId === tenantId)) {
        continue;
      }
      this.data.templates.push({
        id,
        tenantId,
        name: spec.name,
        channel: "whatsapp",
        kind: "text",
        body: spec.body,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      mutatedTemplates = true;
    }
    if (mutatedTemplates) {
      await this.persistence.saveCollection("templates", this.data.templates);
    }
    const workflow: Workflow = {
      id: `workflow_${tenantId}_appointment`,
      tenantId,
      name: "Appointment lifecycle",
      description: "End-to-end appointment messaging: booking, reminders, cancellation, and reschedule.",
      anchor: "appointment",
      status: "active",
      stages: [
        {
          key: "booked",
          name: "Booking confirmation",
          action: "message",
          templateId: idFor("booking"),
          trigger: { type: "on_enroll" },
          enabled: true
        },
        {
          key: "reminder_24h",
          name: "Early reminder",
          action: "message",
          templateId: idFor("early_reminder"),
          trigger: { type: "relative", anchorEvent: "appointment_start", offsetHours: -24 },
          enabled: true
        },
        {
          key: "reminder_3h",
          name: "Final reminder",
          action: "message",
          templateId: idFor("final_reminder"),
          trigger: { type: "relative", anchorEvent: "appointment_start", offsetHours: -3 },
          enabled: true
        },
        {
          key: "cancelled",
          name: "Cancellation notice",
          action: "message",
          templateId: idFor("cancellation"),
          trigger: { type: "on_event", event: "cancelled" },
          enabled: true
        },
        {
          key: "rescheduled",
          name: "Reschedule confirmation",
          action: "message",
          templateId: idFor("reschedule"),
          trigger: { type: "on_event", event: "rescheduled" },
          enabled: true
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.workflows.push(workflow);
    await this.persistence.saveCollection("workflows", this.data.workflows);
  }

  /**
   * Enroll an appointment into every active appointment-anchored workflow of its
   * tenant: ensure default provisioning, create a WorkflowRun per workflow (one
   * pending StageRun per stage), then fire all `on_enroll` stages immediately.
   * Best-effort — never throws to the caller (booking must always succeed).
   */
  async enrollAppointmentWorkflows(context: RequestContext, appointment: Appointment, patient: Patient): Promise<void> {
    try {
      await this.ensureDefaultAppointmentWorkflow(context);
      const workflows = this.data.workflows.filter(
        (workflow) =>
          workflow.tenantId === context.tenantId && workflow.anchor === "appointment" && workflow.status === "active"
      );
      const timestamp = nowIso();
      const newRuns: WorkflowRun[] = [];
      for (const workflow of workflows) {
        const run: WorkflowRun = {
          id: createId("wfrun"),
          tenantId: context.tenantId,
          workflowId: workflow.id,
          patientId: patient.id,
          anchorType: "appointment",
          anchorId: appointment.id,
          status: "active",
          stageRuns: workflow.stages.map((stage) => ({ stageKey: stage.key, status: "pending" as StageRunStatus })),
          startedAt: timestamp,
          updatedAt: timestamp
        };
        this.data.workflowRuns.push(run);
        newRuns.push(run);
      }
      if (newRuns.length > 0) {
        await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
      }
      // Fire on_enroll stages immediately (e.g. booking confirmation).
      for (const run of newRuns) {
        const workflow = workflows.find((entry) => entry.id === run.workflowId);
        if (!workflow) {
          continue;
        }
        for (const stage of workflow.stages) {
          if (stage.enabled && stage.trigger.type === "on_enroll") {
            await this.fireStage(context, run, stage, appointment, patient);
          }
        }
      }
      if (newRuns.length > 0) {
        await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
      }
    } catch {
      // Workflow enrollment is best-effort; never surface to the caller.
    }
  }

  /** The StageRun row for a stage within a run (created at enrollment). */
  private stageRunFor(run: WorkflowRun, stageKey: string): StageRun | undefined {
    return run.stageRuns.find((entry) => entry.stageKey === stageKey);
  }

  /**
   * Fire a single stage of a run against its appointment. Best-effort + idempotent:
   * only fires a StageRun that is still "pending"; one failure is recorded on the
   * StageRun (status "failed") without aborting siblings or the caller. Marks the
   * StageRun's terminal status + attribution (messageId / callId / sessionToken).
   */
  private async fireStage(
    context: RequestContext,
    run: WorkflowRun,
    stage: WorkflowStage,
    appointment: Appointment,
    patient: Patient
  ): Promise<void> {
    const stageRun = this.stageRunFor(run, stage.key);
    if (!stageRun || stageRun.status !== "pending") {
      return; // idempotency: never re-fire a non-pending stage.
    }
    try {
      if (stage.action === "message" || stage.action === "form") {
        const template = stage.templateId
          ? this.data.templates.find((entry) => entry.id === stage.templateId && entry.tenantId === context.tenantId)
          : undefined;
        if (!template || template.status !== "active" || template.kind !== "text" || !template.body) {
          stageRun.status = "skipped";
          stageRun.outcome = "no usable template body";
        } else if (!patient.primaryPhone) {
          stageRun.status = "skipped";
          stageRun.outcome = "patient has no phone";
        } else {
          const tokens = this.appointmentTokens(context, appointment, patient);
          let sessionToken: string | undefined;
          // Message confirm link: mint a confirm session exactly like the old path.
          if (/\{\{\s*confirmLink\s*\}\}/i.test(template.body)) {
            const session = await this.mintConfirmSession(context, patient.id);
            sessionToken = session.token;
            tokens.confirmLink = `${process.env.PATIENT_WEB_URL || "http://localhost:3201"}/?token=${session.token}`;
          }
          // Form stage: mint a session whose link the patient taps to open the form
          // (full PWA form rendering is a later phase) and append it to the body.
          let body = this.renderTemplate(template.body, tokens);
          if (stage.action === "form") {
            const session = await this.mintConfirmSession(context, patient.id);
            sessionToken = session.token;
            const link = `${process.env.PATIENT_WEB_URL || "http://localhost:3201"}/?token=${session.token}`;
            body = `${body} ${link}`.trim();
          }
          const send = await this.sendMessage(context, { to: patient.primaryPhone, type: "transactional", body });
          // Attribute the message log to the template that produced it.
          const log = this.data.messages.find((entry) => entry.id === send.messageId);
          if (log) {
            log.templateId = template.id;
            await this.persistence.saveCollection("messages", this.data.messages);
          }
          stageRun.status = "sent";
          stageRun.firedAt = nowIso();
          stageRun.messageId = send.messageId;
          if (sessionToken) {
            stageRun.sessionToken = sessionToken;
          }
        }
      } else if (stage.action === "call") {
        if (!patient.primaryPhone) {
          stageRun.status = "skipped";
          stageRun.outcome = "patient has no phone";
        } else {
          const call = await this.createCall(context, {
            to: patient.primaryPhone,
            direction: "outbound",
            patientId: patient.id,
            notes: stage.name
          });
          stageRun.status = "sent";
          stageRun.firedAt = nowIso();
          stageRun.callId = call.id;
        }
      } else {
        // task: create a staff follow-up titled from the stage.
        await this.createFollowUp(context, {
          patientId: patient.id,
          title: stage.name,
          dueAt: appointment.scheduledAt
        });
        stageRun.status = "done";
        stageRun.firedAt = nowIso();
      }
    } catch (error) {
      stageRun.status = "failed";
      stageRun.error = error instanceof Error ? error.message : "stage failed";
    }
    run.updatedAt = nowIso();
  }

  /**
   * Signal an event (e.g. "cancelled","rescheduled") onto every active run anchored
   * to this appointment: fire each enabled `on_event` stage whose event matches and
   * whose StageRun is still pending. Best-effort — never throws to the caller.
   */
  async signalWorkflowEvent(context: RequestContext, appointment: Appointment, event: string): Promise<void> {
    try {
      const patient = this.data.patients.find(
        (entry) => entry.id === appointment.patientId && entry.tenantId === context.tenantId
      );
      if (!patient) {
        return;
      }
      const runs = this.data.workflowRuns.filter(
        (run) =>
          run.tenantId === context.tenantId &&
          run.anchorType === "appointment" &&
          run.anchorId === appointment.id &&
          run.status === "active"
      );
      let fired = false;
      for (const run of runs) {
        const workflow = this.data.workflows.find(
          (entry) => entry.id === run.workflowId && entry.tenantId === context.tenantId
        );
        if (!workflow) {
          continue;
        }
        for (const stage of workflow.stages) {
          if (
            stage.enabled &&
            stage.trigger.type === "on_event" &&
            stage.trigger.event === event &&
            this.stageRunFor(run, stage.key)?.status === "pending"
          ) {
            await this.fireStage(context, run, stage, appointment, patient);
            fired = true;
          }
        }
      }
      if (fired) {
        await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
      }
    } catch {
      // Signalling is best-effort; never surface to the caller.
    }
  }

  /**
   * Mark every active run anchored to this appointment as `status` (e.g. "cancelled"
   * or "completed") so its remaining time-based reminders stop firing. Best-effort.
   */
  private async closeAppointmentRuns(
    context: RequestContext,
    appointmentId: string,
    status: "cancelled" | "completed"
  ): Promise<void> {
    let mutated = false;
    const timestamp = nowIso();
    for (const run of this.data.workflowRuns) {
      if (
        run.tenantId === context.tenantId &&
        run.anchorType === "appointment" &&
        run.anchorId === appointmentId &&
        run.status === "active"
      ) {
        run.status = status;
        run.completedAt = timestamp;
        run.updatedAt = timestamp;
        mutated = true;
      }
    }
    if (mutated) {
      await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
    }
  }

  /** Resolve the base time a `relative` stage is anchored to, per its anchorEvent.
   *  Returns null when the anchor isn't known yet (e.g. `visit_end` before the
   *  visit has been completed) so the scheduler simply waits. */
  private resolveAnchorMs(run: WorkflowRun, appointment: Appointment, anchorEvent: string): number | null {
    let iso: string | undefined;
    if (anchorEvent === "enrollment") iso = run.startedAt;
    else if (anchorEvent === "visit_end") iso = run.visitEndAt;
    else iso = appointment.scheduledAt; // appointment_start (default)
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  /** Mark a run completed once nothing is left pending. Returns true if it changed. */
  private maybeCompleteRun(run: WorkflowRun): boolean {
    if (run.status !== "active") return false;
    if (run.stageRuns.some((s) => s.status === "pending")) return false;
    run.status = "completed";
    run.completedAt = nowIso();
    run.updatedAt = run.completedAt;
    return true;
  }

  /** The appointment/visit finished: stamp the visit-end anchor, retire stages that
   *  can no longer fire (pre-visit timing + mutually-exclusive events), fire any
   *  `visit_completed` stages, and KEEP the run alive for `visit_end`-anchored stages
   *  (e.g. a revisit reminder weeks later). The run auto-completes once nothing is
   *  pending. Best-effort — never throws. */
  private async completeAppointmentRuns(context: RequestContext, appointment: Appointment): Promise<void> {
    try {
      const ts = nowIso();
      const runs = this.data.workflowRuns.filter(
        (run) =>
          run.tenantId === context.tenantId &&
          run.anchorType === "appointment" &&
          run.anchorId === appointment.id &&
          run.status === "active"
      );
      for (const run of runs) {
        if (!run.visitEndAt) run.visitEndAt = ts;
        const workflow = this.data.workflows.find((w) => w.id === run.workflowId && w.tenantId === context.tenantId);
        for (const stageRun of run.stageRuns) {
          if (stageRun.status !== "pending") continue;
          const trigger = workflow?.stages.find((s) => s.key === stageRun.stageKey)?.trigger;
          // Keep only what can still legitimately fire after completion.
          const keep =
            (trigger?.type === "on_event" && trigger.event === "visit_completed") ||
            (trigger?.type === "relative" && trigger.anchorEvent === "visit_end");
          if (!keep) stageRun.status = "skipped";
        }
      }
      // Fire any visit_completed on_event stages (persists internally).
      await this.signalWorkflowEvent(context, appointment, "visit_completed");
      let mutated = runs.length > 0;
      for (const run of runs) {
        if (this.maybeCompleteRun(run)) mutated = true;
      }
      if (mutated) {
        await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
      }
    } catch {
      // best-effort
    }
  }

  /**
   * Time-based workflow scheduler (replaces runAppointmentReminders). Scans every
   * active appointment-anchored run; for each enabled `relative` stage with a still
   * "pending" StageRun, computes dueAt = anchor + offsetHours (anchor per the stage's
   * anchorEvent — appointment start, enrollment, or visit end) and fires when due
   * (and not absurdly past). MIRRORS the old wall-clock-as-UTC handling.
   */
  async runWorkflowScheduler(): Promise<{ fired: number; byStage: Record<string, number> }> {
    const byStage: Record<string, number> = {};
    let fired = 0;
    let mutated = false;
    const now = Date.now();
    const H = 60 * 60_000;
    // Don't fire a reminder whose due time is absurdly in the past (e.g. a run that
    // sat idle through a long downtime). Mirror the old window: only fire within the
    // far-reminder horizon (24h grace) of the due time.
    const GRACE_MS = 24 * H;

    // Snapshot the run list (fireStage doesn't add runs, but stay defensive).
    const runs = this.data.workflowRuns.filter((run) => run.anchorType === "appointment" && run.status === "active");
    for (const run of runs) {
      const appointment = this.data.appointments.find(
        (entry) => entry.id === run.anchorId && entry.tenantId === run.tenantId
      );
      if (!appointment) {
        continue;
      }
      // Cancelled / no-show are terminal — stop everything.
      if (appointment.status === "cancelled" || appointment.status === "no_show") {
        await this.closeAppointmentRuns(this.systemContext(run.tenantId), appointment.id, "cancelled");
        continue;
      }
      // A completed appointment is NOT terminal for the run: visit_end-anchored
      // stages (e.g. a revisit reminder) still need to fire. Stamp the visit-end
      // anchor if it wasn't set, then fall through to process stages.
      if (appointment.status === "completed" && !run.visitEndAt) {
        run.visitEndAt = appointment.updatedAt ?? new Date(now).toISOString();
        mutated = true;
      }
      const startMs = new Date(appointment.scheduledAt).getTime();
      if (Number.isNaN(startMs)) {
        continue;
      }
      const workflow = this.data.workflows.find(
        (entry) => entry.id === run.workflowId && entry.tenantId === run.tenantId
      );
      if (!workflow) {
        continue;
      }
      const context = this.systemContext(run.tenantId);
      const patient = this.data.patients.find(
        (entry) => entry.id === run.patientId && entry.tenantId === run.tenantId
      );
      if (!patient) {
        continue;
      }
      for (const stage of workflow.stages) {
        if (!stage.enabled || stage.trigger.type !== "relative") {
          continue;
        }
        const stageRun = this.stageRunFor(run, stage.key);
        if (!stageRun || stageRun.status !== "pending") {
          continue;
        }
        const anchorMs = this.resolveAnchorMs(run, appointment, stage.trigger.anchorEvent);
        if (anchorMs == null) continue; // anchor not known yet (e.g. visit_end before completion)
        const dueMs = anchorMs + stage.trigger.offsetHours * H;
        // Due window: now has reached dueAt, and dueAt is not absurdly past.
        if (now >= dueMs && now - dueMs <= GRACE_MS) {
          await this.fireStage(context, run, stage, appointment, patient);
          // Re-read: fireStage mutates the StageRun (TS can't see it through the call).
          if (this.stageRunFor(run, stage.key)?.status === "sent") {
            fired += 1;
            mutated = true;
            byStage[stage.key] = (byStage[stage.key] ?? 0) + 1;
          }
        }
      }
      // A run with nothing left pending is done (e.g. a completed appointment whose
      // revisit reminder has now fired).
      if (this.maybeCompleteRun(run)) mutated = true;
    }
    if (mutated) {
      await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
    }
    return { fired, byStage };
  }

  /**
   * Unified WhatsApp send for the active tenant. transactional → UltraMsg,
   * marketing → AISensy, using the tenant's own credentials. Logs every attempt.
   * Returns a structured result (200 even on provider failure) so callers/UI can
   * show success/failure without a 5xx.
   */
  async sendMessage(context: RequestContext, input: Record<string, unknown>) {
    const to = ensureString(input.to, "to");
    const type: MessageType = input.type === "marketing" ? "marketing" : "transactional";
    // Routing is by PROVIDER, not by message category — a marketing broadcast can
    // go via UltraMsg (free-form) just as well as AISensy (approved template).
    // Default keeps back-compat: marketing→AISensy, transactional→UltraMsg.
    const providerOverride =
      input.provider === "ultramsg" || input.provider === "aisensy" ? (input.provider as ChannelProvider) : undefined;
    const config = this.tenantChannelConfig(context.tenantId);

    const channel: ChannelProvider = providerOverride ?? (type === "marketing" ? "aisensy" : "ultramsg");
    let result: { ok: true; providerId?: string } | { ok: false; error: string };
    let body: string | undefined;
    let campaign: string | undefined;

    if (channel === "aisensy") {
      if (!config?.aisensy?.enabled || !config.aisensy.apiKey) {
        throw new ApiError(400, "AISensy is not configured for this hospital.");
      }
      campaign = typeof input.campaign === "string" ? input.campaign : undefined;
      result = await sendAiSensy({ apiKey: config.aisensy.apiKey }, to, {
        campaign,
        userName: typeof input.userName === "string" ? input.userName : undefined,
        params: Array.isArray(input.params) ? (input.params.filter((p) => typeof p === "string") as string[]) : undefined
      });
    } else {
      if (!config?.ultramsg?.enabled || !config.ultramsg.instanceId || !config.ultramsg.token) {
        throw new ApiError(400, "UltraMsg is not configured for this hospital.");
      }
      body = ensureString(input.body, "body");
      result = await sendUltraMsg({ instanceId: config.ultramsg.instanceId, token: config.ultramsg.token }, to, body);
    }

    const log: MessageLog = {
      id: createId("msg"),
      tenantId: context.tenantId,
      to,
      channel,
      type,
      status: result.ok ? "sent" : "failed",
      ...(body ? { body } : {}),
      ...(campaign ? { campaign } : {}),
      ...(result.ok && result.providerId ? { providerId: result.providerId } : {}),
      ...(result.ok ? {} : { error: result.error }),
      createdAt: nowIso()
    };
    this.data.messages.push(log);
    await this.persistence.saveCollection("messages", this.data.messages);
    await this.audit(context, "message.send", "message", log.id, undefined, { channel, type, status: log.status });

    return { ok: result.ok, channel, type, messageId: log.id, providerId: result.ok ? result.providerId : undefined, error: result.ok ? undefined : result.error };
  }

  listMessages(context: RequestContext, limit = 25, filters: { templateId?: string } = {}) {
    return this.data.messages
      .filter((entry) => entry.tenantId === context.tenantId)
      .filter((entry) => (filters.templateId ? entry.templateId === filters.templateId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  // ---- Telephony (per-tenant call log) --------------------------------------

  /** Tenant call log, newest first. Optional filters by lead/patient/status. */
  listCalls(context: RequestContext, filters: { leadId?: string; patientId?: string; status?: string } = {}) {
    return this.data.calls
      .filter((call) => call.tenantId === context.tenantId)
      .filter((call) => (filters.leadId ? call.leadId === filters.leadId : true))
      .filter((call) => (filters.patientId ? call.patientId === filters.patientId : true))
      .filter((call) => (filters.status ? call.status === filters.status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Place (or log) an outbound call. Resolves the tenant's telephony creds and
   * attempts the stub adapter. The seam: if telephony is configured the stub
   * returns a queued providerId; if not, we still RECORD the call (status
   * "queued", disposition noting config is pending) so the call log is never
   * lossy. Never throws a 5xx — a missing config is an expected state.
   */
  async createCall(context: RequestContext, input: Record<string, unknown>) {
    const to = ensureString(input.to, "to");
    const direction: CallDirection = input.direction === "inbound" ? "inbound" : "outbound";
    const config = this.tenantChannelConfig(context.tenantId);
    const from = config?.telephony?.callerId;

    let status: CallStatus = "queued";
    let providerId: string | undefined;
    let disposition: string | undefined;
    try {
      const result = placeCall({ creds: config?.telephony, to, from });
      providerId = result.providerId;
      status = result.status;
    } catch (error) {
      // Expected when telephony is not configured: log the call anyway so the
      // call history stays complete. (Real provider dialing is future work.)
      if (error instanceof ApiError && error.statusCode === 400) {
        status = "queued";
        disposition = "logged (telephony not configured)";
      } else {
        throw error;
      }
    }

    const now = nowIso();
    const call: Call = {
      id: createId("call"),
      tenantId: context.tenantId,
      to,
      from,
      direction,
      status,
      leadId: typeof input.leadId === "string" && input.leadId.trim() ? input.leadId.trim() : undefined,
      patientId: typeof input.patientId === "string" && input.patientId.trim() ? input.patientId.trim() : undefined,
      disposition,
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined,
      providerId,
      createdAt: now,
      updatedAt: now
    };
    this.data.calls.push(call);
    await this.persistence.saveCollection("calls", this.data.calls);
    await this.audit(context, "call.create", "call", call.id, call.patientId, {
      direction,
      status,
      configured: Boolean(config?.telephony?.apiKey && config.telephony.enabled)
    });
    return call;
  }

  async updateCall(context: RequestContext, callId: string, input: Record<string, unknown>) {
    const call = this.data.calls.find((entry) => entry.id === callId && entry.tenantId === context.tenantId);
    if (!call) {
      throw new ApiError(404, `Call not found: ${callId}`);
    }
    const statuses: CallStatus[] = ["queued", "ringing", "completed", "missed", "failed"];
    if (typeof input.status === "string" && (statuses as string[]).includes(input.status)) {
      call.status = input.status as CallStatus;
    }
    if (input.disposition !== undefined) {
      call.disposition =
        typeof input.disposition === "string" && input.disposition.trim() ? input.disposition.trim() : undefined;
    }
    if (input.notes !== undefined) {
      call.notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined;
    }
    if (input.recordingUrl !== undefined) {
      call.recordingUrl =
        typeof input.recordingUrl === "string" && input.recordingUrl.trim() ? input.recordingUrl.trim() : undefined;
    }
    call.updatedAt = nowIso();
    await this.persistence.saveCollection("calls", this.data.calls);
    await this.audit(context, "call.update", "call", call.id, call.patientId, {
      status: call.status,
      disposition: call.disposition
    });
    return call;
  }

  // ---- OPD walk-in Visit (encounter) ----------------------------------------

  /**
   * Phone-first intake prefill. Resolves a patient by normalized phone (with
   * their clinical record + recent visits), else the most recent matching lead,
   * else "none". Drives the OPD registration screen's "who is this?" lookup.
   */
  intakeLookup(context: RequestContext, phone: string) {
    const trimmed = typeof phone === "string" ? phone.trim() : "";
    if (!trimmed) {
      throw new ApiError(400, "Missing required query parameter: phone");
    }

    const patient = this.findPatientByPhone(context.tenantId, trimmed);
    if (patient && this.canAccessPatient(context, patient)) {
      const clinical = this.getClinicalRecord(context, patient.id);
      const recentVisits = this.data.visits
        .filter((visit) => visit.tenantId === context.tenantId && visit.patientId === patient.id)
        .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
        .slice(0, 5);
      // Today's still-open appointments — so OPD registration can reflect + link them.
      const today = nowIso().slice(0, 10);
      const todaysAppointments = this.data.appointments
        .filter(
          (a) =>
            a.tenantId === context.tenantId &&
            a.patientId === patient.id &&
            a.scheduledAt.slice(0, 10) === today &&
            ["scheduled", "confirmed", "rescheduled", "checked_in", "in_consult"].includes(a.status)
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .map((a) => {
          const d = this.decorateAppointment(context, a);
          return { id: d.id, scheduledAt: d.scheduledAt, doctorId: d.doctorId, doctorName: d.doctorName, specialty: d.specialty, status: d.status };
        });
      return {
        match: "patient" as const,
        patient: {
          id: patient.id,
          displayName: patient.displayName,
          age: patient.age,
          gender: patient.gender,
          primaryPhone: patient.primaryPhone,
          branchId: patient.branchId
        },
        todaysAppointments,
        clinical: {
          conditions: clinical.conditions,
          allergies: clinical.allergies ?? [],
          notes: clinical.notes
        },
        recentVisits
      };
    }

    const normalized = normalizePhone(trimmed);
    const lead = normalized
      ? this.data.leads
          .filter((entry) => entry.tenantId === context.tenantId && normalizePhone(entry.phone) === normalized)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    if (lead) {
      return {
        match: "lead" as const,
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          formData: lead.formData ?? {}
        }
      };
    }

    return { match: "none" as const };
  }

  listVisits(context: RequestContext, filters: { status?: string; patientId?: string; date?: string } = {}) {
    const day = typeof filters.date === "string" && filters.date.trim() ? filters.date.trim() : undefined;
    return this.data.visits
      .filter((visit) => visit.tenantId === context.tenantId)
      .filter((visit) => this.canAccessBranch(context, visit.branchId ?? "default-branch"))
      .filter((visit) => (filters.status ? visit.status === filters.status : true))
      .filter((visit) => (filters.patientId ? visit.patientId === filters.patientId : true))
      .filter((visit) => (day ? visit.registeredAt.slice(0, 10) === day : true))
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .map((visit) => this.visitView(context, visit));
  }

  getVisit(context: RequestContext, visitId: string) {
    return this.visitView(context, this.ensureVisibleVisit(context, visitId));
  }

  async createVisit(context: RequestContext, input: CreateVisitInput) {
    // Chief complaint is NO LONGER required at registration — the front desk just
    // captures identity; the nurse/doctor fills the reason during the encounter.
    const chiefComplaint = typeof input.chiefComplaint === "string" ? input.chiefComplaint.trim() : "";
    const visitType: VisitType = input.visitType === "appointment" ? "appointment" : "walk_in";

    // Resolve the patient: existing id, or create one (lead conversion best-effort).
    const patient = await this.resolveOrCreatePatient(context, {
      patientId: input.patientId,
      name: input.name,
      phone: input.phone,
      gender: input.gender,
      age: input.age,
      branchId: input.branchId
    });

    // Resolve the doctor (name + department) if a doctorId is given.
    let doctorId: string | undefined;
    let doctorName: string | undefined;
    let department: string | undefined =
      typeof input.department === "string" && input.department.trim() ? input.department.trim() : undefined;
    if (typeof input.doctorId === "string" && input.doctorId.trim()) {
      const doctor = this.ensureVisibleDoctor(context, input.doctorId.trim());
      doctorId = doctor.id;
      doctorName = doctor.displayName;
      department = department ?? doctor.specialty;
    }

    const intakeConditions = this.sanitizeConditions(input.intakeConditions);
    const intakeAllergies = this.sanitizeAllergies(input.intakeAllergies);
    const vitals = this.sanitizeVitals(input.vitals);

    // Merge intake conditions + allergies into the longitudinal clinical record.
    if (intakeConditions.length > 0 || intakeAllergies.length > 0) {
      await this.mergeClinicalIntake(context, patient.id, intakeConditions, intakeAllergies);
    }

    const timestamp = nowIso();
    const visit: Visit = {
      id: createId("visit"),
      tenantId: context.tenantId,
      patientId: patient.id,
      branchId: patient.branchId,
      visitType,
      doctorId,
      doctorName,
      department,
      status: "registered",
      chiefComplaint,
      intakeConditions: intakeConditions.length > 0 ? intakeConditions : undefined,
      intakeAllergies: intakeAllergies.length > 0 ? intakeAllergies : undefined,
      vitals,
      intakeNotes:
        typeof input.intakeNotes === "string" && input.intakeNotes.trim() ? input.intakeNotes.trim() : undefined,
      registeredBy: context.actorId,
      registeredAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.visits.push(visit);

    // Link this walk-in to an appointment — an explicit one chosen at registration,
    // else infer a scheduled/confirmed appointment for this patient + doctor today —
    // and mark it checked-in (they walked in). The appointment then auto-completes
    // when the visit is completed (see updateVisit).
    let linkedAppt: Appointment | undefined;
    if (typeof input.appointmentId === "string" && input.appointmentId.trim()) {
      linkedAppt = this.data.appointments.find(
        (a) => a.id === input.appointmentId!.trim() && a.tenantId === context.tenantId && a.patientId === visit.patientId
      );
    }
    if (!linkedAppt) {
      const dateISO = visit.registeredAt.slice(0, 10);
      linkedAppt = this.data.appointments.find(
        (a) =>
          a.tenantId === context.tenantId &&
          a.patientId === visit.patientId &&
          (a.status === "scheduled" || a.status === "confirmed") &&
          a.scheduledAt.slice(0, 10) === dateISO &&
          (!visit.doctorId || a.doctorId === visit.doctorId)
      );
    }
    if (linkedAppt && !["cancelled", "completed", "no_show"].includes(linkedAppt.status)) {
      visit.appointmentId = linkedAppt.id;
      // Adopt the appointment's doctor when the walk-in didn't name one.
      if (!visit.doctorId && linkedAppt.doctorId) {
        const doc = this.data.doctors.find((d) => d.id === linkedAppt!.doctorId && d.tenantId === context.tenantId);
        if (doc) {
          visit.doctorId = doc.id;
          visit.doctorName = doc.displayName;
          visit.department = visit.department ?? doc.specialty;
        }
      }
      if (linkedAppt.status !== "checked_in" && linkedAppt.status !== "in_consult") {
        linkedAppt.status = "checked_in";
        linkedAppt.updatedAt = nowIso();
        await this.persistence.saveCollection("appointments", this.data.appointments);
        await this.audit(context, "appointment.update", "appointment", linkedAppt.id, linkedAppt.patientId, {
          status: "checked_in",
          via: "opd"
        });
        // Drive any "Patient checked in" workflow stages.
        await this.signalWorkflowEvent(context, linkedAppt, "checked_in");
      }
    }

    await this.persistence.saveCollection("visits", this.data.visits);
    await this.audit(context, "visit.register", "visit", visit.id, visit.patientId, {
      visitType,
      doctorId,
      department
    });
    return this.visitView(context, visit);
  }

  /** Keep a visit's linked appointment in lock-step with the visit's status. */
  private async syncLinkedAppointment(context: RequestContext, visit: Visit): Promise<void> {
    if (!visit.appointmentId) return;
    const appt = this.data.appointments.find(
      (a) => a.id === visit.appointmentId && a.tenantId === context.tenantId
    );
    if (!appt || appt.status === "cancelled") return;
    const map: Record<VisitStatus, AppointmentStatus | undefined> = {
      registered: "checked_in",
      in_consult: "in_consult",
      completed: "completed",
      left_without_seen: "no_show"
    };
    const target = map[visit.status];
    if (target && appt.status !== target) {
      appt.status = target;
      appt.updatedAt = nowIso();
      await this.persistence.saveCollection("appointments", this.data.appointments);
      await this.audit(context, "appointment.update", "appointment", appt.id, appt.patientId, {
        status: target,
        via: "opd"
      });
      // Drive the workflow runtime off the visit-driven status change.
      if (target === "checked_in") await this.signalWorkflowEvent(context, appt, "checked_in");
      else if (target === "completed") await this.completeAppointmentRuns(context, appt);
      else if (target === "no_show") await this.closeAppointmentRuns(context, appt.id, "cancelled");
    }
  }

  async updateVisit(context: RequestContext, visitId: string, input: UpdateVisitInput) {
    const visit = this.ensureVisibleVisit(context, visitId);

    if (typeof input.doctorId === "string" && input.doctorId.trim()) {
      const doctor = this.ensureVisibleDoctor(context, input.doctorId.trim());
      visit.doctorId = doctor.id;
      visit.doctorName = doctor.displayName;
      visit.department = visit.department ?? doctor.specialty;
    }

    if (typeof input.chiefComplaint === "string") {
      visit.chiefComplaint = input.chiefComplaint.trim();
    }

    if (input.vitals !== undefined) {
      const vitals = this.sanitizeVitals(input.vitals);
      if (vitals) {
        visit.vitals = { ...(visit.vitals ?? {}), ...vitals };
      }
    }

    if (typeof input.consultNotes === "string") {
      visit.consultNotes = input.consultNotes.trim() ? input.consultNotes.trim() : undefined;
    }

    // Diagnosis: persist on the visit AND merge into the clinical record.
    if (input.diagnosis !== undefined) {
      const diagnosis = this.sanitizeConditions(input.diagnosis);
      visit.diagnosis = diagnosis.length > 0 ? diagnosis : undefined;
      if (diagnosis.length > 0) {
        await this.mergeClinicalIntake(context, visit.patientId, diagnosis, []);
      }
    }

    if (input.disposition !== undefined) {
      visit.disposition = this.sanitizeVisitDisposition(input.disposition) ?? visit.disposition;
    }

    if (typeof input.status === "string") {
      const statuses: VisitStatus[] = ["registered", "in_consult", "completed", "left_without_seen"];
      if ((statuses as string[]).includes(input.status)) {
        const next = input.status as VisitStatus;
        if (next === "in_consult" && !visit.consultedAt) {
          visit.consultedBy = context.actorId;
          visit.consultedAt = nowIso();
        }
        if (next === "completed" && !visit.disposition) {
          throw new ApiError(400, "A disposition is required to complete a visit");
        }
        if (next === "completed" && !visit.consultedAt) {
          visit.consultedBy = visit.consultedBy ?? context.actorId;
          visit.consultedAt = visit.consultedAt ?? nowIso();
        }
        visit.status = next;
      }
    }

    // OPD inference: advance the linked appointment to match (in_consult →
    // in_consult, completed → completed, left_without_seen → no_show).
    await this.syncLinkedAppointment(context, visit);

    visit.updatedAt = nowIso();
    await this.persistence.saveCollection("visits", this.data.visits);
    await this.audit(context, "visit.update", "visit", visit.id, visit.patientId, {
      status: visit.status,
      diagnosisCount: visit.diagnosis?.length ?? 0
    });
    return this.visitView(context, visit);
  }

  private ensureVisibleVisit(context: RequestContext, visitId: string): Visit {
    const visit = this.data.visits.find((entry) => entry.id === visitId && entry.tenantId === context.tenantId);
    if (!visit) {
      throw new ApiError(404, `Visit not found: ${visitId}`);
    }
    if (!this.canAccessBranch(context, visit.branchId ?? "default-branch")) {
      throw new ApiError(403, "Visit is outside the actor's branch scope");
    }
    return visit;
  }

  private visitView(context: RequestContext, visit: Visit) {
    const patient = this.data.patients.find(
      (entry) => entry.id === visit.patientId && entry.tenantId === context.tenantId
    );
    return { ...visit, patientName: patient?.displayName };
  }

  /** Union intake/diagnosis conditions (by icd10Code) + allergies (by string) into the clinical record. */
  private async mergeClinicalIntake(
    context: RequestContext,
    patientId: string,
    conditions: ClinicalCondition[],
    allergies: string[]
  ) {
    const current = this.getClinicalRecord(context, patientId);
    const mergedConditions = [...current.conditions];
    for (const condition of conditions) {
      if (!mergedConditions.some((entry) => entry.icd10Code === condition.icd10Code)) {
        mergedConditions.push(condition);
      }
    }
    const mergedAllergies = [...(current.allergies ?? [])];
    for (const allergy of allergies) {
      if (!mergedAllergies.includes(allergy)) {
        mergedAllergies.push(allergy);
      }
    }
    await this.setClinicalRecord(context, patientId, {
      conditions: mergedConditions,
      allergies: mergedAllergies,
      notes: current.notes
    });
  }

  private sanitizeAllergies(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set<string>();
    const allergies: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) {
        const trimmed = entry.trim();
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          allergies.push(trimmed);
        }
      }
    }
    return allergies;
  }

  private sanitizeVitals(value: unknown): VisitVitals | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    const vitals: VisitVitals = {};
    const str = (key: keyof VisitVitals) => {
      const raw = candidate[key];
      if (typeof raw === "string" && raw.trim()) {
        (vitals[key] as unknown) = raw.trim();
      }
    };
    const num = (key: keyof VisitVitals) => {
      const raw = candidate[key];
      const parsed = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
      if (Number.isFinite(parsed)) {
        (vitals[key] as unknown) = parsed;
      }
    };
    str("bp");
    num("pulseBpm");
    num("spo2");
    num("tempC");
    num("weightKg");
    num("heightCm");
    str("visualAcuityOD");
    str("visualAcuityOS");
    num("iopOD");
    num("iopOS");
    return Object.keys(vitals).length > 0 ? vitals : undefined;
  }

  private sanitizeVisitDisposition(value: unknown): VisitDisposition | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    const outcome = typeof candidate.outcome === "string" ? candidate.outcome.trim() : "";
    if (!outcome) {
      return undefined;
    }
    return {
      outcome,
      ...(typeof candidate.notes === "string" && candidate.notes.trim() ? { notes: candidate.notes.trim() } : {}),
      ...(typeof candidate.nextStep === "string" && candidate.nextStep.trim()
        ? { nextStep: candidate.nextStep.trim() }
        : {}),
      ...(typeof candidate.nextActionDate === "string" && candidate.nextActionDate.trim()
        ? { nextActionDate: candidate.nextActionDate.trim() }
        : {})
    };
  }

  // ---- Platform admin management (superadmin) -------------------------------

  private platformAdminView(admin: PlatformAdmin) {
    return {
      id: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      roles: admin.roles,
      status: admin.status,
      mfaEnabled: Boolean(admin.mfaEnabled),
      mustResetPassword: Boolean(admin.mustResetPassword),
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt
    };
  }

  listPlatformAdmins() {
    return this.data.platformAdmins
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((entry) => this.platformAdminView(entry));
  }

  async createPlatformAdmin(context: RequestContext, input: Record<string, unknown>) {
    const displayName = ensureString(input.displayName, "displayName");
    const email = ensureString(input.email, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ApiError(400, "A valid email is required.");
    }
    if (this.emailTaken(email)) {
      throw new ApiError(409, "That email is already in use.");
    }
    const tempPassword = typeof input.password === "string" && input.password.length >= 8 ? input.password : generateTempPassword();
    const cred = hashPassword(tempPassword);
    const admin: PlatformAdmin = {
      id: createId("padmin"),
      email,
      displayName,
      roles: ["platform_admin"],
      status: "active",
      passwordHash: cred.hash,
      passwordSalt: cred.salt,
      credentialVersion: 0,
      mustResetPassword: true,
      createdAt: nowIso()
    };
    this.data.platformAdmins.push(admin);
    await this.persistence.saveCollection("platformAdmins", this.data.platformAdmins);
    await this.auditAuth("platform_admin.create", "platform", admin, undefined, { byAdmin: context.actorId, email });
    await this.email.send(inviteEmail(admin.email, `${this.appBaseUrl("platform")}/login`, tempPassword));
    return { admin: this.platformAdminView(admin), tempPassword };
  }

  async updatePlatformAdmin(context: RequestContext, adminId: string, input: Record<string, unknown>) {
    const admin = this.data.platformAdmins.find((entry) => entry.id === adminId);
    if (!admin) {
      throw new ApiError(404, `Platform admin not found: ${adminId}`);
    }
    if (admin.id === context.actorId && input.status && input.status !== "active") {
      throw new ApiError(400, "You cannot deactivate your own account.");
    }
    if (typeof input.displayName === "string" && input.displayName.trim()) {
      admin.displayName = input.displayName.trim();
    }
    if (input.status === "active" || input.status === "inactive" || input.status === "suspended") {
      if (input.status !== "active" && admin.status === "active") {
        admin.credentialVersion += 1;
      }
      admin.status = input.status;
    }
    await this.persistence.saveCollection("platformAdmins", this.data.platformAdmins);
    await this.auditAuth("platform_admin.update", "platform", admin, undefined, { byAdmin: context.actorId, status: admin.status });
    return { admin: this.platformAdminView(admin) };
  }

  // ---- Platform tier (HealthOS superadmin) ----------------------------------

  listPlans() {
    return PLAN_CATALOG;
  }

  listModules() {
    return MODULE_CATALOG;
  }

  private tenantView(org: Organization) {
    const seats = this.tenantSeatUsage(org.id);
    return {
      id: org.id,
      displayName: org.displayName,
      type: org.type,
      status: org.status,
      planId: org.planId,
      moduleOverrides: org.moduleOverrides ?? {},
      enabledModules: resolveEnabledModules(org.planId, org.moduleOverrides),
      seatLimit: seats.limit,
      seatsUsed: seats.used,
      mfaPolicy: org.mfaPolicy ?? "optional",
      branchCount: this.data.branches.filter((entry) => entry.tenantId === org.id).length,
      userCount: this.data.users.filter((entry) => entry.tenantId === org.id).length,
      createdAt: org.createdAt
    };
  }

  listTenants() {
    return this.data.organizations
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((org) => this.tenantView(org));
  }

  getTenant(tenantId: string) {
    const org = this.data.organizations.find((entry) => entry.id === tenantId);
    if (!org) {
      throw new ApiError(404, `Tenant not found: ${tenantId}`);
    }
    return {
      ...this.tenantView(org),
      branches: this.data.branches
        .filter((entry) => entry.tenantId === org.id)
        .map((entry) => ({ id: entry.id, displayName: entry.displayName, city: entry.city, status: entry.status })),
      admins: this.data.users
        .filter((entry) => entry.tenantId === org.id && entry.roles.includes("org_admin"))
        .map((entry) => ({ id: entry.id, displayName: entry.displayName, email: entry.email }))
    };
  }

  async createTenant(context: RequestContext, input: Record<string, unknown>) {
    const displayName = ensureString(input.displayName, "displayName");
    const type = (input.type === "clinic" ? "clinic" : "hospital") as TenantType;
    const planId: PlanId = isPlanId(input.planId) ? input.planId : DEFAULT_PLAN_ID;
    const branchName = ensureString(input.branchName, "branchName");
    const adminName = ensureString(input.adminName, "adminName");
    const adminEmail = ensureString(input.adminEmail, "adminEmail").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      throw new ApiError(400, "A valid admin email is required.");
    }
    if (this.emailTaken(adminEmail)) {
      throw new ApiError(409, "That admin email is already in use.");
    }
    const branchCity = typeof input.branchCity === "string" ? input.branchCity : "";
    const moduleOverrides = sanitizeModuleOverrides(input.moduleOverrides);
    const adminPassword =
      typeof input.adminPassword === "string" && input.adminPassword.length >= 8 ? input.adminPassword : generateTempPassword();
    const adminCred = hashPassword(adminPassword);
    const timestamp = nowIso();

    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "tenant";
    const tenantId = `org_${slug}_${randomUUID().slice(0, 6)}`;

    const org: Organization = {
      id: tenantId,
      displayName,
      status: "active",
      type,
      planId,
      ...(moduleOverrides ? { moduleOverrides } : {}),
      createdAt: timestamp
    };
    const branch: Branch = {
      id: `branch_${slug}_${randomUUID().slice(0, 6)}`,
      tenantId,
      displayName: branchName,
      city: branchCity,
      status: "active",
      createdAt: timestamp
    };
    const admin: User = {
      id: `user_${slug}_admin_${randomUUID().slice(0, 6)}`,
      tenantId,
      displayName: adminName,
      email: adminEmail,
      roles: ["org_admin"],
      branchIds: [branch.id],
      status: "active",
      passwordHash: adminCred.hash,
      passwordSalt: adminCred.salt,
      credentialVersion: 0,
      mustResetPassword: true,
      createdAt: timestamp
    };

    this.data.organizations.push(org);
    this.data.branches.push(branch);
    this.data.users.push(admin);
    await this.persistence.saveCollection("organizations", this.data.organizations);
    await this.persistence.saveCollection("branches", this.data.branches);
    await this.persistence.saveCollection("users", this.data.users);
    await this.audit(context, "tenant.create", "tenant", tenantId, undefined, {
      displayName,
      type,
      planId,
      branchId: branch.id,
      adminId: admin.id
    });
    // Email the new hospital admin their sign-in + temporary password.
    await this.email.send(inviteEmail(adminEmail, `${this.appBaseUrl("staff")}/login`, adminPassword));

    return { ...this.getTenant(tenantId), adminCredentials: { email: adminEmail, tempPassword: adminPassword } };
  }

  async updateTenant(context: RequestContext, tenantId: string, input: Record<string, unknown>) {
    const org = this.data.organizations.find((entry) => entry.id === tenantId);
    if (!org) {
      throw new ApiError(404, `Tenant not found: ${tenantId}`);
    }
    if (isPlanId(input.planId)) {
      org.planId = input.planId;
    }
    if (input.status === "active" || input.status === "inactive" || input.status === "suspended") {
      org.status = input.status;
    }
    if (input.type === "hospital" || input.type === "clinic") {
      org.type = input.type;
    }
    if (typeof input.displayName === "string" && input.displayName.trim()) {
      org.displayName = input.displayName.trim();
    }
    if (input.moduleOverrides !== undefined) {
      const overrides = sanitizeModuleOverrides(input.moduleOverrides);
      if (overrides) org.moduleOverrides = overrides;
      else delete org.moduleOverrides;
    }
    if (input.seatLimitOverride === null || typeof input.seatLimitOverride === "number") {
      org.seatLimitOverride = input.seatLimitOverride;
    }
    if (input.mfaPolicy === "optional" || input.mfaPolicy === "required") {
      org.mfaPolicy = input.mfaPolicy;
    }
    await this.persistence.saveCollection("organizations", this.data.organizations);
    await this.audit(context, "tenant.update", "tenant", tenantId, undefined, {
      planId: org.planId,
      status: org.status,
      moduleOverrides: org.moduleOverrides ?? {}
    });
    return this.getTenant(tenantId);
  }

  getStaffDashboard(context: RequestContext) {
    const patients = this.tenantPatients(context);
    const tasks = this.listWorkbenchTasks(context, {}).filter((task) => task.status !== "completed");
    const interactions = this.listInteractions(context, {});
    const appointments = this.listAppointments(context, {});
    const followUps = this.data.followUps.filter(
      (entry) => entry.tenantId === context.tenantId && this.canAccessPatientId(context, entry.patientId)
    );
    const primaryPatient = patients[0];
    const primarySummary = primaryPatient ? this.summarizePatient(context, primaryPatient) : undefined;
    const branch = this.data.branches.find((entry) => entry.id === primaryPatient?.branchId) ?? this.data.branches[0];
    const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const now = Date.now();
    const tenant = this.data.organizations.find((entry) => entry.id === context.tenantId);
    const enabledModules: ModuleKey[] = tenant
      ? resolveEnabledModules(tenant.planId, tenant.moduleOverrides)
      : MODULE_CATALOG.map((entry) => entry.key);

    const sessionUser =
      context.source === "staff_session"
        ? {
            id: context.actorId,
            displayName: context.displayName,
            roles: context.roles,
            email: this.data.users.find((entry) => entry.id === context.actorId)?.email ?? null
          }
        : null;

    return {
      generatedAt: nowIso(),
      source: "core-api",
      entitlements: { planId: tenant?.planId ?? null, enabledModules },
      sessionUser,
      metrics: [
        {
          label: "Open work items",
          value: String(tasks.length),
          delta: `${tasks.filter((task) => ["urgent", "high"].includes(task.priority)).length} high priority`,
          tone: tasks.some((task) => task.priority === "urgent") ? "risk" : "watch"
        },
        {
          label: "Today bookings",
          value: String(appointments.filter((entry) => entry.status === "scheduled").length),
          delta: "scheduled appointments",
          tone: "good"
        },
        {
          label: "No-show risk",
          value: String(appointments.filter((entry) => ["urgent", "high"].includes(entry.noShowRisk ?? "low")).length),
          delta: "need confirmation",
          tone: "risk"
        },
        {
          label: "Follow-ups due",
          value: String(followUps.filter((entry) => entry.status === "due").length),
          delta: `${followUps.filter((entry) => new Date(entry.dueAt).getTime() < now).length} overdue`,
          tone: "watch"
        }
      ],
      workbench: tasks
        .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || a.dueAt.localeCompare(b.dueAt))
        .slice(0, 8)
        .map((task) => ({
          id: task.id,
          priority: staffPriority(task.priority),
          owner: formatRoleLabel(task.ownerRole),
          patient: task.patient?.displayName ?? "Unlinked patient",
          summary: task.title,
          due: formatDue(task.dueAt),
          reason: task.reason
        })),
      inbox: interactions.slice(0, 8).map((interaction) => ({
        id: interaction.id,
        channel: staffChannel(interaction.channel),
        patient: patientName(this.data.patients, interaction.patientId),
        preview: interaction.body,
        intent: interaction.intent ?? interaction.subject,
        status: staffInteractionStatus(interaction.status),
        age: formatAge(interaction.receivedAt),
        assignee: interaction.createdTaskIds.length ? "Assigned" : "Unassigned"
      })),
      patient360: primarySummary
        ? {
            id: primarySummary.id,
            name: primarySummary.displayName,
            age: primarySummary.age ?? 0,
            gender: primarySummary.gender ?? "unknown",
            phone: maskPhone(primarySummary.primaryPhone),
            caregiver: primarySummary.caregivers[0]?.displayName ?? "Self",
            language: primarySummary.preferredLanguage ?? "Not set",
            branch: branch?.displayName ?? primarySummary.branchId,
            doctor: appointments.find((entry) => entry.patientId === primarySummary.id)?.doctorName ?? "Care team",
            condition: primarySummary.tags[0] ?? "Care journey",
            risk: staffPriority(appointments.find((entry) => entry.patientId === primarySummary.id)?.noShowRisk ?? "medium"),
            nextBestAction: tasks.find((task) => task.patientId === primarySummary.id)?.recommendedAction ?? "Review patient context.",
            openItems: tasks.filter((task) => task.patientId === primarySummary.id).map((task) => task.title),
            household: primarySummary.household ? this.staffHouseholdView(context, primarySummary.household) : undefined,
            timeline: this.staffPatientTimeline(context, primarySummary.id)
          }
        : emptyPatientSummary(),
      accessQueue: appointments.slice(0, 6).map((appointment) => ({
        id: appointment.id,
        patient: patientName(this.data.patients, appointment.patientId),
        request: appointment.reason,
        branch: this.data.branches.find((entry) => entry.id === appointment.branchId)?.displayName ?? appointment.branchId,
        doctor: appointment.doctorName,
        slot: formatDue(appointment.scheduledAt),
        risk: staffPriority(appointment.noShowRisk ?? "medium"),
        blocker: appointment.status === "confirmed" ? "Confirmed" : "Awaiting confirmation"
      })),
      followUpQueue: followUps.slice(0, 6).map((followUp) => ({
        id: followUp.id,
        patient: patientName(this.data.patients, followUp.patientId),
        journey: followUp.title,
        stage: followUp.status,
        due: formatDue(followUp.dueAt),
        owner: "Care coordinator",
        risk: new Date(followUp.dueAt).getTime() < now ? "high" : "medium",
        nextStep: followUp.instructions
      })),
      serviceStatus: [
        {
          name: "core-api",
          health: "online",
          detail: "Governed staff dashboard and actions are available.",
          latency: "local",
          authMode: context.source,
          scope: context.tenantId
        },
        {
          name: "workflow-worker",
          health: this.outbound.workflow.isConfigured ? "online" : "degraded",
          detail: this.outbound.workflow.isConfigured ? "Workflow dispatch configured." : "Workflow dispatch not configured.",
          latency: "best effort",
          authMode: "service scoped",
          scope: context.tenantId
        }
      ],
      auditEvents: this.staffAuditEvents(context).slice(0, 8)
    };
  }

  async listAuditEvents(context: RequestContext, filters: { patientId?: string; action?: string }) {
    this.ensurePermission(context, "audit:read");
    return this.data.auditEvents
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) {
          return false;
        }
        if (filters.patientId && entry.patientId !== filters.patientId) {
          return false;
        }
        if (entry.patientId && !this.canAccessPatientId(context, entry.patientId)) {
          return false;
        }
        if (filters.action && entry.action !== filters.action) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listPatients(context: RequestContext) {
    return this.tenantPatients(context).map((patient) => this.summarizePatient(context, patient));
  }

  listHouseholds(context: RequestContext) {
    return this.visibleHouseholds(context).map((household) => this.householdView(context, household));
  }

  getHousehold(context: RequestContext, householdId: string) {
    const household = this.data.households.find((entry) => entry.id === householdId && entry.tenantId === context.tenantId);
    if (!household) {
      throw new ApiError(404, `Household not found: ${householdId}`);
    }
    if (!this.canAccessHousehold(context, household)) {
      throw new ApiError(403, "Household is outside the actor's branch scope");
    }
    return this.householdView(context, household);
  }

  async createPatient(context: RequestContext, input: CreatePatientInput) {
    const timestamp = nowIso();
    const patient: Patient = {
      id: createId("patient"),
      tenantId: context.tenantId,
      householdId: input.householdId,
      displayName: ensureString(input.displayName, "displayName"),
      age: input.age,
      gender: input.gender ?? "unknown",
      primaryPhone: input.primaryPhone,
      preferredLanguage: input.preferredLanguage ?? "English",
      branchId: input.branchId ?? "default-branch",
      identityStatus: "unverified",
      tags: input.tags ?? [],
      caregivers: [],
      consent: {
        communications: "unknown",
        aiProcessing: "unknown",
        documentSharing: "unknown"
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (patient.householdId) {
      const household = this.data.households.find((entry) => entry.id === patient.householdId && entry.tenantId === context.tenantId);
      if (!household) {
        throw new ApiError(404, `Household not found: ${patient.householdId}`);
      }
      if (!this.canAccessHousehold(context, household)) {
        throw new ApiError(403, "Cannot create a patient inside a household outside the actor's branch scope");
      }
    }
    if (!this.canAccessBranch(context, patient.branchId)) {
      throw new ApiError(403, "Cannot create a patient outside the actor's branch scope");
    }
    this.data.patients.push(patient);
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.audit(context, "patient.create", "patient", patient.id, patient.id, {
      branchId: patient.branchId,
      source: "core-api"
    });
    return this.summarizePatient(context, patient);
  }

  async getPatient(context: RequestContext, patientId: string) {
    const patient = this.ensureKnownPatient(context, patientId);
    await this.audit(context, "patient.view", "patient", patient.id, patient.id);
    return {
      ...this.summarizePatient(context, patient),
      lifecycle: this.patientLifecycle(context, patient.id)
    };
  }

  /**
   * Where the patient currently sits in the visit funnel:
   * Scheduled → Checked-in → In-consult → OPD Done (completed) → Disposition,
   * or Missed (no_show). Derived from the patient's latest appointment.
   */
  private patientLifecycle(context: RequestContext, patientId: string) {
    const appointments = this.data.appointments
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    const latest = appointments[0];

    const stageFor = (status?: Appointment["status"]): string => {
      switch (status) {
        case "scheduled":
        case "confirmed":
        case "rescheduled":
          return "scheduled";
        case "checked_in":
          return "checked_in";
        case "in_consult":
          return "in_consult";
        case "completed":
          return "opd_done";
        case "no_show":
          return "missed";
        case "cancelled":
          return "cancelled";
        default:
          return "no_visit";
      }
    };

    // Most recent completed visit = last visit date.
    const lastVisit = appointments.find((entry) => entry.status === "completed");
    // Open next action: a disposition's nextStep, or the next upcoming appointment.
    const upcoming = appointments
      .filter((entry) => ["scheduled", "confirmed", "rescheduled", "checked_in", "in_consult"].includes(entry.status))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

    return {
      stage: stageFor(latest?.status),
      latestAppointmentId: latest?.id,
      latestStatus: latest?.status,
      lastVisitAt: lastVisit?.scheduledAt,
      lastDisposition: lastVisit?.disposition,
      openNextAction: lastVisit?.disposition?.nextStep
        ? {
            description: lastVisit.disposition.nextStep,
            dueAt: lastVisit.disposition.nextActionDate
          }
        : upcoming
          ? { description: `Upcoming: ${upcoming.reason}`, dueAt: upcoming.scheduledAt }
          : undefined
    };
  }

  async getPatientTimeline(context: RequestContext, patientId: string) {
    this.ensureKnownPatient(context, patientId);
    await this.audit(context, "patient.view", "patient", patientId, patientId, { surface: "timeline" });
    const events: TimelineEvent[] = [
      ...this.data.interactions
        .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
        .map((entry) => ({
          id: `timeline_${entry.id}`,
          patientId,
          occurredAt: entry.receivedAt,
          type: "interaction" as const,
          title: entry.subject,
          description: `${entry.channel} ${entry.direction}: ${entry.body}`,
          sourceId: entry.id
        })),
      ...this.data.appointments
        .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
        .map((raw) => {
          // Resolve doctor name/specialty from the live record (stored copy may be stale).
          const entry = this.decorateAppointment(context, raw);
          return {
            id: `timeline_${entry.id}`,
            patientId,
            occurredAt: entry.scheduledAt,
            type: "appointment" as const,
            title: `${entry.specialty} appointment`,
            description: `${entry.status} with ${entry.doctorName}: ${entry.reason}`,
            sourceId: entry.id
          };
        }),
      ...this.data.tasks
        .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
        .map((entry) => ({
          id: `timeline_${entry.id}`,
          patientId,
          occurredAt: entry.createdAt,
          type: "task" as const,
          title: entry.title,
          description: `${entry.priority} task for ${entry.ownerRole}: ${entry.recommendedAction}`,
          sourceId: entry.id
        })),
      ...this.data.documents
        .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
        .map((entry) => ({
          id: `timeline_${entry.id}`,
          patientId,
          occurredAt: entry.createdAt,
          type: "document" as const,
          title: entry.fileName,
          description: `${entry.documentType} metadata captured with status ${entry.storageStatus}`,
          sourceId: entry.id
        })),
      ...this.data.followUps
        .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
        .map((entry) => ({
          id: `timeline_${entry.id}`,
          patientId,
          occurredAt: entry.updatedAt,
          type: "follow_up" as const,
          title: entry.title,
          description: `${entry.status}: ${entry.instructions}`,
          sourceId: entry.id
        }))
    ];

    return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  listInteractions(context: RequestContext, filters: { status?: string; patientId?: string }) {
    return this.data.interactions.filter((entry) => {
      if (entry.tenantId !== context.tenantId) {
        return false;
      }
      if (entry.patientId && !this.canAccessPatientId(context, entry.patientId)) {
        return false;
      }
      if (filters.status && entry.status !== filters.status) {
        return false;
      }
      if (filters.patientId && entry.patientId !== filters.patientId) {
        return false;
      }
      return true;
    });
  }

  async createInteraction(context: RequestContext, input: CreateInteractionInput) {
    const timestamp = nowIso();
    if (input.patientId) {
      this.ensureKnownPatient(context, input.patientId);
    }

    const interaction: Interaction = {
      id: createId("interaction"),
      tenantId: context.tenantId,
      patientId: input.patientId,
      channel: input.channel ?? "staff_note",
      direction: input.direction ?? "inbound",
      status: input.patientId ? "linked" : "new",
      subject: ensureString(input.subject, "subject"),
      body: ensureString(input.body, "body"),
      from: input.from,
      to: input.to,
      language: input.language,
      intent: input.intent,
      urgency: asPriority(input.urgency),
      receivedAt: timestamp,
      createdTaskIds: []
    };

    if (input.createTask) {
      const task = this.createTaskFromInteraction(context, interaction);
      interaction.createdTaskIds.push(task.id);
      await this.persistence.saveCollection("tasks", this.data.tasks);
    }

    this.data.interactions.push(interaction);
    await this.persistence.saveCollection("interactions", this.data.interactions);
    await this.audit(context, "interaction.create", "interaction", interaction.id, interaction.patientId, {
      channel: interaction.channel,
      intent: interaction.intent,
      createdTaskIds: interaction.createdTaskIds
    });
    return interaction;
  }

  listInbox(context: RequestContext) {
    const visible = (entry: Interaction) =>
      entry.tenantId === context.tenantId && (!entry.patientId || this.canAccessPatientId(context, entry.patientId));
    const thread = (entry: Interaction) => this.inboxThreadView(context, entry);
    return {
      new: this.data.interactions.filter((entry) => visible(entry) && entry.status === "new").map(thread),
      triaged: this.data.interactions.filter((entry) => visible(entry) && entry.status === "triaged").map(thread),
      linked: this.data.interactions.filter((entry) => visible(entry) && entry.status === "linked").map(thread)
    };
  }

  listWorkbenchTasks(context: RequestContext, filters: { status?: string; ownerRole?: string; patientId?: string }) {
    return this.data.tasks
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) {
          return false;
        }
        if (entry.patientId && !this.canAccessPatientId(context, entry.patientId)) {
          return false;
        }
        if (filters.status && entry.status !== filters.status) {
          return false;
        }
        if (filters.ownerRole && entry.ownerRole !== filters.ownerRole) {
          return false;
        }
        if (filters.patientId && entry.patientId !== filters.patientId) {
          return false;
        }
        return true;
      })
      .map((task) => this.taskView(context, task))
      .sort((a, b) => {
        const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueAt.localeCompare(b.dueAt);
      });
  }

  async updateTask(context: RequestContext, taskId: string, input: UpdateTaskInput) {
    const task = this.data.tasks.find((entry) => entry.id === taskId && entry.tenantId === context.tenantId);
    if (!task) {
      throw new ApiError(404, `Task not found: ${taskId}`);
    }
    if (task.patientId && !this.canAccessPatientId(context, task.patientId)) {
      throw new ApiError(403, "Task is outside the actor's branch scope");
    }
    if (input.status) {
      task.status = input.status;
      task.completedAt = input.status === "completed" ? nowIso() : undefined;
    }
    if (input.ownerRole) {
      task.ownerRole = input.ownerRole;
    }
    if (input.outcome !== undefined) {
      task.outcome = input.outcome;
    }
    task.updatedAt = nowIso();
    await this.persistence.saveCollection("tasks", this.data.tasks);
    await this.audit(context, "task.update", "task", task.id, task.patientId, {
      status: task.status,
      ownerRole: task.ownerRole,
      outcome: task.outcome
    });
    return this.taskView(context, task);
  }

  async assignInteraction(context: RequestContext, interactionId: string, input: AssignInteractionInput) {
    const interaction = this.data.interactions.find((entry) => entry.id === interactionId && entry.tenantId === context.tenantId);
    if (!interaction) {
      throw new ApiError(404, `Interaction not found: ${interactionId}`);
    }
    if (interaction.patientId && !this.canAccessPatientId(context, interaction.patientId)) {
      throw new ApiError(403, "Interaction is outside the actor's branch scope");
    }

    interaction.status = "triaged";
    interaction.assignedToRole = input.ownerRole ?? interaction.assignedToRole;
    interaction.assignedToUserId = input.assignedToUserId ?? interaction.assignedToUserId ?? context.actorId;
    let task: WorkbenchTask | undefined;
    if (input.createTask !== false) {
      task = this.createTaskFromInteraction(context, interaction, input.ownerRole);
      interaction.createdTaskIds.push(task.id);
      await this.persistence.saveCollection("tasks", this.data.tasks);
    }

    await this.persistence.saveCollection("interactions", this.data.interactions);
    await this.audit(context, "interaction.assign", "interaction", interaction.id, interaction.patientId, {
      ownerRole: input.ownerRole ?? task?.ownerRole,
      createdTaskId: task?.id
    });

    return {
      interaction,
      task: task ? this.taskView(context, task) : undefined
    };
  }

  getInboxThread(context: RequestContext, interactionId: string) {
    const interaction = this.ensureVisibleInteraction(context, interactionId);
    return this.inboxThreadView(context, interaction);
  }

  async updateInboxThread(context: RequestContext, interactionId: string, input: UpdateInteractionInput) {
    const interaction = this.ensureVisibleInteraction(context, interactionId);
    if (input.patientId) {
      this.ensureKnownPatient(context, input.patientId);
      interaction.patientId = input.patientId;
      interaction.status = "linked";
    }
    if (input.status) {
      interaction.status = input.status;
    }
    if (input.linkedResourceId) {
      interaction.linkedResourceIds = [...new Set([...(interaction.linkedResourceIds ?? []), input.linkedResourceId])];
    }
    await this.persistence.saveCollection("interactions", this.data.interactions);
    await this.audit(context, "interaction.update", "interaction", interaction.id, interaction.patientId, {
      status: interaction.status,
      patientId: interaction.patientId,
      linkedResourceIds: interaction.linkedResourceIds
    });
    return this.inboxThreadView(context, interaction);
  }

  async addInboxThreadNote(context: RequestContext, interactionId: string, input: AddThreadNoteInput) {
    const interaction = this.ensureVisibleInteraction(context, interactionId);
    const note = {
      id: createId("note"),
      authorId: context.actorId,
      authorDisplayName: context.displayName,
      body: ensureString(input.body, "body"),
      visibility: input.visibility ?? "internal",
      createdAt: nowIso()
    };
    interaction.notes = [...(interaction.notes ?? []), note];
    await this.persistence.saveCollection("interactions", this.data.interactions);
    await this.audit(context, "interaction.update", "interaction", interaction.id, interaction.patientId, {
      action: "note.add",
      noteId: note.id
    });
    return this.inboxThreadView(context, interaction);
  }

  async upsertInboxThreadDraft(context: RequestContext, interactionId: string, input: UpsertDraftInput) {
    const interaction = this.ensureVisibleInteraction(context, interactionId);
    const timestamp = nowIso();
    const drafts = interaction.drafts ?? [];
    const existing = input.draftId ? drafts.find((draft) => draft.id === input.draftId) : undefined;
    if (existing) {
      existing.channel = input.channel ?? existing.channel;
      existing.body = input.body ?? existing.body;
      existing.status = input.status ?? existing.status;
      existing.updatedAt = timestamp;
    } else {
      drafts.push({
        id: createId("draft"),
        authorId: context.actorId,
        authorDisplayName: context.displayName,
        channel: input.channel ?? interaction.channel,
        body: ensureString(input.body, "body"),
        status: input.status ?? "draft",
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    interaction.drafts = drafts;
    await this.persistence.saveCollection("interactions", this.data.interactions);
    await this.audit(context, "interaction.update", "interaction", interaction.id, interaction.patientId, {
      action: "draft.upsert",
      draftId: input.draftId ?? drafts[drafts.length - 1]?.id
    });
    return this.inboxThreadView(context, interaction);
  }

  searchIdentities(context: RequestContext, filters: IdentitySearchInput) {
    const query = filters.query?.trim().toLowerCase();
    const phone = normalizePhone(filters.phone);
    const patients = this.tenantPatients(context)
      .map((patient) => ({
        patient: this.summarizePatient(context, patient),
        matchScore: this.identityScore(patient, { query, phone, uhid: filters.uhid, abhaId: filters.abhaId }),
        matchedOn: this.identityMatchedOn(patient, { query, phone, uhid: filters.uhid, abhaId: filters.abhaId })
      }))
      .filter((candidate) => candidate.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || a.patient.displayName.localeCompare(b.patient.displayName));

    return {
      candidates: patients,
      query: {
        query: filters.query,
        phone: filters.phone,
        uhid: filters.uhid,
        abhaId: filters.abhaId
      }
    };
  }

  listIdentityMatchCandidates(context: RequestContext, filters: { interactionId?: string; phone?: string; patientId?: string }) {
    const interaction = filters.interactionId ? this.ensureVisibleInteraction(context, filters.interactionId) : undefined;
    const sourcePatient = filters.patientId ? this.ensureKnownPatient(context, filters.patientId) : undefined;
    return this.searchIdentities(context, {
      query: sourcePatient?.displayName ?? interaction?.from ?? interaction?.subject,
      phone: filters.phone ?? sourcePatient?.primaryPhone ?? interaction?.from
    });
  }

  async resolveIdentity(context: RequestContext, input: ResolveIdentityInput) {
    const patient = this.ensureKnownPatient(context, ensureString(input.patientId, "patientId"));
    if (input.interactionId) {
      const interaction = this.ensureVisibleInteraction(context, input.interactionId);
      interaction.patientId = patient.id;
      interaction.status = "linked";
      interaction.linkedResourceIds = [...new Set([...(interaction.linkedResourceIds ?? []), patient.id])];
      await this.persistence.saveCollection("interactions", this.data.interactions);
    }
    if (input.householdId) {
      this.linkPatientToHousehold(context, patient, {
        householdId: input.householdId,
        relationship: "self",
        primaryContact: false
      });
      await this.persistence.saveCollection("households", this.data.households);
    }
    patient.identityStatus = input.identityStatus ?? "verified";
    patient.updatedAt = nowIso();
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.audit(context, "patient.identity_resolve", "patient", patient.id, patient.id, {
      interactionId: input.interactionId,
      householdId: input.householdId,
      identityStatus: patient.identityStatus
    });
    return this.summarizePatient(context, patient);
  }

  async updatePatientHousehold(context: RequestContext, patientId: string, input: UpdateHouseholdLinkInput) {
    const patient = this.ensureKnownPatient(context, patientId);
    const household = this.linkPatientToHousehold(context, patient, input);
    patient.updatedAt = nowIso();
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.persistence.saveCollection("households", this.data.households);
    await this.audit(context, "household.update", "household", household.id, patient.id, {
      patientId,
      relationship: input.relationship,
      primaryContact: input.primaryContact
    });
    return {
      patient: this.summarizePatient(context, patient),
      household: this.householdView(context, household)
    };
  }

  async upsertHouseholdCaregiver(context: RequestContext, householdId: string, input: UpsertCaregiverInput) {
    const household = this.ensureVisibleHousehold(context, householdId);
    const timestamp = nowIso();
    const caregiverId = input.caregiverId ?? createId("caregiver");
    const existing = household.caregiverPermissions.find((entry) => entry.caregiverId === caregiverId);
    const caregiver: HouseholdCaregiverPermission = existing ?? {
      caregiverId,
      caregiverName: ensureString(input.caregiverName ?? input.displayName, "caregiverName"),
      relationship: input.relationship ?? "caregiver",
      phone: input.phone,
      consentStatus: input.consentStatus ?? "unknown",
      permissions: input.permissions ?? ["receive_reminders"]
    };
    caregiver.caregiverName = input.caregiverName ?? input.displayName ?? caregiver.caregiverName;
    caregiver.relationship = input.relationship ?? caregiver.relationship;
    caregiver.phone = input.phone ?? caregiver.phone;
    caregiver.consentStatus = input.consentStatus ?? caregiver.consentStatus;
    caregiver.permissions = input.permissions ?? caregiver.permissions;
    if (!existing) {
      household.caregiverPermissions.push(caregiver);
    }
    for (const member of household.members) {
      const patient = this.data.patients.find((entry) => entry.id === member.patientId && entry.tenantId === context.tenantId);
      if (!patient || !this.canAccessPatient(context, patient)) continue;
      const patientCaregiver = patient.caregivers.find((entry) => entry.id === caregiver.caregiverId);
      const nextCaregiver: Caregiver = {
        id: caregiver.caregiverId,
        displayName: caregiver.caregiverName,
        relationship: caregiver.relationship,
        phone: caregiver.phone ?? "",
        consentStatus: caregiver.consentStatus
      };
      if (patientCaregiver) {
        Object.assign(patientCaregiver, nextCaregiver);
      } else {
        patient.caregivers.push(nextCaregiver);
      }
      patient.updatedAt = timestamp;
    }
    household.updatedAt = timestamp;
    await this.persistence.saveCollection("households", this.data.households);
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.audit(context, "household.update", "household", household.id, undefined, {
      caregiverId: caregiver.caregiverId
    });
    return this.householdView(context, household);
  }

  listAccessRequests(context: RequestContext, filters: { status?: string; patientId?: string }) {
    return this.data.accessRequests
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) return false;
        if (entry.patientId && !this.canAccessPatientId(context, entry.patientId)) return false;
        if (entry.requestedBranchId && !this.canAccessBranch(context, entry.requestedBranchId)) return false;
        if (filters.status && entry.status !== filters.status) return false;
        if (filters.patientId && entry.patientId !== filters.patientId) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getAccessRequest(context: RequestContext, accessRequestId: string) {
    return this.ensureVisibleAccessRequest(context, accessRequestId);
  }

  async createAccessRequest(context: RequestContext, input: CreateAccessRequestInput) {
    const timestamp = nowIso();
    const patient = input.patientId ? this.ensureKnownPatient(context, input.patientId) : undefined;
    const interaction = input.interactionId ? this.ensureVisibleInteraction(context, input.interactionId) : undefined;
    const requestedBranchId = input.requestedBranchId ?? patient?.branchId;
    if (requestedBranchId && !this.canAccessBranch(context, requestedBranchId)) {
      throw new ApiError(403, "Cannot create an access request outside the actor's branch scope");
    }
    const request: AccessRequest = {
      id: createId("access"),
      tenantId: context.tenantId,
      patientId: patient?.id,
      householdId: patient?.householdId,
      interactionId: interaction?.id,
      requesterName: input.requesterName ?? patient?.displayName,
      requesterPhone: input.requesterPhone ?? patient?.primaryPhone ?? interaction?.from,
      requestedSpecialty: input.requestedSpecialty,
      requestedBranchId,
      reason: input.reason ?? interaction?.subject ?? "Access request",
      priority: asPriority(input.priority, interaction?.urgency ?? "medium"),
      status: "requested",
      notes: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.accessRequests.push(request);
    if (interaction) {
      interaction.linkedResourceIds = [...new Set([...(interaction.linkedResourceIds ?? []), request.id])];
      await this.persistence.saveCollection("interactions", this.data.interactions);
    }
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.create", "access_request", request.id, request.patientId, {
      interactionId: request.interactionId,
      priority: request.priority
    });
    return request;
  }

  async offerAccessSlot(context: RequestContext, accessRequestId: string, input: OfferAccessSlotInput) {
    const request = this.ensureVisibleAccessRequest(context, accessRequestId);
    const patient = request.patientId ? this.ensureKnownPatient(context, request.patientId) : undefined;
    const slot = {
      doctorName: ensureString(input.doctorName, "doctorName"),
      specialty: input.specialty ?? request.requestedSpecialty ?? "Consultation",
      branchId: input.branchId ?? request.requestedBranchId ?? patient?.branchId ?? ensureString(input.branchId, "branchId"),
      scheduledAt: ensureString(input.scheduledAt, "scheduledAt")
    };
    if (!this.canAccessBranch(context, slot.branchId)) {
      throw new ApiError(403, "Slot is outside the actor's branch scope");
    }
    request.candidateSlot = slot;
    request.requestedSpecialty = slot.specialty;
    request.requestedBranchId = slot.branchId;
    request.status = input.holdMinutes && input.holdMinutes > 0 ? "hold_created" : "slot_offered";
    if (input.holdMinutes && input.holdMinutes > 0) {
      request.hold = {
        heldAt: nowIso(),
        expiresAt: new Date(Date.now() + input.holdMinutes * 60_000).toISOString(),
        heldBy: context.actorId
      };
    }
    request.updatedAt = nowIso();
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.update", "access_request", request.id, request.patientId, {
      status: request.status,
      scheduledAt: slot.scheduledAt
    });
    return request;
  }

  async bookAccessRequest(context: RequestContext, accessRequestId: string, input: BookAccessRequestInput) {
    const request = this.ensureVisibleAccessRequest(context, accessRequestId);
    const patientId = ensureString(request.patientId, "patientId");
    const patient = this.ensureKnownPatient(context, patientId);
    const slot = {
      doctorName: input.doctorName ?? request.candidateSlot?.doctorName ?? "Care team",
      specialty: input.specialty ?? request.candidateSlot?.specialty ?? request.requestedSpecialty ?? "Consultation",
      branchId: input.branchId ?? request.candidateSlot?.branchId ?? request.requestedBranchId ?? patient.branchId,
      scheduledAt: input.scheduledAt ?? request.candidateSlot?.scheduledAt
    };
    if (!slot.scheduledAt) {
      throw new ApiError(400, "Missing required field: scheduledAt");
    }
    const appointment = await this.createAppointment(context, {
      patientId,
      doctorName: slot.doctorName,
      specialty: slot.specialty,
      branchId: slot.branchId,
      scheduledAt: slot.scheduledAt,
      reason: input.reason ?? request.reason
    });
    request.appointmentId = appointment.id;
    request.candidateSlot = {
      doctorName: appointment.doctorName,
      specialty: appointment.specialty,
      branchId: appointment.branchId,
      scheduledAt: appointment.scheduledAt
    };
    request.status = "booked";
    request.updatedAt = nowIso();
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.update", "access_request", request.id, request.patientId, {
      status: request.status,
      appointmentId: appointment.id
    });
    return {
      accessRequest: request,
      appointment: this.decorateAppointment(context, appointment)
    };
  }

  async sendAccessMobileLink(context: RequestContext, accessRequestId: string, input: SendMobileLinkInput = {}) {
    const request = this.ensureVisibleAccessRequest(context, accessRequestId);
    const patientId = ensureString(request.patientId, "patientId");
    this.ensureKnownPatient(context, patientId);
    const timestamp = nowIso();
    const expiresInHours = Math.min(Math.max(input.expiresInHours ?? 72, 1), 24 * 14);
    const session: MobileLinkSession = {
      token: createId("mls"),
      tenantId: context.tenantId,
      patientId,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60_000).toISOString(),
      allowedActions: [
        "confirm_appointment",
        "upload_document_metadata",
        "confirm_follow_up",
        "reschedule_request",
        "update_checklist",
        "update_consent",
        "opt_out"
      ],
      createdAt: timestamp
    };
    this.data.sessions.push(session);
    request.mobileLinkToken = session.token;
    request.status = "mobile_link_sent";
    request.updatedAt = timestamp;
    await this.persistence.saveCollection("sessions", this.data.sessions);
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.update", "access_request", request.id, request.patientId, {
      status: request.status,
      mobileLinkToken: "created"
    });
    return {
      accessRequest: request,
      mobileLinkSession: session,
      mobileUrl: `/mobile-link-sessions/${session.token}`
    };
  }

  async confirmAccessRequest(context: RequestContext, accessRequestId: string, input: ConfirmAppointmentInput) {
    const request = this.ensureVisibleAccessRequest(context, accessRequestId);
    if (!request.appointmentId) {
      throw new ApiError(400, "Access request must be booked before confirmation");
    }
    const appointment = await this.confirmAppointment(context, request.appointmentId, input);
    request.status = "confirmed";
    request.updatedAt = nowIso();
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.update", "access_request", request.id, request.patientId, {
      status: request.status,
      appointmentId: appointment.id
    });
    return {
      accessRequest: request,
      appointment
    };
  }

  async rescheduleAccessRequest(context: RequestContext, accessRequestId: string, input: RescheduleAccessRequestInput) {
    const request = this.ensureVisibleAccessRequest(context, accessRequestId);
    if (request.appointmentId) {
      const appointment = this.data.appointments.find(
        (entry) => entry.id === request.appointmentId && entry.tenantId === context.tenantId
      );
      if (appointment) {
        if (input.scheduledAt) {
          appointment.scheduledAt = input.scheduledAt;
        }
        if (input.doctorName) {
          appointment.doctorName = input.doctorName;
        }
        appointment.status = "rescheduled";
        appointment.updatedAt = nowIso();
        await this.persistence.saveCollection("appointments", this.data.appointments);
      }
    }
    request.status = "reschedule_requested";
    request.notes = [...request.notes, input.reason ?? "Reschedule requested"];
    request.updatedAt = nowIso();
    await this.persistence.saveCollection("accessRequests", this.data.accessRequests);
    await this.audit(context, "access_request.update", "access_request", request.id, request.patientId, {
      status: request.status,
      reason: input.reason
    });
    return request;
  }

  // ---- Doctors & scheduling -------------------------------------------------

  /** Doctors visible to the actor (tenant-scoped; staff also limited to their branches). */
  listDoctors(context: RequestContext) {
    return this.data.doctors
      .filter((entry) => entry.tenantId === context.tenantId)
      .filter((entry) => entry.branchIds.some((branchId) => this.canAccessBranch(context, branchId)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private ensureVisibleDoctor(context: RequestContext, doctorId: string): Doctor {
    const doctor = this.data.doctors.find((entry) => entry.id === doctorId && entry.tenantId === context.tenantId);
    if (!doctor) {
      throw new ApiError(404, `Doctor not found: ${doctorId}`);
    }
    if (!doctor.branchIds.some((branchId) => this.canAccessBranch(context, branchId))) {
      throw new ApiError(403, "Doctor is outside the actor's branch scope");
    }
    return doctor;
  }

  async createDoctor(context: RequestContext, input: Record<string, unknown>) {
    const displayName = ensureString(input.displayName, "displayName");
    const branchIds = Array.isArray(input.branchIds)
      ? input.branchIds.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
    if (branchIds.length === 0) {
      throw new ApiError(400, "At least one branchId is required.");
    }
    for (const branchId of branchIds) {
      if (!this.data.branches.some((entry) => entry.id === branchId && entry.tenantId === context.tenantId)) {
        throw new ApiError(400, `Unknown branch: ${branchId}`);
      }
      if (!this.canAccessBranch(context, branchId)) {
        throw new ApiError(403, "Cannot create a doctor outside the actor's branch scope");
      }
    }
    const timestamp = nowIso();
    const doctor: Doctor = {
      id: createId("doctor"),
      tenantId: context.tenantId,
      displayName,
      specialty: typeof input.specialty === "string" ? input.specialty : undefined,
      branchIds,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      slotMinutes: sanitizeSlotMinutes(input.slotMinutes),
      weeklyHours: sanitizeWeeklyHours(input.weeklyHours),
      status: input.status === "inactive" ? "inactive" : "active",
      userId: typeof input.userId === "string" ? input.userId : undefined,
      createdAt: timestamp
    };
    this.data.doctors.push(doctor);
    await this.persistence.saveCollection("doctors", this.data.doctors);
    await this.audit(context, "doctor.create", "doctor", doctor.id, undefined, { displayName: doctor.displayName });
    return doctor;
  }

  async updateDoctor(context: RequestContext, doctorId: string, input: Record<string, unknown>) {
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    const prevName = doctor.displayName;
    const prevSpecialty = doctor.specialty;
    if (typeof input.displayName === "string" && input.displayName.trim().length > 0) {
      doctor.displayName = input.displayName.trim();
    }
    if (typeof input.specialty === "string") {
      doctor.specialty = input.specialty;
    }
    if (typeof input.phone === "string") {
      doctor.phone = input.phone;
    }
    if (typeof input.userId === "string") {
      doctor.userId = input.userId;
    }
    if (input.status === "active" || input.status === "inactive") {
      doctor.status = input.status;
    }
    if (Array.isArray(input.branchIds)) {
      const branchIds = input.branchIds.filter((value): value is string => typeof value === "string" && value.length > 0);
      if (branchIds.length === 0) {
        throw new ApiError(400, "At least one branchId is required.");
      }
      for (const branchId of branchIds) {
        if (!this.data.branches.some((entry) => entry.id === branchId && entry.tenantId === context.tenantId)) {
          throw new ApiError(400, `Unknown branch: ${branchId}`);
        }
        if (!this.canAccessBranch(context, branchId)) {
          throw new ApiError(403, "Cannot assign a doctor outside the actor's branch scope");
        }
      }
      doctor.branchIds = branchIds;
    }
    if (input.slotMinutes !== undefined) {
      doctor.slotMinutes = sanitizeSlotMinutes(input.slotMinutes);
    }
    if (input.weeklyHours !== undefined) {
      doctor.weeklyHours = sanitizeWeeklyHours(input.weeklyHours);
    }
    await this.persistence.saveCollection("doctors", this.data.doctors);

    // Keep the denormalized doctorName/specialty on this doctor's appointments in
    // sync with the rename, so staff lists and outbound messages don't go stale.
    if (doctor.displayName !== prevName || doctor.specialty !== prevSpecialty) {
      let touched = false;
      for (const appointment of this.data.appointments) {
        if (appointment.tenantId !== context.tenantId || appointment.doctorId !== doctor.id) continue;
        const nextSpecialty = doctor.specialty ?? appointment.specialty;
        if (appointment.doctorName !== doctor.displayName || appointment.specialty !== nextSpecialty) {
          appointment.doctorName = doctor.displayName;
          appointment.specialty = nextSpecialty;
          touched = true;
        }
      }
      if (touched) {
        await this.persistence.saveCollection("appointments", this.data.appointments);
      }
    }

    await this.audit(context, "doctor.update", "doctor", doctor.id, undefined, { status: doctor.status });
    return doctor;
  }

  async setDoctorSchedule(context: RequestContext, doctorId: string, input: Record<string, unknown>) {
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    doctor.weeklyHours = sanitizeWeeklyHours(input.weeklyHours);
    if (input.slotMinutes !== undefined) {
      doctor.slotMinutes = sanitizeSlotMinutes(input.slotMinutes);
    }
    await this.persistence.saveCollection("doctors", this.data.doctors);
    await this.audit(context, "doctor.update", "doctor", doctor.id, undefined, { schedule: "updated" });
    return doctor;
  }

  /**
   * Available slots for a doctor on a calendar date. Expands each weekday window into
   * slotMinutes increments and drops any slot already taken by a non-cancelled
   * appointment for that doctor on that date. Slots are ISO timestamps (UTC).
   */
  getDoctorSlots(context: RequestContext, doctorId: string, dateISO: string, branchId?: string) {
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      throw new ApiError(400, "date must be in YYYY-MM-DD format");
    }
    if (doctor.status !== "active") {
      return [] as Array<{ start: string; end: string }>;
    }
    const weekday = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
    const windows = (doctor.weeklyHours?.[weekday] ?? []).filter(
      (window) => !branchId || !window.branchId || window.branchId === branchId
    );
    const slotMinutes = doctor.slotMinutes > 0 ? doctor.slotMinutes : 15;

    // Start times already booked (non-cancelled) for this doctor on this date.
    const taken = new Set(
      this.data.appointments
        .filter(
          (entry) =>
            entry.tenantId === context.tenantId &&
            entry.doctorId === doctor.id &&
            entry.status !== "cancelled" &&
            entry.scheduledAt.slice(0, 10) === dateISO
        )
        .map((entry) => entry.scheduledAt)
    );

    const slots: Array<{ start: string; end: string }> = [];
    for (const window of windows) {
      const startMin = parseHhMm(window.start);
      const endMin = parseHhMm(window.end);
      if (startMin === null || endMin === null || endMin <= startMin) {
        continue;
      }
      for (let minute = startMin; minute + slotMinutes <= endMin; minute += slotMinutes) {
        const start = isoFromDateAndMinutes(dateISO, minute);
        if (taken.has(start)) {
          continue;
        }
        slots.push({ start, end: isoFromDateAndMinutes(dateISO, minute + slotMinutes) });
      }
    }
    // Windows may be entered out of order or overlap — return a clean, ascending,
    // de-duplicated list so the booking UI shows each time once, in order.
    const byStart = new Map<string, { start: string; end: string }>();
    for (const slot of slots) {
      if (!byStart.has(slot.start)) byStart.set(slot.start, slot);
    }
    return [...byStart.values()].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  }

  /**
   * Book an appointment against a doctor's computed schedule. Validates the requested
   * slot falls inside the doctor's weekly availability AND is not already taken (409).
   */
  /**
   * Resolve a patient by id, or create one from name/phone (phone-first intake).
   * When a new patient is created and a lead matches the phone, the lead is
   * best-effort marked converted. Shared by OPD visits and appointment booking.
   */
  private async resolveOrCreatePatient(
    context: RequestContext,
    input: { patientId?: unknown; name?: unknown; phone?: unknown; gender?: Patient["gender"]; age?: number; branchId?: string }
  ): Promise<Patient> {
    if (typeof input.patientId === "string" && input.patientId.trim()) {
      return this.ensureKnownPatient(context, input.patientId.trim());
    }
    const name = ensureString(input.name, "name");
    const phone = typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : undefined;
    const summary = await this.createPatient(context, {
      displayName: name,
      age: input.age,
      gender: input.gender,
      primaryPhone: phone,
      branchId: input.branchId
    });
    const patient = this.ensureKnownPatient(context, summary.id);

    const normalized = phone ? normalizePhone(phone) : undefined;
    if (normalized) {
      const lead = this.data.leads
        .filter((entry) => entry.tenantId === context.tenantId && normalizePhone(entry.phone) === normalized)
        .filter((entry) => !entry.convertedPatientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (lead) {
        lead.convertedPatientId = patient.id;
        lead.matchedPatientId = lead.matchedPatientId ?? patient.id;
        lead.stage = "converted";
        lead.updatedAt = nowIso();
        await this.persistence.saveCollection("leads", this.data.leads);
      }
    }
    return patient;
  }

  async bookAppointment(context: RequestContext, input: BookAppointmentInput) {
    const doctorId = ensureString(input.doctorId, "doctorId");
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    if (doctor.status !== "active") {
      throw new ApiError(400, "Doctor is not accepting appointments");
    }
    const scheduledAt = ensureString(input.scheduledAt, "scheduledAt");
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, "scheduledAt must be a valid ISO timestamp");
    }
    const normalizedStart = parsed.toISOString();
    const dateISO = normalizedStart.slice(0, 10);
    const branchId = input.branchId ?? doctor.branchIds[0];
    if (!doctor.branchIds.includes(branchId)) {
      throw new ApiError(400, "Doctor does not work at the requested branch");
    }

    const slots = this.getDoctorSlots(context, doctorId, dateISO, branchId);
    const matching = slots.find((slot) => slot.start === normalizedStart);
    if (!matching) {
      // Distinguish "already taken" (409) from "outside schedule" (400).
      const taken = this.data.appointments.some(
        (entry) =>
          entry.tenantId === context.tenantId &&
          entry.doctorId === doctor.id &&
          entry.status !== "cancelled" &&
          entry.scheduledAt === normalizedStart
      );
      if (taken) {
        throw new ApiError(409, "That slot is already booked");
      }
      throw new ApiError(400, "Requested time is outside the doctor's available schedule");
    }

    // Slot is valid → resolve the patient (existing id, or create phone-first).
    // Done after validation so a bad slot never creates an orphan patient.
    const patient = await this.resolveOrCreatePatient(context, {
      patientId: input.patientId,
      name: input.patient?.name,
      phone: input.patient?.phone,
      gender: input.patient?.gender,
      age: input.patient?.age,
      branchId
    });

    // One active appointment per patient + doctor + day — stop the same patient
    // from clogging a doctor's schedule with duplicate slots.
    const sameDay = this.data.appointments.find(
      (entry) =>
        entry.tenantId === context.tenantId &&
        entry.patientId === patient.id &&
        entry.doctorId === doctor.id &&
        entry.scheduledAt.slice(0, 10) === dateISO &&
        entry.status !== "cancelled" &&
        entry.status !== "no_show"
    );
    if (sameDay) {
      const prettyDate = new Date(`${dateISO}T00:00:00.000Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
      throw new ApiError(409, `This patient already has an appointment with this doctor on ${prettyDate}`);
    }

    const created = await this.createAppointment(context, {
      patientId: patient.id,
      doctorId: doctor.id,
      doctorName: doctor.displayName,
      specialty: doctor.specialty ?? "Consultation",
      branchId,
      scheduledAt: normalizedStart,
      durationMinutes: doctor.slotMinutes,
      reason: input.reason
    });
    // Enroll the appointment into the tenant's active appointment workflows (lazy
    // default provisioning guarantees parity with the retired notification path).
    // Best-effort — never fails the booking.
    await this.enrollAppointmentWorkflows(context, created, patient);
    return this.decorateAppointment(context, created);
  }

  /**
   * Manual trigger: WhatsApp each active doctor (with a phone) a summary of their
   * upcoming appointments (today/tomorrow) asking them to confirm or flag changes.
   * The recurring daily automation is deferred to workflow-worker.
   */
  async sendDoctorConfirmations(context: RequestContext) {
    const today = nowIso().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    let sent = 0;
    let failed = 0;
    const results: Array<{ doctorId: string; ok: boolean; error?: string }> = [];

    for (const doctor of this.listDoctors(context)) {
      if (doctor.status !== "active") {
        continue;
      }
      if (!doctor.phone) {
        failed += 1;
        results.push({ doctorId: doctor.id, ok: false, error: "Doctor has no phone on file" });
        continue;
      }
      const upcoming = this.data.appointments
        .filter(
          (entry) =>
            entry.tenantId === context.tenantId &&
            entry.doctorId === doctor.id &&
            ["scheduled", "confirmed", "rescheduled"].includes(entry.status) &&
            (entry.scheduledAt.slice(0, 10) === today || entry.scheduledAt.slice(0, 10) === tomorrow)
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

      const lines = upcoming.map((entry) => {
        const when = entry.scheduledAt.replace("T", " ").slice(0, 16);
        return `• ${when} — ${patientName(this.data.patients, entry.patientId)} (${entry.reason})`;
      });
      const body =
        `Hello ${doctor.displayName}, here are your upcoming appointments:\n` +
        (lines.length > 0 ? lines.join("\n") : "No appointments scheduled for today/tomorrow.") +
        `\n\nReply CONFIRM to confirm this schedule, or let us know of any changes.`;

      try {
        const result = await this.sendMessage(context, { to: doctor.phone, type: "transactional", body });
        if (result.ok) {
          sent += 1;
          results.push({ doctorId: doctor.id, ok: true });
        } else {
          failed += 1;
          results.push({ doctorId: doctor.id, ok: false, error: result.error });
        }
      } catch (error) {
        failed += 1;
        results.push({ doctorId: doctor.id, ok: false, error: error instanceof Error ? error.message : "send failed" });
      }
    }

    await this.audit(context, "scheduling.send_confirmations", "doctor", undefined, undefined, { sent, failed });
    return { sent, failed, results };
  }

  listAppointments(
    context: RequestContext,
    filters: { patientId?: string; status?: string; doctorId?: string; date?: string }
  ) {
    return this.data.appointments
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) {
          return false;
        }
        if (!this.canAccessBranch(context, entry.branchId)) {
          return false;
        }
        if (filters.patientId && entry.patientId !== filters.patientId) {
          return false;
        }
        if (filters.status && entry.status !== filters.status) {
          return false;
        }
        if (filters.doctorId && entry.doctorId !== filters.doctorId) {
          return false;
        }
        if (filters.date && entry.scheduledAt.slice(0, 10) !== filters.date) {
          return false;
        }
        return true;
      })
      // Resolve doctor name/specialty + branch contact from the live records so the
      // list never surfaces a stale denormalized copy.
      .map((entry) => this.decorateAppointment(context, entry));
  }

  async createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    const patientId = ensureString(input.patientId, "patientId");
    const patient = this.ensureKnownPatient(context, patientId);
    const timestamp = nowIso();
    const appointment: Appointment = {
      id: createId("appointment"),
      tenantId: context.tenantId,
      patientId,
      ...(input.doctorId ? { doctorId: input.doctorId } : {}),
      doctorName: ensureString(input.doctorName, "doctorName"),
      specialty: ensureString(input.specialty, "specialty"),
      branchId: input.branchId ?? patient.branchId,
      scheduledAt: ensureString(input.scheduledAt, "scheduledAt"),
      ...(typeof input.durationMinutes === "number" ? { durationMinutes: input.durationMinutes } : {}),
      status: "scheduled",
      reason: input.reason ?? "Consultation",
      noShowRisk: "medium",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (!this.canAccessBranch(context, appointment.branchId)) {
      throw new ApiError(403, "Cannot create an appointment outside the actor's branch scope");
    }
    this.data.appointments.push(appointment);
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.create", "appointment", appointment.id, appointment.patientId, {
      scheduledAt: appointment.scheduledAt,
      specialty: appointment.specialty
    });
    return appointment;
  }

  async confirmAppointment(context: RequestContext, appointmentId: string, input: ConfirmAppointmentInput, sessionToken?: string) {
    const appointment = this.data.appointments.find((entry) => entry.id === appointmentId && entry.tenantId === context.tenantId);
    if (!appointment) {
      throw new ApiError(404, `Appointment not found: ${appointmentId}`);
    }
    if (!this.canAccessBranch(context, appointment.branchId)) {
      throw new ApiError(403, "Appointment is outside the actor's branch scope");
    }
    if (sessionToken) {
      const session = this.ensureActionAllowed(sessionToken, "confirm_appointment");
      if (session.patientId !== appointment.patientId) {
        throw new ApiError(403, "Appointment does not belong to this mobile link session");
      }
    }
    const timestamp = nowIso();
    appointment.status = "confirmed";
    appointment.confirmation = {
      confirmedAt: timestamp,
      confirmedBy: input.confirmedBy ?? (sessionToken ? "patient" : "staff"),
      notes: input.notes
    };
    appointment.updatedAt = timestamp;
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.confirm", "appointment", appointment.id, appointment.patientId, {
      confirmedBy: appointment.confirmation.confirmedBy,
      sessionToken: sessionToken ? "present" : "none"
    });
    if (sessionToken) {
      await this.audit(context, "mobile_link.action", "appointment", appointment.id, appointment.patientId, {
        action: "confirm_appointment"
      });
    }
    await this.outbound.workflow.startWorkflow(
      "appointment-reminder",
      { appointmentId: appointment.id, patientId: appointment.patientId, trigger: "appointment.confirmed" },
      context
    );
    return this.decorateAppointment(context, appointment);
  }

  async updateAppointment(context: RequestContext, appointmentId: string, input: UpdateAppointmentInput) {
    const appointment = this.ensureVisibleAppointment(context, appointmentId);
    if (input.status) {
      appointment.status = input.status;
    }
    // A disposition only makes sense for a completed visit — accept it when the
    // appointment is (being) completed, otherwise reject to avoid silent drops.
    let dispositionRecorded = false;
    if (input.disposition) {
      if (appointment.status !== "completed") {
        throw new ApiError(400, "A disposition can only be set when the appointment is completed");
      }
      appointment.disposition = this.buildDisposition(context, input.disposition);
      dispositionRecorded = true;
    }
    appointment.updatedAt = nowIso();
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.update", "appointment", appointment.id, appointment.patientId, {
      status: appointment.status,
      outcome: input.outcome ?? appointment.disposition?.outcome
    });
    if (dispositionRecorded) {
      await this.audit(context, "appointment.disposition", "appointment", appointment.id, appointment.patientId, {
        outcome: appointment.disposition?.outcome,
        nextStep: appointment.disposition?.nextStep
      });
    }
    // Drive the workflow runtime off the status change (best-effort — never fails
    // the status update). Cancel/no-show are terminal; "completed" stamps the
    // visit-end anchor and keeps the run alive for any post-visit (revisit) stages.
    if (input.status === "cancelled") {
      await this.signalWorkflowEvent(context, appointment, "cancelled");
      await this.closeAppointmentRuns(context, appointment.id, "cancelled");
    } else if (input.status === "checked_in") {
      await this.signalWorkflowEvent(context, appointment, "checked_in");
    } else if (input.status === "completed") {
      await this.completeAppointmentRuns(context, appointment);
    } else if (input.status === "no_show") {
      await this.closeAppointmentRuns(context, appointment.id, "cancelled");
    }
    return this.decorateAppointment(context, appointment);
  }

  /** Move an appointment to a different open slot (same or different doctor/date). */
  async rescheduleAppointment(
    context: RequestContext,
    appointmentId: string,
    input: { scheduledAt?: string; doctorId?: string; branchId?: string }
  ) {
    const appointment = this.ensureVisibleAppointment(context, appointmentId);
    const doctorId =
      typeof input.doctorId === "string" && input.doctorId.trim() ? input.doctorId.trim() : appointment.doctorId;
    if (!doctorId) {
      throw new ApiError(400, "Appointment has no doctor to reschedule");
    }
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    if (doctor.status !== "active") {
      throw new ApiError(400, "Doctor is not accepting appointments");
    }
    const scheduledAt = ensureString(input.scheduledAt, "scheduledAt");
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, "scheduledAt must be a valid ISO timestamp");
    }
    const normalizedStart = parsed.toISOString();
    const dateISO = normalizedStart.slice(0, 10);
    const branchId =
      input.branchId ?? (doctor.branchIds.includes(appointment.branchId) ? appointment.branchId : doctor.branchIds[0]);
    if (!branchId || !doctor.branchIds.includes(branchId)) {
      throw new ApiError(400, "Doctor does not work at the requested branch");
    }
    // Validate the target slot: it must be in the schedule and not held by ANOTHER
    // non-cancelled appointment (getDoctorSlots already drops taken slots; this
    // appointment's own current slot is excluded by the id check).
    this.validateRescheduleSlot(context, doctor, dateISO, branchId, normalizedStart, appointment.id);
    appointment.doctorId = doctor.id;
    appointment.doctorName = doctor.displayName;
    appointment.specialty = doctor.specialty ?? appointment.specialty;
    appointment.branchId = branchId;
    appointment.scheduledAt = normalizedStart;
    appointment.durationMinutes = doctor.slotMinutes;
    appointment.status = "rescheduled";
    appointment.rescheduledBy = "staff";
    appointment.updatedAt = nowIso();
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.update", "appointment", appointment.id, appointment.patientId, {
      status: "rescheduled",
      scheduledAt: normalizedStart
    });
    // New slot → re-arm the time-based reminder stages, then fire the "rescheduled"
    // event (best-effort, via the workflow runtime).
    await this.rearmAppointmentReminders(context, appointment.id);
    await this.signalWorkflowEvent(context, appointment, "rescheduled");
    return this.decorateAppointment(context, appointment);
  }

  /**
   * After a reschedule, reset the not-yet-fired time-based (relative) StageRuns of
   * this appointment's active runs back to "pending" so they re-fire for the new
   * slot. Already-fired reminders are NOT reset (no duplicate sends). Best-effort.
   */
  private async rearmAppointmentReminders(context: RequestContext, appointmentId: string): Promise<void> {
    let mutated = false;
    for (const run of this.data.workflowRuns) {
      if (
        run.tenantId !== context.tenantId ||
        run.anchorType !== "appointment" ||
        run.anchorId !== appointmentId ||
        run.status !== "active"
      ) {
        continue;
      }
      const workflow = this.data.workflows.find(
        (entry) => entry.id === run.workflowId && entry.tenantId === context.tenantId
      );
      if (!workflow) {
        continue;
      }
      for (const stage of workflow.stages) {
        if (stage.trigger.type !== "relative") {
          continue;
        }
        const stageRun = this.stageRunFor(run, stage.key);
        // Re-arm a reminder that previously fired/failed/skipped so it can run for the
        // new time. Leave still-pending ones as-is.
        if (stageRun && stageRun.status !== "pending") {
          stageRun.status = "pending";
          stageRun.firedAt = undefined;
          stageRun.messageId = undefined;
          stageRun.error = undefined;
          stageRun.outcome = undefined;
          run.updatedAt = nowIso();
          mutated = true;
        }
      }
    }
    if (mutated) {
      await this.persistence.saveCollection("workflowRuns", this.data.workflowRuns);
    }
  }

  /**
   * Validate that `normalizedStart` is an open slot for `doctor` on `dateISO`/`branchId`.
   * Throws 409 when the slot is held by another non-cancelled appointment, or 400 when
   * it falls outside the doctor's schedule. `excludeAppointmentId` lets a reschedule
   * keep the appointment's own current slot from counting as "taken".
   */
  private validateRescheduleSlot(
    context: RequestContext,
    doctor: Doctor,
    dateISO: string,
    branchId: string,
    normalizedStart: string,
    excludeAppointmentId?: string
  ): void {
    const slots = this.getDoctorSlots(context, doctor.id, dateISO, branchId);
    if (slots.some((slot) => slot.start === normalizedStart)) {
      return;
    }
    const taken = this.data.appointments.some(
      (entry) =>
        entry.tenantId === context.tenantId &&
        entry.id !== excludeAppointmentId &&
        entry.doctorId === doctor.id &&
        entry.status !== "cancelled" &&
        entry.scheduledAt === normalizedStart
    );
    throw taken
      ? new ApiError(409, "That slot is already booked")
      : new ApiError(400, "Requested time is outside the doctor's available schedule");
  }

  /**
   * Patient-facing (mobile-link PWA): list the open slots for this appointment's
   * doctor on a given date so the patient can pick a new time. Authenticates via the
   * session token in the path; defaults to the appointment's own date when none given.
   */
  patientLinkAppointmentSlots(context: RequestContext, token: string, appointmentId: string, dateISO?: string) {
    const appointment = this.ensurePatientLinkAppointment(context, token, appointmentId, "reschedule_request");
    if (!appointment.doctorId) {
      throw new ApiError(400, "Appointment has no doctor to reschedule");
    }
    const date = typeof dateISO === "string" && dateISO.trim() ? dateISO.trim() : appointment.scheduledAt.slice(0, 10);
    return this.getDoctorSlots(context, appointment.doctorId, date, appointment.branchId);
  }

  /**
   * Patient-facing (mobile-link PWA): move this appointment to a slot the patient
   * picked. Validates the slot exactly like the staff reschedule, marks the move as
   * patient-initiated, and fires the "rescheduled" notification (no confirm link —
   * the patient already chose the slot).
   */
  async patientRescheduleAppointment(
    context: RequestContext,
    token: string,
    appointmentId: string,
    input: { scheduledAt?: string }
  ) {
    const appointment = this.ensurePatientLinkAppointment(context, token, appointmentId, "reschedule_request");
    const doctorId = appointment.doctorId;
    if (!doctorId) {
      throw new ApiError(400, "Appointment has no doctor to reschedule");
    }
    const doctor = this.ensureVisibleDoctor(context, doctorId);
    if (doctor.status !== "active") {
      throw new ApiError(400, "Doctor is not accepting appointments");
    }
    const scheduledAt = ensureString(input.scheduledAt, "scheduledAt");
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, "scheduledAt must be a valid ISO timestamp");
    }
    const normalizedStart = parsed.toISOString();
    const dateISO = normalizedStart.slice(0, 10);
    const branchId = doctor.branchIds.includes(appointment.branchId) ? appointment.branchId : doctor.branchIds[0];
    if (!branchId || !doctor.branchIds.includes(branchId)) {
      throw new ApiError(400, "Doctor does not work at the requested branch");
    }
    this.validateRescheduleSlot(context, doctor, dateISO, branchId, normalizedStart, appointment.id);
    appointment.branchId = branchId;
    appointment.scheduledAt = normalizedStart;
    appointment.durationMinutes = doctor.slotMinutes;
    appointment.status = "rescheduled";
    appointment.rescheduledBy = "patient";
    appointment.updatedAt = nowIso();
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.update", "appointment", appointment.id, appointment.patientId, {
      status: "rescheduled",
      via: "patient_link"
    });
    // New slot → re-arm reminders, then fire the "rescheduled" event. The seeded
    // reschedule template carries NO confirm link (the patient already chose the
    // slot), so no fresh confirm session is minted here.
    await this.rearmAppointmentReminders(context, appointment.id);
    await this.signalWorkflowEvent(context, appointment, "rescheduled");
    return this.decorateAppointment(context, appointment);
  }

  /**
   * Resolve a mobile-link session by token, assert it allows `action`, and return the
   * appointment after asserting it belongs to the session's patient + tenant (403).
   */
  private ensurePatientLinkAppointment(
    context: RequestContext,
    token: string,
    appointmentId: string,
    action: MobileLinkSession["allowedActions"][number]
  ): Appointment {
    const session = this.ensureActionAllowed(token, action);
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const appointment = this.data.appointments.find(
      (entry) => entry.id === appointmentId && entry.tenantId === context.tenantId
    );
    if (!appointment) {
      throw new ApiError(404, `Appointment not found: ${appointmentId}`);
    }
    if (appointment.patientId !== session.patientId) {
      throw new ApiError(403, "Appointment does not belong to this mobile link session");
    }
    return appointment;
  }

  /** Convenience endpoint: complete an appointment and record its disposition in one call. */
  async recordAppointmentDisposition(context: RequestContext, appointmentId: string, input: DispositionInput) {
    const appointment = this.ensureVisibleAppointment(context, appointmentId);
    appointment.status = "completed";
    appointment.disposition = this.buildDisposition(context, input);
    appointment.updatedAt = nowIso();
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.disposition", "appointment", appointment.id, appointment.patientId, {
      outcome: appointment.disposition.outcome,
      nextStep: appointment.disposition.nextStep
    });
    // Visit done → fire visit_completed + keep the run alive for revisit stages.
    await this.completeAppointmentRuns(context, appointment);
    return this.decorateAppointment(context, appointment);
  }

  private buildDisposition(context: RequestContext, input: DispositionInput): AppointmentDisposition {
    return {
      outcome: ensureString(input.outcome, "outcome"),
      ...(typeof input.notes === "string" ? { notes: input.notes } : {}),
      ...(typeof input.nextStep === "string" ? { nextStep: input.nextStep } : {}),
      ...(typeof input.nextActionDate === "string" ? { nextActionDate: input.nextActionDate } : {}),
      recordedBy: context.actorId,
      recordedAt: nowIso()
    };
  }

  private ensureVisibleAppointment(context: RequestContext, appointmentId: string): Appointment {
    const appointment = this.data.appointments.find((entry) => entry.id === appointmentId && entry.tenantId === context.tenantId);
    if (!appointment) {
      throw new ApiError(404, `Appointment not found: ${appointmentId}`);
    }
    if (!this.canAccessBranch(context, appointment.branchId)) {
      throw new ApiError(403, "Appointment is outside the actor's branch scope");
    }
    return appointment;
  }

  async requestAppointmentReschedule(
    context: RequestContext,
    token: string,
    appointmentId: string,
    input: RequestRescheduleInput
  ) {
    const session = this.ensureActionAllowed(token, "reschedule_request");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const appointment = this.data.appointments.find((entry) => entry.id === appointmentId && entry.tenantId === context.tenantId);
    if (!appointment) {
      throw new ApiError(404, `Appointment not found: ${appointmentId}`);
    }
    if (appointment.patientId !== session.patientId) {
      throw new ApiError(403, "Appointment does not belong to this mobile link session");
    }
    const timestamp = nowIso();
    appointment.status = "rescheduled";
    appointment.updatedAt = timestamp;
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "mobile_link.action", "appointment", appointment.id, appointment.patientId, {
      action: "reschedule_request",
      reason: input.reason
    });
    await this.outbound.workflow.startWorkflow(
      "appointment-reminder",
      { appointmentId: appointment.id, patientId: appointment.patientId, reason: input.reason, requestedAction: "reschedule" },
      context
    );
    return this.decorateAppointment(context, appointment);
  }

  async lookupMobileLinkSession(context: RequestContext, token: string) {
    const session = this.ensureSession(token);
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const patient = this.summarizePatient(context, this.ensureKnownPatient(context, session.patientId));
    await this.audit(context, "mobile_link.lookup", "mobile_link_session", session.token, session.patientId);
    const appointments = this.data.appointments
      .filter(
        (entry) =>
          entry.tenantId === context.tenantId &&
          entry.patientId === patient.id &&
          ["scheduled", "confirmed", "rescheduled", "checked_in", "in_consult"].includes(entry.status)
      )
      // Resolve doctor name/specialty + branch contact (branchName/phone/address/
      // mapUrl) from the live records via the shared decorator, so the PWA shows
      // current values and a real support phone — never a stale copy or the app's
      // placeholder number.
      .map((entry) => this.decorateAppointment(context, entry));
    // The hospital's real name + a support phone, so the PWA shows this tenant's
    // branding instead of falling back to a demo placeholder.
    const org = this.data.organizations.find((entry) => entry.id === context.tenantId);
    const supportBranch = this.data.branches.find(
      (b) => b.tenantId === context.tenantId && !!b.phone
    );
    return {
      session,
      patient,
      organization: {
        name: org?.displayName ?? "",
        supportPhone: appointments.find((a) => a.phone)?.phone ?? supportBranch?.phone ?? ""
      },
      household: patient.household ? this.householdView(context, patient.household) : undefined,
      appointments,
      followUps: this.data.followUps.filter(
        (entry) => entry.tenantId === context.tenantId && entry.patientId === patient.id && entry.status === "due"
      )
    };
  }

  async createDocumentMetadata(context: RequestContext, token: string, input: CreateDocumentMetadataInput) {
    const session = this.ensureActionAllowed(token, "upload_document_metadata");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    if (input.appointmentId) {
      const appointment = this.data.appointments.find((entry) => entry.id === input.appointmentId && entry.tenantId === context.tenantId);
      if (!appointment) {
        throw new ApiError(404, `Appointment not found: ${input.appointmentId}`);
      }
      if (appointment.patientId !== session.patientId) {
        throw new ApiError(403, "Appointment does not belong to this mobile link session");
      }
    }
    const timestamp = nowIso();
    const document: DocumentMetadata = {
      id: createId("document"),
      tenantId: context.tenantId,
      patientId: session.patientId,
      sessionToken: token,
      appointmentId: input.appointmentId,
      visitId: typeof input.visitId === "string" && input.visitId.trim() ? input.visitId.trim() : undefined,
      documentType: input.documentType ?? "other",
      fileName: ensureString(input.fileName, "fileName"),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageStatus: "metadata_only",
      notes: input.notes,
      createdAt: timestamp
    };
    this.data.documents.push(document);
    await this.persistence.saveCollection("documents", this.data.documents);
    await this.audit(context, "document_metadata.create", "document", document.id, document.patientId, {
      documentType: document.documentType,
      fileName: document.fileName
    });
    await this.audit(context, "mobile_link.action", "document", document.id, document.patientId, {
      action: "upload_document_metadata"
    });
    return document;
  }

  // ---- Clinical history (ICD-10 conditions) ---------------------------------

  /** Static, curated ophthalmology ICD-10 condition catalog for the UI picker. */
  listConditionCatalog() {
    return OPHTHALMOLOGY_CONDITION_CATALOG;
  }

  /** Returns the patient's clinical record, or an empty shell if none exists yet. */
  getClinicalRecord(context: RequestContext, patientId: string): ClinicalRecord {
    this.ensureKnownPatient(context, patientId);
    const existing = this.data.clinicalRecords.find(
      (entry) => entry.patientId === patientId && entry.tenantId === context.tenantId
    );
    if (existing) {
      return existing;
    }
    return {
      patientId,
      tenantId: context.tenantId,
      conditions: [],
      allergies: [],
      notes: undefined,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  async setClinicalRecord(context: RequestContext, patientId: string, input: SetClinicalRecordInput) {
    this.ensureKnownPatient(context, patientId);
    const conditions = this.sanitizeConditions(input.conditions);
    const allergies = Array.isArray(input.allergies)
      ? input.allergies.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim())
      : [];
    const notes = typeof input.notes === "string" && input.notes.trim().length > 0 ? input.notes.trim() : undefined;
    const timestamp = nowIso();

    const existing = this.data.clinicalRecords.find(
      (entry) => entry.patientId === patientId && entry.tenantId === context.tenantId
    );
    let record: ClinicalRecord;
    if (existing) {
      existing.conditions = conditions;
      existing.allergies = allergies;
      existing.notes = notes;
      existing.updatedAt = timestamp;
      record = existing;
    } else {
      record = {
        patientId,
        tenantId: context.tenantId,
        conditions,
        allergies,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.data.clinicalRecords.push(record);
    }
    await this.persistence.saveCollection("clinicalRecords", this.data.clinicalRecords);
    await this.audit(context, "clinical.update", "clinical_record", patientId, patientId, {
      conditionCount: record.conditions.length,
      allergyCount: record.allergies?.length ?? 0
    });
    return record;
  }

  private sanitizeConditions(value: unknown): ClinicalCondition[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const conditions: ClinicalCondition[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const candidate = entry as Record<string, unknown>;
      const icd10Code = typeof candidate.icd10Code === "string" ? candidate.icd10Code.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      if (!icd10Code || !label) {
        continue;
      }
      conditions.push({
        icd10Code,
        label,
        ...(typeof candidate.since === "string" && candidate.since.trim() ? { since: candidate.since.trim() } : {}),
        ...(typeof candidate.notes === "string" && candidate.notes.trim() ? { notes: candidate.notes.trim() } : {})
      });
    }
    return conditions;
  }

  // ---- Patient documents (S3 / local storage) -------------------------------

  private sanitizeDocumentType(value: unknown): DocumentType {
    return value === "prescription" || value === "discharge" || value === "lab" ? value : "other";
  }

  /** Map the staff document type onto the legacy mobile-link documentType union. */
  private legacyDocumentType(type: DocumentType): DocumentMetadata["documentType"] {
    if (type === "lab") return "lab_report";
    if (type === "prescription") return "prescription";
    return "other";
  }

  async createDocumentUploadUrl(context: RequestContext, patientId: string, input: DocumentUploadUrlInput) {
    const patient = this.ensureKnownPatient(context, patientId);
    const filename = ensureString(input.filename, "filename");
    const contentType = ensureString(input.contentType, "contentType");
    const type = this.sanitizeDocumentType(input.type);
    // key: <tenantId>/<patientId>/<uuid>-<filename> (filename slugified for safety).
    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_");
    const key = `${context.tenantId}/${patient.id}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storage.getUploadUrl(key, contentType);
    return { uploadUrl, key, storageMode: this.storage.mode, type };
  }

  async recordPatientDocument(context: RequestContext, patientId: string, input: RecordDocumentInput) {
    const patient = this.ensureKnownPatient(context, patientId);
    const key = ensureString(input.key, "key");
    const filename = ensureString(input.filename, "filename");
    const contentType = ensureString(input.contentType, "contentType");
    const type = this.sanitizeDocumentType(input.type);
    const timestamp = nowIso();
    const document: DocumentMetadata = {
      id: createId("document"),
      tenantId: context.tenantId,
      patientId: patient.id,
      documentType: this.legacyDocumentType(type),
      fileName: filename,
      filename,
      mimeType: contentType,
      contentType,
      type,
      storageKey: key,
      storageStatus: "uploaded",
      uploadedBy: context.actorId,
      createdAt: timestamp
    };
    this.data.documents.push(document);
    await this.persistence.saveCollection("documents", this.data.documents);
    await this.audit(context, "document.upload", "document", document.id, document.patientId, {
      type,
      filename,
      storageKey: key
    });
    return document;
  }

  listPatientDocuments(context: RequestContext, patientId: string) {
    this.ensureKnownPatient(context, patientId);
    return this.data.documents
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Whether the local-disk storage fallback is active (drives the /storage/local routes). */
  get storageMode() {
    return this.storage.mode;
  }

  /** Local-disk fallback: persist raw bytes for a storage key under `.uploads/`. */
  async putLocalObject(key: string, bytes: Buffer) {
    if (this.storage.mode !== "local") {
      throw new ApiError(404, "Local storage is not active");
    }
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const root = path.resolve(process.cwd(), ".uploads");
    const target = path.resolve(root, key);
    // Guard against path traversal — the resolved target must stay under .uploads/.
    if (!target.startsWith(root + path.sep)) {
      throw new ApiError(400, "Invalid storage key");
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    return { key, sizeBytes: bytes.length };
  }

  /** Local-disk fallback: read raw bytes for a storage key, or 404 if absent. */
  async getLocalObject(key: string): Promise<Buffer> {
    if (this.storage.mode !== "local") {
      throw new ApiError(404, "Local storage is not active");
    }
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const root = path.resolve(process.cwd(), ".uploads");
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw new ApiError(400, "Invalid storage key");
    }
    try {
      return await fs.readFile(target);
    } catch {
      throw new ApiError(404, "Stored object not found");
    }
  }

  async getDocumentDownloadUrl(context: RequestContext, docId: string) {
    const document = this.data.documents.find((entry) => entry.id === docId && entry.tenantId === context.tenantId);
    if (!document) {
      throw new ApiError(404, `Document not found: ${docId}`);
    }
    this.ensureKnownPatient(context, document.patientId);
    if (!document.storageKey) {
      throw new ApiError(409, "Document has no stored file (metadata-only)");
    }
    const downloadUrl = await this.storage.getDownloadUrl(document.storageKey);
    return { downloadUrl, key: document.storageKey, storageMode: this.storage.mode };
  }

  async confirmFollowUp(context: RequestContext, token: string, followUpId: string, input: ConfirmFollowUpInput) {
    const session = this.ensureActionAllowed(token, "confirm_follow_up");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const followUp = this.data.followUps.find((entry) => entry.id === followUpId && entry.tenantId === context.tenantId);
    if (!followUp) {
      throw new ApiError(404, `Follow-up not found: ${followUpId}`);
    }
    if (followUp.patientId !== session.patientId) {
      throw new ApiError(403, "Follow-up does not belong to this mobile link session");
    }
    const timestamp = nowIso();
    followUp.status = "confirmed";
    followUp.confirmedAt = timestamp;
    followUp.patientResponse = input.patientResponse;
    followUp.updatedAt = timestamp;
    const journeyTask = this.data.journeyTasks.find(
      (entry) => entry.followUpId === followUp.id && entry.tenantId === context.tenantId
    );
    if (journeyTask) {
      journeyTask.status = "completed";
      journeyTask.completedAt = timestamp;
      journeyTask.outcome = input.patientResponse;
      journeyTask.updatedAt = timestamp;
      const journey = this.data.patientJourneys.find(
        (entry) => entry.id === journeyTask.journeyId && entry.tenantId === context.tenantId
      );
      if (journey) {
        journey.updatedAt = timestamp;
        this.data.journeyEvents.push(
          this.createJourneyEventRecord(context, journey, "follow_up_confirmed", {
            followUpId: followUp.id,
            journeyTaskId: journeyTask.id,
            patientResponse: input.patientResponse
          })
        );
      }
      await this.persistence.saveCollection("journeyTasks", this.data.journeyTasks);
      await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
      await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    }
    await this.persistence.saveCollection("followUps", this.data.followUps);
    await this.audit(context, "follow_up.confirm", "follow_up", followUp.id, followUp.patientId, {
      patientResponse: followUp.patientResponse
    });
    await this.audit(context, "mobile_link.action", "follow_up", followUp.id, followUp.patientId, {
      action: "confirm_follow_up"
    });
    await this.outbound.workflow.startWorkflow(
      "post-visit-follow-up",
      { followUpId: followUp.id, patientId: followUp.patientId, trigger: "follow_up.confirmed" },
      context
    );
    return followUp;
  }

  async updateMobileChecklist(context: RequestContext, token: string, itemId: string, input: UpdateChecklistInput) {
    const session = this.ensureActionAllowed(token, "update_checklist");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    this.ensureKnownPatient(context, session.patientId);
    await this.audit(context, "mobile_link.action", "checklist_item", itemId, session.patientId, {
      action: "update_checklist",
      completed: Boolean(input.completed)
    });
    return {
      itemId,
      completed: Boolean(input.completed),
      savedAt: nowIso()
    };
  }

  async updateMobileConsent(context: RequestContext, token: string, input: UpdateConsentInput) {
    const session = this.ensureActionAllowed(token, "update_consent");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const patient = this.ensureKnownPatient(context, session.patientId);
    const enabled = Boolean(input.enabled);
    if (input.channel === "aiProcessing") {
      patient.consent.aiProcessing = enabled ? "granted" : "revoked";
    } else if (input.channel === "documentSharing") {
      patient.consent.documentSharing = enabled ? "granted" : "revoked";
    } else if (input.channel === "whatsApp" || input.channel === "calls") {
      patient.consent.communications = enabled ? "granted" : "revoked";
    } else {
      throw new ApiError(400, "Unsupported consent channel");
    }
    patient.updatedAt = nowIso();
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.audit(context, "mobile_link.action", "patient_consent", patient.id, patient.id, {
      action: "update_consent",
      channel: input.channel,
      enabled
    });
    return this.summarizePatient(context, patient);
  }

  async optOutMobileLink(context: RequestContext, token: string, input: OptOutInput = {}) {
    const session = this.ensureActionAllowed(token, "opt_out");
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const patient = this.ensureKnownPatient(context, session.patientId);
    patient.consent.communications = "revoked";
    patient.updatedAt = nowIso();
    await this.persistence.saveCollection("patients", this.data.patients);
    await this.audit(context, "mobile_link.action", "patient_consent", patient.id, patient.id, {
      action: "opt_out",
      scope: input.scope ?? "non_care_messages"
    });
    return this.summarizePatient(context, patient);
  }

  async intakeIntegrationEvent(context: RequestContext, input: Record<string, unknown>) {
    const eventType = integrationEventType(input);
    const payload = isPlainRecord(input.payload) ? input.payload : input;
    let createdResource: unknown;

    if (
      eventType === "whatsapp.message_received" ||
      eventType === "telephony.missed_call" ||
      eventType === "patient.message.received" ||
      eventType === "patient.missed_call.received"
    ) {
      const patientHint = isPlainRecord(payload.patientHint) ? payload.patientHint : {};
      createdResource = await this.createInteraction(context, {
        patientId: typeof payload.patientId === "string" ? payload.patientId : undefined,
        channel: eventType.includes("missed_call") ? "missed_call" : "whatsapp",
        direction: "inbound",
        subject: typeof payload.subject === "string" ? payload.subject : eventType,
        body: typeof payload.body === "string" ? payload.body : typeof payload.summary === "string" ? payload.summary : JSON.stringify(payload),
        from: typeof payload.from === "string" ? payload.from : typeof patientHint.phone === "string" ? patientHint.phone : undefined,
        to: typeof payload.to === "string" ? payload.to : undefined,
        language: typeof payload.language === "string" ? payload.language : undefined,
        createTask: payload.createTask === true
      });
    } else if (eventType === "his.appointment_created" || eventType === "appointment.synced") {
      createdResource = await this.createAppointment(context, {
        patientId: typeof payload.patientId === "string" ? payload.patientId : undefined,
        doctorName: typeof payload.doctorName === "string" ? payload.doctorName : "External doctor",
        specialty: typeof payload.specialty === "string" ? payload.specialty : "External",
        branchId: typeof payload.branchId === "string" ? payload.branchId : undefined,
        scheduledAt: typeof payload.scheduledAt === "string" ? payload.scheduledAt : nowIso(),
        reason: typeof payload.reason === "string" ? payload.reason : "Synced from integration"
      });
    }

    await this.audit(context, "service_webhook.intake", "service_event", eventType, typeof payload.patientId === "string" ? payload.patientId : undefined, {
      eventType,
      source: typeof input.source === "string" ? input.source : "integration-gateway",
      handled: Boolean(createdResource)
    });

    return {
      accepted: true,
      eventType,
      handled: Boolean(createdResource),
      createdResource
    };
  }

  async intakeWorkflowCallback(context: RequestContext, input: Record<string, unknown>) {
    const eventType =
      typeof input.type === "string"
        ? input.type
        : typeof input.workflowType === "string"
          ? `workflow.${input.workflowType}`
          : "workflow.callback";
    const taskId = typeof input.taskId === "string" ? input.taskId : undefined;
    const journeyTaskId = typeof input.journeyTaskId === "string" ? input.journeyTaskId : undefined;
    const journeyId = typeof input.journeyId === "string" ? input.journeyId : undefined;
    let updatedTask: WorkbenchTaskView | undefined;
    let updatedJourneyTask: JourneyTask | undefined;
    let journeyEvent: JourneyEvent | undefined;

    if (taskId && typeof input.status === "string") {
      updatedTask = await this.updateTask(context, taskId, {
        status: input.status as TaskStatus,
        outcome: typeof input.outcome === "string" ? input.outcome : `Workflow callback: ${eventType}`
      });
    }

    if (journeyTaskId && typeof input.status === "string") {
      updatedJourneyTask = await this.updateJourneyTask(context, journeyTaskId, {
        status: input.status as JourneyTaskStatus,
        outcome: typeof input.outcome === "string" ? input.outcome : `Workflow callback: ${eventType}`
      });
    }

    if (journeyId) {
      journeyEvent = await this.createJourneyEvent(context, journeyId, {
        type: "workflow_callback",
        payload: input
      });
    }

    await this.audit(context, "service_webhook.intake", "workflow_callback", eventType, undefined, {
      eventType,
      taskId,
      journeyTaskId,
      journeyId,
      handled: Boolean(updatedTask || updatedJourneyTask || journeyEvent)
    });

    return {
      accepted: true,
      eventType,
      handled: Boolean(updatedTask || updatedJourneyTask || journeyEvent),
      updatedTask,
      updatedJourneyTask,
      journeyEvent
    };
  }

  async triggerWorkflow(context: RequestContext, input: TriggerWorkflowInput) {
    const workflowType = input.workflowType ?? "post-visit-follow-up";
    const patientId = this.ensureWorkflowReferences(context, input);

    await this.outbound.workflow.startWorkflow(
      workflowType,
      {
        patientId,
        appointmentId: input.appointmentId,
        followUpId: input.followUpId,
        taskId: input.taskId,
        trigger: input.trigger ?? "staff.manual_trigger"
      },
      context
    );
    await this.audit(context, "workflow.trigger", "workflow", workflowType, patientId, {
      appointmentId: input.appointmentId,
      followUpId: input.followUpId,
      taskId: input.taskId,
      trigger: input.trigger ?? "staff.manual_trigger"
    });

    return {
      accepted: true,
      workflowType
    };
  }

  listJourneyTemplates(context: RequestContext) {
    return this.data.journeyTemplates.filter((entry) => entry.tenantId === context.tenantId && entry.status !== "retired");
  }

  async createJourneyTemplate(context: RequestContext, input: CreateJourneyTemplateInput) {
    const timestamp = nowIso();
    const template: JourneyTemplate = {
      id: createId("journey_template"),
      tenantId: context.tenantId,
      name: ensureString(input.name, "name"),
      condition: ensureString(input.condition, "condition"),
      status: "active",
      defaultOwnerRole: input.defaultOwnerRole ?? "care_coordinator",
      steps: input.steps?.length ? input.steps : [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.journeyTemplates.push(template);
    await this.persistence.saveCollection("journeyTemplates", this.data.journeyTemplates);
    await this.audit(context, "journey.create", "journey_template", template.id, undefined, {
      condition: template.condition
    });
    return template;
  }

  listPatientJourneys(context: RequestContext, filters: { patientId?: string; status?: string }) {
    return this.data.patientJourneys
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) return false;
        if (!this.canAccessPatientId(context, entry.patientId)) return false;
        if (filters.patientId && entry.patientId !== filters.patientId) return false;
        if (filters.status && entry.status !== filters.status) return false;
        return true;
      })
      .map((journey) => this.patientJourneyView(context, journey))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getPatientJourney(context: RequestContext, journeyId: string) {
    return this.patientJourneyView(context, this.ensureVisiblePatientJourney(context, journeyId));
  }

  async createPatientJourney(context: RequestContext, input: CreatePatientJourneyInput) {
    const patient = this.ensureKnownPatient(context, ensureString(input.patientId, "patientId"));
    const template = input.templateId
      ? this.data.journeyTemplates.find((entry) => entry.id === input.templateId && entry.tenantId === context.tenantId)
      : undefined;
    if (input.templateId && !template) {
      throw new ApiError(404, `Journey template not found: ${input.templateId}`);
    }
    const timestamp = nowIso();
    const journey: PatientJourney = {
      id: createId("journey"),
      tenantId: context.tenantId,
      patientId: patient.id,
      templateId: template?.id,
      title: input.title ?? template?.name ?? `${patient.displayName} care journey`,
      status: input.start === false ? "planned" : "active",
      ownerRole: input.ownerRole ?? template?.defaultOwnerRole ?? "care_coordinator",
      startedAt: input.start === false ? undefined : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.patientJourneys.push(journey);
    this.data.journeyEvents.push(this.createJourneyEventRecord(context, journey, "created", { templateId: template?.id }));
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);

    if (template?.steps.length) {
      for (const step of template.steps) {
        await this.createJourneyTask(context, journey.id, {
          title: step.title,
          dueAt: new Date(Date.now() + step.offsetDays * 24 * 60 * 60_000).toISOString(),
          ownerRole: journey.ownerRole,
          instructions: step.instructions,
          createFollowUp: true
        });
      }
    }

    await this.audit(context, "journey.create", "patient_journey", journey.id, journey.patientId, {
      templateId: journey.templateId,
      status: journey.status
    });
    return this.patientJourneyView(context, journey);
  }

  async updatePatientJourney(context: RequestContext, journeyId: string, input: UpdatePatientJourneyInput) {
    const journey = this.ensureVisiblePatientJourney(context, journeyId);
    const timestamp = nowIso();
    if (input.status) {
      journey.status = input.status;
      journey.startedAt = input.status === "active" ? journey.startedAt ?? timestamp : journey.startedAt;
      journey.completedAt = input.status === "completed" ? timestamp : journey.completedAt;
      this.data.journeyEvents.push(
        this.createJourneyEventRecord(context, journey, input.status === "completed" ? "completed" : "started", {
          status: journey.status,
          outcome: input.outcome
        })
      );
    }
    journey.updatedAt = timestamp;
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    await this.audit(context, "journey.update", "patient_journey", journey.id, journey.patientId, {
      status: journey.status,
      outcome: input.outcome
    });
    return this.patientJourneyView(context, journey);
  }

  async createJourneyTask(context: RequestContext, journeyId: string, input: CreateJourneyTaskInput) {
    const journey = this.ensureVisiblePatientJourney(context, journeyId);
    const timestamp = nowIso();
    const task: JourneyTask = {
      id: createId("journey_task"),
      tenantId: context.tenantId,
      journeyId: journey.id,
      patientId: journey.patientId,
      title: ensureString(input.title, "title"),
      status: "pending",
      dueAt: ensureString(input.dueAt, "dueAt"),
      ownerRole: input.ownerRole ?? journey.ownerRole,
      instructions: input.instructions ?? "Follow journey task instructions.",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (input.createFollowUp !== false) {
      const followUp: FollowUp = {
        id: createId("followup"),
        tenantId: context.tenantId,
        patientId: journey.patientId,
        title: task.title,
        dueAt: task.dueAt,
        status: "due",
        instructions: task.instructions,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.data.followUps.push(followUp);
      task.followUpId = followUp.id;
      await this.persistence.saveCollection("followUps", this.data.followUps);
    }
    this.data.journeyTasks.push(task);
    this.data.journeyEvents.push(this.createJourneyEventRecord(context, journey, "task_created", { taskId: task.id }));
    journey.updatedAt = timestamp;
    await this.persistence.saveCollection("journeyTasks", this.data.journeyTasks);
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.audit(context, "journey.update", "journey_task", task.id, task.patientId, {
      journeyId,
      status: task.status
    });
    return task;
  }

  async updateJourneyTask(context: RequestContext, taskId: string, input: UpdateJourneyTaskInput) {
    const task = this.ensureVisibleJourneyTask(context, taskId);
    const timestamp = nowIso();
    if (input.status) {
      task.status = input.status;
      task.completedAt = input.status === "completed" ? timestamp : task.completedAt;
      if (task.followUpId) {
        const followUp = this.data.followUps.find((entry) => entry.id === task.followUpId && entry.tenantId === context.tenantId);
        if (followUp) {
          followUp.status = input.status === "completed" ? "completed" : followUp.status;
          followUp.updatedAt = timestamp;
          await this.persistence.saveCollection("followUps", this.data.followUps);
        }
      }
    }
    task.outcome = input.outcome ?? task.outcome;
    task.updatedAt = timestamp;
    const journey = this.ensureVisiblePatientJourney(context, task.journeyId);
    journey.updatedAt = timestamp;
    this.data.journeyEvents.push(
      this.createJourneyEventRecord(context, journey, "task_updated", {
        taskId: task.id,
        status: task.status,
        outcome: task.outcome
      })
    );
    await this.persistence.saveCollection("journeyTasks", this.data.journeyTasks);
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    await this.audit(context, "journey.update", "journey_task", task.id, task.patientId, {
      journeyId: task.journeyId,
      status: task.status,
      outcome: task.outcome
    });
    return task;
  }

  async createJourneyEvent(context: RequestContext, journeyId: string, input: CreateJourneyEventInput) {
    const journey = this.ensureVisiblePatientJourney(context, journeyId);
    const event = this.createJourneyEventRecord(context, journey, input.type ?? "note", input.payload ?? {});
    this.data.journeyEvents.push(event);
    journey.updatedAt = event.occurredAt;
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.audit(context, "journey.update", "journey_event", event.id, journey.patientId, {
      journeyId,
      type: event.type
    });
    return event;
  }

  /**
   * Journey-triggered transactional message: send a WhatsApp to the journey
   * patient's primary phone and record a "message_sent" journey event. Real
   * recurring journey automation lives in workflow-worker.
   */
  async sendJourneyMessage(context: RequestContext, journeyId: string, input: JourneySendMessageInput) {
    const journey = this.ensureVisiblePatientJourney(context, journeyId);
    const patient = this.ensureKnownPatient(context, journey.patientId);
    const body = ensureString(input.body, "body");
    if (!patient.primaryPhone || !patient.primaryPhone.trim()) {
      throw new ApiError(400, "Patient has no primary phone on file.");
    }
    const send = await this.sendMessage(context, { to: patient.primaryPhone, type: "transactional", body });
    const timestamp = nowIso();
    const event = this.createJourneyEventRecord(context, journey, "message_sent", {
      messageId: send.messageId,
      to: patient.primaryPhone,
      status: send.ok ? "sent" : "failed",
      body
    });
    this.data.journeyEvents.push(event);
    journey.updatedAt = timestamp;
    await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
    await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    await this.audit(context, "journey.message", "patient_journey", journey.id, journey.patientId, {
      messageId: send.messageId,
      status: send.ok ? "sent" : "failed"
    });
    return { ok: send.ok, journeyId: journey.id, event, message: send };
  }

  // ---- Continuity: staff follow-ups -----------------------------------------

  private followUpView(context: RequestContext, followUp: FollowUp) {
    const patient = this.data.patients.find(
      (entry) => entry.id === followUp.patientId && entry.tenantId === context.tenantId
    );
    return { ...followUp, patientName: patient?.displayName };
  }

  listFollowUps(context: RequestContext, filters: { status?: string }) {
    return this.data.followUps
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) return false;
        if (!this.canAccessPatientId(context, entry.patientId)) return false;
        if (filters.status && entry.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .map((entry) => this.followUpView(context, entry));
  }

  async createFollowUp(context: RequestContext, input: CreateFollowUpInput) {
    const patient = this.ensureKnownPatient(context, ensureString(input.patientId, "patientId"));
    const timestamp = nowIso();
    const followUp: FollowUp = {
      id: createId("followup"),
      tenantId: context.tenantId,
      patientId: patient.id,
      title: ensureString(input.title, "title"),
      dueAt: ensureString(input.dueAt, "dueAt"),
      status: "due",
      instructions: input.instructions ?? "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.followUps.push(followUp);
    await this.persistence.saveCollection("followUps", this.data.followUps);

    if (input.journeyId) {
      const journey = this.ensureVisiblePatientJourney(context, input.journeyId);
      const task: JourneyTask = {
        id: createId("journey_task"),
        tenantId: context.tenantId,
        journeyId: journey.id,
        patientId: patient.id,
        followUpId: followUp.id,
        title: followUp.title,
        status: "pending",
        dueAt: followUp.dueAt,
        ownerRole: journey.ownerRole,
        instructions: followUp.instructions || "Follow journey task instructions.",
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.data.journeyTasks.push(task);
      this.data.journeyEvents.push(this.createJourneyEventRecord(context, journey, "task_created", { taskId: task.id }));
      journey.updatedAt = timestamp;
      await this.persistence.saveCollection("journeyTasks", this.data.journeyTasks);
      await this.persistence.saveCollection("journeyEvents", this.data.journeyEvents);
      await this.persistence.saveCollection("patientJourneys", this.data.patientJourneys);
    }

    await this.audit(context, "follow_up.create", "follow_up", followUp.id, followUp.patientId, {
      journeyId: input.journeyId
    });
    return this.followUpView(context, followUp);
  }

  private ensureVisibleFollowUp(context: RequestContext, followUpId: string): FollowUp {
    const followUp = this.data.followUps.find((entry) => entry.id === followUpId && entry.tenantId === context.tenantId);
    if (!followUp) {
      throw new ApiError(404, `Follow-up not found: ${followUpId}`);
    }
    this.ensureKnownPatient(context, followUp.patientId);
    return followUp;
  }

  async updateFollowUp(context: RequestContext, followUpId: string, input: UpdateFollowUpInput) {
    const followUp = this.ensureVisibleFollowUp(context, followUpId);
    const timestamp = nowIso();
    if (input.status) {
      const allowed: FollowUp["status"][] = ["due", "confirmed", "completed", "missed", "escalated"];
      if (!allowed.includes(input.status)) {
        throw new ApiError(400, `Invalid follow-up status: ${input.status}`);
      }
      followUp.status = input.status;
      if (input.status === "confirmed") {
        followUp.confirmedAt = timestamp;
      }
    }
    if (input.dueAt) followUp.dueAt = input.dueAt;
    if (input.instructions !== undefined) followUp.instructions = input.instructions;
    followUp.updatedAt = timestamp;
    await this.persistence.saveCollection("followUps", this.data.followUps);
    await this.audit(context, "follow_up.update", "follow_up", followUp.id, followUp.patientId, {
      status: followUp.status
    });
    return this.followUpView(context, followUp);
  }

  async remindFollowUp(context: RequestContext, followUpId: string) {
    const followUp = this.ensureVisibleFollowUp(context, followUpId);
    const patient = this.ensureKnownPatient(context, followUp.patientId);
    if (!patient.primaryPhone || !patient.primaryPhone.trim()) {
      throw new ApiError(400, "Patient has no primary phone on file.");
    }
    const dueText = formatDue(followUp.dueAt);
    const body = `Reminder: ${followUp.title} is due ${dueText}.${
      followUp.instructions ? ` ${followUp.instructions}` : ""
    }`;
    const send = await this.sendMessage(context, { to: patient.primaryPhone, type: "transactional", body });
    await this.audit(context, "follow_up.remind", "follow_up", followUp.id, followUp.patientId, {
      messageId: send.messageId,
      status: send.ok ? "sent" : "failed"
    });
    return { ok: send.ok, followUpId: followUp.id, message: send };
  }

  // ---- Billing: invoices & payments -----------------------------------------

  private invoiceView(context: RequestContext, invoice: Invoice) {
    const patient = this.data.patients.find(
      (entry) => entry.id === invoice.patientId && entry.tenantId === context.tenantId
    );
    return { ...invoice, patientName: patient?.displayName };
  }

  private sanitizeInvoiceItems(value: unknown): InvoiceLineItem[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ApiError(400, "At least one invoice item is required.");
    }
    return value.map((raw) => {
      const item = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
      const description = ensureString(item.description, "items[].description");
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new ApiError(400, "Each invoice item needs a non-negative numeric amount.");
      }
      return { description, amount };
    });
  }

  listInvoices(context: RequestContext, filters: { patientId?: string; status?: string }) {
    return this.data.invoices
      .filter((entry) => {
        if (entry.tenantId !== context.tenantId) return false;
        if (!this.canAccessPatientId(context, entry.patientId)) return false;
        if (filters.patientId && entry.patientId !== filters.patientId) return false;
        if (filters.status && entry.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => this.invoiceView(context, entry));
  }

  getPatientInvoices(context: RequestContext, patientId: string) {
    this.ensureKnownPatient(context, patientId);
    const invoices = this.data.invoices
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => this.invoiceView(context, entry));
    const billed = invoices.reduce((sum, entry) => sum + entry.total, 0);
    const settled = invoices.reduce((sum, entry) => sum + entry.amountSettled, 0);
    return { invoices, summary: { billed, settled, outstanding: billed - settled } };
  }

  async createInvoice(context: RequestContext, input: CreateInvoiceInput) {
    const patient = this.ensureKnownPatient(context, ensureString(input.patientId, "patientId"));
    const items = this.sanitizeInvoiceItems(input.items);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const timestamp = nowIso();
    const invoice: Invoice = {
      id: createId("invoice"),
      tenantId: context.tenantId,
      patientId: patient.id,
      appointmentId: typeof input.appointmentId === "string" ? input.appointmentId : undefined,
      items,
      currency: "INR",
      total,
      amountSettled: 0,
      status: "unpaid",
      payments: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.invoices.push(invoice);
    await this.persistence.saveCollection("invoices", this.data.invoices);
    await this.audit(context, "invoice.create", "invoice", invoice.id, invoice.patientId, { total });
    return this.invoiceView(context, invoice);
  }

  private ensureVisibleInvoice(context: RequestContext, invoiceId: string): Invoice {
    const invoice = this.data.invoices.find((entry) => entry.id === invoiceId && entry.tenantId === context.tenantId);
    if (!invoice) {
      throw new ApiError(404, `Invoice not found: ${invoiceId}`);
    }
    this.ensureKnownPatient(context, invoice.patientId);
    return invoice;
  }

  async recordInvoicePayment(context: RequestContext, invoiceId: string, input: RecordPaymentInput) {
    const invoice = this.ensureVisibleInvoice(context, invoiceId);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Payment amount must be a positive number.");
    }
    if (invoice.amountSettled + amount > invoice.total) {
      throw new ApiError(400, "Payment exceeds the outstanding balance on this invoice.");
    }
    const timestamp = nowIso();
    invoice.payments.push({
      amount,
      method: typeof input.method === "string" ? input.method : undefined,
      note: typeof input.note === "string" ? input.note : undefined,
      at: timestamp
    });
    invoice.amountSettled += amount;
    invoice.status = invoice.amountSettled >= invoice.total ? "paid" : "partial";
    invoice.updatedAt = timestamp;
    await this.persistence.saveCollection("invoices", this.data.invoices);
    await this.audit(context, "payment.record", "invoice", invoice.id, invoice.patientId, {
      amount,
      status: invoice.status
    });
    return this.invoiceView(context, invoice);
  }

  getBillingSummary(context: RequestContext) {
    const invoices = this.data.invoices.filter(
      (entry) => entry.tenantId === context.tenantId && this.canAccessPatientId(context, entry.patientId)
    );
    const billed = invoices.reduce((sum, entry) => sum + entry.total, 0);
    const settled = invoices.reduce((sum, entry) => sum + entry.amountSettled, 0);
    const unpaidCount = invoices.filter((entry) => entry.status !== "paid").length;
    return { billed, settled, outstanding: billed - settled, unpaidCount };
  }

  private staffAuditEvents(context: RequestContext) {
    return this.data.auditEvents
      .filter((event) => event.tenantId === context.tenantId && (!event.patientId || this.canAccessPatientId(context, event.patientId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((event) => ({
        id: event.id,
        at: event.createdAt,
        actor: event.actorDisplayName,
        actorRole: event.actorType === "staff" ? context.roles[0] ?? "admin" : event.actorType,
        action: event.action,
        resource: event.resourceId ?? event.resourceType,
        tenantId: event.tenantId,
        outcome: event.actorType === "service" ? "system" : "allowed",
        summary: `${event.action} on ${event.resourceType}`
      }));
  }

  private staffPatientTimeline(context: RequestContext, patientId: string) {
    const interactionEvents = this.data.interactions
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .map((entry) => ({
        at: formatAge(entry.receivedAt),
        title: entry.subject,
        note: entry.body
      }));
    const taskEvents = this.data.tasks
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .map((entry) => ({
        at: formatAge(entry.updatedAt),
        title: entry.title,
        note: entry.recommendedAction
      }));
    const appointmentEvents = this.data.appointments
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patientId)
      .map((raw) => {
        // Resolve doctor name/specialty from the live record (stored copy may be stale).
        const entry = this.decorateAppointment(context, raw);
        return {
          at: formatDue(entry.scheduledAt),
          title: entry.reason,
          note: `${entry.doctorName}, ${entry.specialty}`
        };
      });

    return [...interactionEvents, ...taskEvents, ...appointmentEvents].slice(0, 5);
  }

  private createTaskFromInteraction(
    context: RequestContext,
    interaction: Interaction,
    ownerRole?: WorkbenchTask["ownerRole"]
  ): WorkbenchTask {
    const timestamp = nowIso();
    const task: WorkbenchTask = {
      id: createId("task"),
      tenantId: context.tenantId,
      patientId: interaction.patientId,
      interactionId: interaction.id,
      title: interaction.intent ? `Handle ${interaction.intent}` : interaction.subject,
      priority: interaction.urgency ?? "medium",
      dueAt: timestamp,
      status: "open",
      ownerRole: ownerRole ?? (interaction.urgency === "urgent" ? "nurse" : "front_desk"),
      reason: interaction.body,
      recommendedAction: "Review the interaction, contact the patient, and close the loop.",
      source: "healthcareos",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.tasks.push(task);
    return task;
  }

  private ensureKnownPatient(context: RequestContext, patientId: string): Patient {
    const patient = this.data.patients.find((entry) => entry.id === patientId && entry.tenantId === context.tenantId);
    if (!patient) {
      throw new ApiError(404, `Patient not found: ${patientId}`);
    }
    if (!this.canAccessPatient(context, patient)) {
      throw new ApiError(403, "Patient is outside the actor's branch scope");
    }
    return patient;
  }

  private ensureVisibleInteraction(context: RequestContext, interactionId: string): Interaction {
    const interaction = this.data.interactions.find((entry) => entry.id === interactionId && entry.tenantId === context.tenantId);
    if (!interaction) {
      throw new ApiError(404, `Interaction not found: ${interactionId}`);
    }
    if (interaction.patientId && !this.canAccessPatientId(context, interaction.patientId)) {
      throw new ApiError(403, "Interaction is outside the actor's branch scope");
    }
    return interaction;
  }

  private ensureVisibleHousehold(context: RequestContext, householdId: string): Household {
    const household = this.data.households.find((entry) => entry.id === householdId && entry.tenantId === context.tenantId);
    if (!household) {
      throw new ApiError(404, `Household not found: ${householdId}`);
    }
    if (!this.canAccessHousehold(context, household)) {
      throw new ApiError(403, "Household is outside the actor's branch scope");
    }
    return household;
  }

  private ensureVisibleAccessRequest(context: RequestContext, accessRequestId: string): AccessRequest {
    const request = this.data.accessRequests.find((entry) => entry.id === accessRequestId && entry.tenantId === context.tenantId);
    if (!request) {
      throw new ApiError(404, `Access request not found: ${accessRequestId}`);
    }
    if (request.patientId && !this.canAccessPatientId(context, request.patientId)) {
      throw new ApiError(403, "Access request is outside the actor's branch scope");
    }
    if (request.requestedBranchId && !this.canAccessBranch(context, request.requestedBranchId)) {
      throw new ApiError(403, "Access request is outside the actor's branch scope");
    }
    return request;
  }

  private ensureVisiblePatientJourney(context: RequestContext, journeyId: string): PatientJourney {
    const journey = this.data.patientJourneys.find((entry) => entry.id === journeyId && entry.tenantId === context.tenantId);
    if (!journey) {
      throw new ApiError(404, `Patient journey not found: ${journeyId}`);
    }
    this.ensureKnownPatient(context, journey.patientId);
    return journey;
  }

  private ensureVisibleJourneyTask(context: RequestContext, taskId: string): JourneyTask {
    const task = this.data.journeyTasks.find((entry) => entry.id === taskId && entry.tenantId === context.tenantId);
    if (!task) {
      throw new ApiError(404, `Journey task not found: ${taskId}`);
    }
    this.ensureKnownPatient(context, task.patientId);
    return task;
  }

  private linkPatientToHousehold(context: RequestContext, patient: Patient, input: UpdateHouseholdLinkInput): Household {
    const timestamp = nowIso();
    let household: Household | undefined;
    if (input.householdId) {
      household = this.ensureVisibleHousehold(context, input.householdId);
    } else {
      household = {
        id: createId("household"),
        tenantId: context.tenantId,
        displayName: input.displayName ?? `${patient.displayName} household`,
        primaryPhone: patient.primaryPhone,
        alternatePhones: [],
        preferredLanguage: patient.preferredLanguage,
        riskNotes: [],
        members: [],
        caregiverPermissions: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.data.households.push(household);
    }
    if (!this.canAccessBranch(context, patient.branchId)) {
      throw new ApiError(403, "Cannot update a household outside the actor's branch scope");
    }
    patient.householdId = household.id;
    const existingMember = household.members.find((member) => member.patientId === patient.id);
    if (existingMember) {
      existingMember.displayName = patient.displayName;
      existingMember.relationship = input.relationship ?? existingMember.relationship;
      existingMember.branchId = patient.branchId;
      existingMember.primaryContact = input.primaryContact ?? existingMember.primaryContact;
    } else {
      household.members.push({
        patientId: patient.id,
        displayName: patient.displayName,
        relationship: input.relationship ?? "self",
        branchId: patient.branchId,
        primaryContact: input.primaryContact ?? household.members.length === 0
      });
    }
    household.updatedAt = timestamp;
    return household;
  }

  private identityScore(
    patient: Patient,
    filters: { query?: string; phone?: string; uhid?: string; abhaId?: string }
  ): number {
    let score = 0;
    const normalizedPatientPhone = normalizePhone(patient.primaryPhone);
    if (filters.uhid && patient.uhid?.toLowerCase() === filters.uhid.toLowerCase()) score += 80;
    if (filters.abhaId && patient.abhaId?.toLowerCase() === filters.abhaId.toLowerCase()) score += 80;
    if (filters.phone && normalizedPatientPhone && normalizedPatientPhone === filters.phone) score += 60;
    if (filters.query) {
      const query = filters.query;
      const patientName = patient.displayName.toLowerCase();
      if (patientName === query) score += 50;
      else if (patientName.includes(query) || query.includes(patientName)) score += 30;
      if (patient.tags.some((tag) => tag.toLowerCase().includes(query))) score += 10;
    }
    return Math.min(score, 100);
  }

  private identityMatchedOn(
    patient: Patient,
    filters: { query?: string; phone?: string; uhid?: string; abhaId?: string }
  ) {
    const matchedOn: string[] = [];
    if (filters.uhid && patient.uhid?.toLowerCase() === filters.uhid.toLowerCase()) matchedOn.push("uhid");
    if (filters.abhaId && patient.abhaId?.toLowerCase() === filters.abhaId.toLowerCase()) matchedOn.push("abhaId");
    if (filters.phone && normalizePhone(patient.primaryPhone) === filters.phone) matchedOn.push("phone");
    if (filters.query && patient.displayName.toLowerCase().includes(filters.query)) matchedOn.push("name");
    return matchedOn;
  }

  private ensureWorkflowReferences(context: RequestContext, input: TriggerWorkflowInput): string | undefined {
    const patientIds = new Set<string>();

    if (input.patientId) {
      patientIds.add(this.ensureKnownPatient(context, input.patientId).id);
    }

    if (input.appointmentId) {
      const appointment = this.data.appointments.find((entry) => entry.id === input.appointmentId && entry.tenantId === context.tenantId);
      if (!appointment) {
        throw new ApiError(404, `Appointment not found: ${input.appointmentId}`);
      }
      if (!this.canAccessBranch(context, appointment.branchId)) {
        throw new ApiError(403, "Appointment is outside the actor's branch scope");
      }
      patientIds.add(appointment.patientId);
    }

    if (input.followUpId) {
      const followUp = this.data.followUps.find((entry) => entry.id === input.followUpId && entry.tenantId === context.tenantId);
      if (!followUp) {
        throw new ApiError(404, `Follow-up not found: ${input.followUpId}`);
      }
      this.ensureKnownPatient(context, followUp.patientId);
      patientIds.add(followUp.patientId);
    }

    if (input.taskId) {
      const task = this.data.tasks.find((entry) => entry.id === input.taskId && entry.tenantId === context.tenantId);
      if (!task) {
        throw new ApiError(404, `Task not found: ${input.taskId}`);
      }
      if (task.patientId) {
        this.ensureKnownPatient(context, task.patientId);
        patientIds.add(task.patientId);
      }
    }

    if (patientIds.size > 1) {
      throw new ApiError(400, "Workflow references must belong to the same patient");
    }

    return [...patientIds][0] ?? input.patientId;
  }

  private canAccessBranch(context: RequestContext, branchId: string): boolean {
    if (context.actorType !== "staff") {
      return true;
    }
    if (context.roles.includes("org_admin") || context.roles.includes("admin")) {
      return true;
    }
    return context.branchIds.includes(branchId);
  }

  private canAccessPatient(context: RequestContext, patient: Patient): boolean {
    return patient.tenantId === context.tenantId && this.canAccessBranch(context, patient.branchId);
  }

  private canAccessPatientId(context: RequestContext, patientId: string): boolean {
    const patient = this.data.patients.find((entry) => entry.id === patientId && entry.tenantId === context.tenantId);
    return Boolean(patient && this.canAccessPatient(context, patient));
  }

  private canAccessHousehold(context: RequestContext, household: Household): boolean {
    return household.tenantId === context.tenantId && household.members.some((member) => this.canAccessBranch(context, member.branchId));
  }

  private ensureSession(token: string) {
    const session = this.data.sessions.find((entry) => entry.token === token);
    if (!session) {
      throw new ApiError(404, "Mobile link session not found");
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      throw new ApiError(410, "Mobile link session has expired");
    }
    return session;
  }

  private ensureActionAllowed(token: string, action: MobileLinkSession["allowedActions"][number]) {
    const session = this.ensureSession(token);
    if (!session.allowedActions.includes(action)) {
      throw new ApiError(403, `Mobile link action is not allowed: ${action}`);
    }
    return session;
  }

  private tenantPatients(context: RequestContext) {
    return this.data.patients.filter((entry) => entry.tenantId === context.tenantId && this.canAccessPatient(context, entry));
  }

  private visibleHouseholds(context: RequestContext) {
    return this.data.households.filter(
      (household) => household.tenantId === context.tenantId && this.canAccessHousehold(context, household)
    );
  }

  // ---- Lead config (tenant-configurable CRM funnel) ------------------------

  private tenantLeadConfig(tenantId: string): LeadConfig | undefined {
    return this.data.leadConfigs.find((entry) => entry.tenantId === tenantId);
  }

  /** Resolve a tenant's CRM funnel config, lazily provisioning defaults the first
   *  time it's needed (mirrors the channel-config getter). Always returns a config
   *  with at least one source and one ordered stage. */
  private async resolveLeadConfig(context: RequestContext): Promise<LeadConfig> {
    let config = this.tenantLeadConfig(context.tenantId);
    if (!config) {
      const now = nowIso();
      config = {
        tenantId: context.tenantId,
        sources: DEFAULT_LEAD_SOURCES.map((s) => ({ ...s })),
        stages: DEFAULT_LEAD_STAGES.map((s) => ({ ...s })),
        createdAt: now,
        updatedAt: now
      };
      this.data.leadConfigs.push(config);
      await this.persistence.saveCollection("leadConfigs", this.data.leadConfigs);
    } else if (
      // Auto-upgrade tenants still on the legacy default (which mixed marketing
      // sources with import mechanisms) to the clean marketing-only defaults.
      config.sources.length === LEGACY_DEFAULT_SOURCE_KEYS.length &&
      config.sources.every((s) => LEGACY_DEFAULT_SOURCE_KEYS.includes(s.key))
    ) {
      config.sources = DEFAULT_LEAD_SOURCES.map((s) => ({ ...s }));
      config.updatedAt = nowIso();
      await this.persistence.saveCollection("leadConfigs", this.data.leadConfigs);
    }
    return config;
  }

  /** GET /tenant/lead-config — resolved {sources, stages} for the active tenant. */
  async getLeadConfig(context: RequestContext) {
    const config = await this.resolveLeadConfig(context);
    return { sources: config.sources, stages: config.stages };
  }

  /** PATCH /tenant/lead-config — replace sources and/or stages (ordered). */
  async updateLeadConfig(context: RequestContext, input: LeadConfigInput) {
    const config = await this.resolveLeadConfig(context);
    if (input.sources !== undefined) {
      config.sources = this.parseLeadOptions(input.sources, "source");
    }
    if (input.stages !== undefined) {
      config.stages = this.parseLeadOptions(input.stages, "stage");
    }
    config.updatedAt = nowIso();
    await this.persistence.saveCollection("leadConfigs", this.data.leadConfigs);
    await this.audit(context, "lead_config.update", "lead_config", context.tenantId, undefined, {
      sources: config.sources.length,
      stages: config.stages.length
    });
    return { sources: config.sources, stages: config.stages };
  }

  /** Validate an incoming sources/stages list: each entry needs a non-empty
   *  slug key + label, keys unique within the list, and at least one entry. */
  private parseLeadOptions(value: unknown, kind: "source" | "stage"): LeadSourceOption[] {
    if (!Array.isArray(value)) {
      throw new ApiError(400, `lead-config ${kind}s must be an array.`);
    }
    const seen = new Set<string>();
    const parsed: LeadSourceOption[] = [];
    for (const raw of value) {
      if (!isPlainRecord(raw)) {
        throw new ApiError(400, `Each ${kind} must be an object with key and label.`);
      }
      const keyRaw = typeof raw.key === "string" ? raw.key : "";
      const key = slugifyKey(keyRaw);
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      if (!key) {
        throw new ApiError(400, `Each ${kind} needs a non-empty key.`);
      }
      if (!label) {
        throw new ApiError(400, `${kind} "${key}" needs a non-empty label.`);
      }
      if (seen.has(key)) {
        throw new ApiError(400, `Duplicate ${kind} key: ${key}.`);
      }
      seen.add(key);
      parsed.push({ key, label });
    }
    if (parsed.length === 0) {
      throw new ApiError(400, `At least one ${kind} is required.`);
    }
    return parsed;
  }

  // ---- Lead-sheet ingest (CRM Phase 3: Google Sheet published CSV) ----------

  private tenantLeadSheetConfig(tenantId: string): LeadSheetConfig | undefined {
    return this.data.leadSheetConfigs.find((entry) => entry.tenantId === tenantId);
  }

  /** Resolve a tenant's Google-Sheet ingest config, lazily provisioning a disabled
   *  default (empty mapping, no importedKeys) the first time it's needed. Mirrors
   *  resolveLeadConfig / the channel-config getter. */
  private async resolveLeadSheetConfig(context: RequestContext): Promise<LeadSheetConfig> {
    let config = this.tenantLeadSheetConfig(context.tenantId);
    if (!config) {
      const now = nowIso();
      config = {
        tenantId: context.tenantId,
        enabled: false,
        mapping: {},
        importedKeys: [],
        createdAt: now,
        updatedAt: now
      };
      this.data.leadSheetConfigs.push(config);
      await this.persistence.saveCollection("leadSheetConfigs", this.data.leadSheetConfigs);
    }
    return config;
  }

  /** GET /tenant/lead-sheet — resolved config for the active tenant. */
  async getLeadSheetConfig(context: RequestContext) {
    return this.resolveLeadSheetConfig(context);
  }

  /** PATCH /tenant/lead-sheet — connect/disconnect a published-CSV sheet, set the
   *  column mapping + source. Validates csvUrl is an http(s) URL when provided and
   *  that sourceKey (when given) is one of the tenant's configured lead sources. */
  async updateLeadSheetConfig(context: RequestContext, input: LeadSheetConfigInput) {
    const config = await this.resolveLeadSheetConfig(context);
    if (input.enabled !== undefined) {
      config.enabled = input.enabled === true;
    }
    if (input.csvUrl !== undefined) {
      if (input.csvUrl === null || input.csvUrl === "") {
        config.csvUrl = undefined;
      } else {
        const url = typeof input.csvUrl === "string" ? input.csvUrl.trim() : "";
        if (!isHttpUrl(url)) {
          throw new ApiError(400, "csvUrl must be a valid http(s) URL.");
        }
        config.csvUrl = url;
      }
    }
    if (input.mapping !== undefined) {
      config.mapping = sanitizeSheetMapping(input.mapping);
    }
    if (input.sourceKey !== undefined) {
      if (input.sourceKey === null || input.sourceKey === "") {
        config.sourceKey = undefined;
      } else {
        const leadConfig = await this.resolveLeadConfig(context);
        const key = typeof input.sourceKey === "string" ? input.sourceKey.trim() : "";
        if (!leadConfig.sources.some((s) => s.key === key)) {
          throw new ApiError(400, `Unknown lead source: ${key}`);
        }
        config.sourceKey = key;
      }
    }
    config.updatedAt = nowIso();
    await this.persistence.saveCollection("leadSheetConfigs", this.data.leadSheetConfigs);
    await this.audit(context, "lead_sheet.update", "lead_sheet", context.tenantId, undefined, {
      enabled: config.enabled,
      connected: Boolean(config.csvUrl)
    });
    return config;
  }

  /** POST /tenant/lead-sheet/sync — fetch the published CSV, parse it, and create a
   *  lead per NEW row (deduped by normalized phone via importedKeys). Network/parse
   *  failures are recorded in lastResult.error and returned gracefully (no throw),
   *  except the not-connected guard which is a 400. */
  async syncLeadSheet(context: RequestContext): Promise<{ imported: number; skipped: number; total: number }> {
    const config = await this.resolveLeadSheetConfig(context);
    if (!config.enabled || !config.csvUrl) {
      throw new ApiError(400, "Google Sheet is not connected.");
    }
    const at = nowIso();
    let text: string;
    try {
      const res = await fetch(config.csvUrl);
      if (!res.ok) {
        throw new Error(`Sheet responded ${res.status}`);
      }
      text = await res.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch sheet.";
      config.lastSyncedAt = at;
      config.lastResult = { imported: 0, skipped: 0, total: 0, error: message, at };
      config.updatedAt = at;
      await this.persistence.saveCollection("leadSheetConfigs", this.data.leadSheetConfigs);
      await this.audit(context, "lead_sheet.sync", "lead_sheet", context.tenantId, undefined, { error: message });
      return { imported: 0, skipped: 0, total: 0 };
    }
    const rows = parseCsv(text);
    const result = await this.ingestSheetRows(context, config, rows);
    config.lastSyncedAt = at;
    config.lastResult = { ...result, at };
    config.updatedAt = at;
    await this.persistence.saveCollection("leadSheetConfigs", this.data.leadSheetConfigs);
    await this.audit(context, "lead_sheet.sync", "lead_sheet", context.tenantId, undefined, result);
    return result;
  }

  /**
   * Core row→lead ingest, isolated from the fetch wrapper so it's testable without
   * a live network call. Takes already-parsed CSV rows (header row + data rows),
   * resolves column indexes from the config's mapping, and for each data row:
   * normalizes the phone, skips blanks/dupes (already in importedKeys), else creates
   * a Lead (source = config.sourceKey resolved to a configured source else "import")
   * and records the phone. Persists created leads + the updated importedKeys.
   * Returns { imported, skipped, total } where total = data-row count.
   */
  async ingestSheetRows(
    context: RequestContext,
    config: LeadSheetConfig,
    rows: string[][]
  ): Promise<{ imported: number; skipped: number; total: number }> {
    const leadConfig = await this.resolveLeadConfig(context);
    const source = sanitizeLeadSource(config.sourceKey, leadConfig.sources, leadConfig.sources[0]?.key);
    const header = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const total = dataRows.length;

    const headerIndex = (label?: string): number => {
      if (!label) {
        return -1;
      }
      const target = label.trim().toLowerCase();
      return header.findIndex((h) => h.trim().toLowerCase() === target);
    };
    const nameIdx = headerIndex(config.mapping.name);
    const phoneIdx = headerIndex(config.mapping.phone);
    const emailIdx = headerIndex(config.mapping.email);

    const cell = (cols: string[], idx: number): string => (idx >= 0 && idx < cols.length ? cols[idx].trim() : "");
    const imported = new Set(config.importedKeys);
    const created: Lead[] = [];
    let skipped = 0;

    for (const cols of dataRows) {
      const phoneRaw = cell(cols, phoneIdx);
      const normalized = normalizePhone(phoneRaw);
      // Phone is required to import a row; skip blanks and already-imported phones.
      if (!normalized || imported.has(normalized)) {
        skipped += 1;
        continue;
      }
      imported.add(normalized);
      const name = cell(cols, nameIdx) || phoneRaw;
      const email = cell(cols, emailIdx);
      const lead = this.buildLead(
        context,
        { name, phone: phoneRaw, email: email || undefined, source, intake: "google_sheet" },
        leadConfig
      );
      this.data.leads.push(lead);
      created.push(lead);
    }

    if (created.length > 0) {
      config.importedKeys = Array.from(imported);
      await this.persistence.saveCollection("leads", this.data.leads);
      await this.persistence.saveCollection("leadSheetConfigs", this.data.leadSheetConfigs);
      await this.triggerNewLeadCampaigns(context, created);
    }
    return { imported: created.length, skipped, total };
  }

  /**
   * Best-effort periodic poll: sync every tenant that has lead-sheet ingest enabled
   * with a connected csvUrl. Wired from main.ts on an interval. Per-tenant failures
   * are swallowed (syncLeadSheet records them in lastResult) so one bad sheet never
   * stalls the others. Returns a per-tenant tally for logging.
   */
  async runLeadSheetPoll(): Promise<{ tenants: number; imported: number }> {
    const enabled = this.data.leadSheetConfigs.filter((c) => c.enabled && c.csvUrl);
    let imported = 0;
    for (const config of enabled) {
      try {
        const result = await this.syncLeadSheet(this.systemContext(config.tenantId));
        imported += result.imported;
      } catch {
        // not-connected/race — skip; non-fatal.
      }
    }
    return { tenants: enabled.length, imported };
  }

  // ---- Leads & data sources ------------------------------------------------


  listLeads(context: RequestContext, filters: { stage?: string; source?: string; assignedTo?: string } = {}) {
    return this.data.leads
      .filter((lead) => lead.tenantId === context.tenantId)
      .filter((lead) => (filters.stage ? lead.stage === filters.stage : true))
      .filter((lead) => (filters.source ? lead.source === filters.source : true))
      .filter((lead) => (filters.assignedTo ? lead.assignedTo === filters.assignedTo : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLeadFunnel(context: RequestContext) {
    const config = await this.resolveLeadConfig(context);
    const leads = this.data.leads.filter((lead) => lead.tenantId === context.tenantId);
    // Initialise a 0 count for every configured stage/source (in funnel/display
    // order) so the UI can render a complete board even for empty stages.
    const byStage: Record<string, number> = {};
    for (const stage of config.stages) {
      byStage[stage.key] = 0;
    }
    const bySource: Record<string, number> = {};
    for (const source of config.sources) {
      bySource[source.key] = 0;
    }
    for (const lead of leads) {
      // Tally onto configured keys; a lead on a key removed from config still
      // counts (so totals reconcile) by initialising the bucket on demand.
      byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1;
      bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;
    }
    return {
      total: leads.length,
      byStage,
      bySource,
      stages: config.stages,
      sources: config.sources
    };
  }

  async createLead(context: RequestContext, input: CreateLeadInput) {
    const config = await this.resolveLeadConfig(context);
    const lead = this.buildLead(context, input, config);
    this.data.leads.push(lead);
    await this.persistence.saveCollection("leads", this.data.leads);
    await this.audit(context, "lead.create", "lead", lead.id, lead.convertedPatientId, {
      source: lead.source,
      stage: lead.stage,
      matchedPatientId: lead.matchedPatientId
    });
    await this.triggerNewLeadCampaigns(context, [lead]);
    return lead;
  }

  /** Construct (but do not persist) a tenant-scoped Lead from raw input, with a
   *  matchedPatientId hint when the phone matches an existing patient. */
  private buildLead(context: RequestContext, input: CreateLeadInput, config: LeadConfig): Lead {
    const timestamp = nowIso();
    const phone = ensureString(input.phone, "phone");
    const lead: Lead = {
      id: createId("lead"),
      tenantId: context.tenantId,
      name: ensureString(input.name, "name"),
      phone,
      email: typeof input.email === "string" && input.email.trim() ? input.email.trim() : undefined,
      source: sanitizeLeadSource(input.source, config.sources),
      intake: validLeadIntake(input.intake) ?? "manual",
      sourceDetail: typeof input.sourceDetail === "string" && input.sourceDetail.trim() ? input.sourceDetail.trim() : undefined,
      // Default to the first configured stage (funnel entry) when none given.
      stage: sanitizeLeadStage(input.stage, config.stages, config.stages[0]?.key),
      assignedTo: typeof input.assignedTo === "string" && input.assignedTo.trim() ? input.assignedTo.trim() : undefined,
      branchId: typeof input.branchId === "string" && input.branchId.trim() ? input.branchId.trim() : undefined,
      formData: sanitizeStringMap(input.formData),
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const matched = this.findPatientByPhone(context.tenantId, phone);
    if (matched) {
      lead.matchedPatientId = matched.id;
    }
    return lead;
  }

  private findPatientByPhone(tenantId: string, phone: string): Patient | undefined {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return undefined;
    }
    return this.data.patients.find(
      (patient) => patient.tenantId === tenantId && normalizePhone(patient.primaryPhone) === normalized
    );
  }

  private ensureLead(context: RequestContext, leadId: string): Lead {
    const lead = this.data.leads.find((entry) => entry.id === leadId && entry.tenantId === context.tenantId);
    if (!lead) {
      throw new ApiError(404, `Lead not found: ${leadId}`);
    }
    return lead;
  }

  async updateLead(context: RequestContext, leadId: string, input: UpdateLeadInput) {
    const lead = this.ensureLead(context, leadId);
    const config = await this.resolveLeadConfig(context);
    if (typeof input.name === "string" && input.name.trim()) {
      lead.name = input.name.trim();
    }
    if (typeof input.phone === "string" && input.phone.trim()) {
      lead.phone = input.phone.trim();
    }
    if (input.email !== undefined) {
      lead.email = typeof input.email === "string" && input.email.trim() ? input.email.trim() : undefined;
    }
    if (input.stage !== undefined) {
      // Funnel move: accept ANY configured stage key; keep current on unknown.
      lead.stage = sanitizeLeadStage(input.stage, config.stages, lead.stage);
    }
    if (input.source !== undefined) {
      lead.source = sanitizeLeadSource(input.source, config.sources, lead.source);
    }
    if (input.assignedTo !== undefined) {
      lead.assignedTo =
        typeof input.assignedTo === "string" && input.assignedTo.trim() ? input.assignedTo.trim() : undefined;
    }
    if (input.branchId !== undefined) {
      lead.branchId = typeof input.branchId === "string" && input.branchId.trim() ? input.branchId.trim() : undefined;
    }
    if (input.notes !== undefined) {
      lead.notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined;
    }
    if (input.sourceDetail !== undefined) {
      lead.sourceDetail =
        typeof input.sourceDetail === "string" && input.sourceDetail.trim() ? input.sourceDetail.trim() : undefined;
    }
    lead.updatedAt = nowIso();
    await this.persistence.saveCollection("leads", this.data.leads);
    await this.audit(context, "lead.update", "lead", lead.id, lead.convertedPatientId, { stage: lead.stage });
    return lead;
  }

  async convertLead(context: RequestContext, leadId: string, input: ConvertLeadInput) {
    const lead = this.ensureLead(context, leadId);
    const config = await this.resolveLeadConfig(context);
    let patientSummary: PatientSummary;
    if (typeof input.patientId === "string" && input.patientId.trim()) {
      const patient = this.ensureKnownPatient(context, input.patientId.trim());
      patientSummary = this.summarizePatient(context, patient);
      lead.convertedPatientId = patient.id;
    } else {
      patientSummary = await this.createPatient(context, {
        displayName: lead.name,
        primaryPhone: lead.phone,
        branchId: lead.branchId
      });
      lead.convertedPatientId = patientSummary.id;
    }
    // Land on the configured "converted" stage when present, else keep the lead's
    // current stage (tenants that removed it shouldn't get an orphaned key).
    lead.stage = config.stages.some((s) => s.key === "converted") ? "converted" : lead.stage;
    lead.updatedAt = nowIso();
    await this.persistence.saveCollection("leads", this.data.leads);
    await this.audit(context, "lead.convert", "lead", lead.id, lead.convertedPatientId, {
      linked: Boolean(input.patientId)
    });
    return patientSummary;
  }

  async importLeads(context: RequestContext, input: ImportLeadsInput) {
    const config = await this.resolveLeadConfig(context);
    const rows = Array.isArray(input.rows) ? input.rows : [];
    // The marketing source the operator tags this file's leads with (default the
    // first configured source). The mechanism ("excel_import") is recorded as intake.
    const source = sanitizeLeadSource(input.source, config.sources, config.sources[0]?.key);
    const mapping = input.mapping ?? {};
    const nameKey = typeof mapping.name === "string" && mapping.name ? mapping.name : "name";
    const phoneKey = typeof mapping.phone === "string" && mapping.phone ? mapping.phone : "phone";
    const emailKey = typeof mapping.email === "string" && mapping.email ? mapping.email : "email";

    const created: Lead[] = [];
    const seenPhones = new Set<string>();
    let skipped = 0;

    for (const row of rows) {
      const record = isPlainRecord(row) ? row : {};
      const name = typeof record[nameKey] === "string" ? (record[nameKey] as string).trim() : "";
      const phoneRaw = typeof record[phoneKey] === "string" ? (record[phoneKey] as string).trim() : "";
      const normalized = normalizePhone(phoneRaw);
      if (!name || !phoneRaw || !normalized || seenPhones.has(normalized)) {
        skipped += 1;
        continue;
      }
      seenPhones.add(normalized);
      const email = typeof record[emailKey] === "string" ? (record[emailKey] as string).trim() : "";
      const lead = this.buildLead(context, {
        name,
        phone: phoneRaw,
        email: email || undefined,
        source,
        intake: "excel_import",
        formData: sanitizeStringMap(record)
      }, config);
      this.data.leads.push(lead);
      created.push(lead);
    }

    if (created.length > 0) {
      await this.persistence.saveCollection("leads", this.data.leads);
    }
    await this.audit(context, "lead.import", "lead", undefined, undefined, {
      source,
      created: created.length,
      skipped
    });
    await this.triggerNewLeadCampaigns(context, created);
    return { created: created.length, skipped };
  }

  // ---- Lead CRM record (notes, callbacks, merged timeline) -----------------

  /** Full CRM record for a single lead: the lead, its notes (newest first),
   *  callbacks (open first then by dueAt), and a merged activity timeline. */
  getLeadDetail(context: RequestContext, leadId: string) {
    const lead = this.ensureLead(context, leadId);
    const notes = this.data.leadNotes
      .filter((note) => note.tenantId === context.tenantId && note.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const callbacks = this.data.leadCallbacks
      .filter((cb) => cb.tenantId === context.tenantId && cb.leadId === leadId)
      .sort(compareCallbacks);
    const timeline = this.buildLeadTimeline(context, lead, notes, callbacks);
    return { lead, notes, callbacks, timeline };
  }

  /** Merge the lead's lifecycle (created), notes, callbacks and any stage-change
   *  history (derived from audit) into a single newest-first timeline. */
  private buildLeadTimeline(
    context: RequestContext,
    lead: Lead,
    notes: LeadNote[],
    callbacks: LeadCallback[]
  ): LeadTimelineEntry[] {
    const entries: LeadTimelineEntry[] = [];

    entries.push({
      id: `created_${lead.id}`,
      type: "created",
      at: lead.createdAt,
      text: `Lead created from ${lead.source}${lead.sourceDetail ? ` (${lead.sourceDetail})` : ""}.`
    });

    for (const note of notes) {
      entries.push({
        id: `note_${note.id}`,
        type: "note",
        at: note.createdAt,
        text: note.body,
        by: note.authorName ?? note.authorId
      });
    }

    for (const cb of callbacks) {
      entries.push({
        id: `cb_sched_${cb.id}`,
        type: "callback_scheduled",
        at: cb.createdAt,
        text: `Callback scheduled: ${cb.title} (due ${cb.dueAt}, via ${cb.channel}).`,
        by: cb.assignedTo
      });
      if (cb.status === "done" && cb.completedAt) {
        entries.push({
          id: `cb_done_${cb.id}`,
          type: "callback_done",
          at: cb.completedAt,
          text: `Callback completed: ${cb.title}.`,
          by: cb.assignedTo
        });
      } else if (cb.status === "cancelled") {
        entries.push({
          id: `cb_cancelled_${cb.id}`,
          // completedAt is not set on cancel; fall back to createdAt for ordering.
          type: "callback_cancelled",
          at: cb.completedAt ?? cb.createdAt,
          text: `Callback cancelled: ${cb.title}.`,
          by: cb.assignedTo
        });
      }
    }

    // Stage-change history is derived from this lead's `lead.update` audit events,
    // each of which records the resulting stage in details.stage. We emit an entry
    // whenever the stage value changes between consecutive updates. NOTE: existing
    // audit data does not capture the source value, so source_change history is not
    // derivable here — only stage changes are reconstructed.
    const updates = this.data.auditEvents
      .filter(
        (event) =>
          event.tenantId === context.tenantId &&
          event.resourceType === "lead" &&
          event.resourceId === lead.id &&
          event.action === "lead.update"
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let lastStage: string | undefined;
    for (const event of updates) {
      const stage = typeof event.details?.stage === "string" ? event.details.stage : undefined;
      if (!stage || stage === lastStage) {
        continue;
      }
      lastStage = stage;
      entries.push({
        id: `stage_${event.id}`,
        type: "stage_change",
        at: event.createdAt,
        text: `Stage changed to ${stage}.`,
        by: event.actorDisplayName
      });
    }

    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  async createLeadNote(context: RequestContext, leadId: string, input: CreateLeadNoteInput) {
    this.ensureLead(context, leadId);
    const body = ensureString(input.body, "body");
    const note: LeadNote = {
      id: createId("lead_note"),
      tenantId: context.tenantId,
      leadId,
      body,
      authorId: context.actorId,
      authorName: context.displayName,
      createdAt: nowIso()
    };
    this.data.leadNotes.push(note);
    await this.persistence.saveCollection("leadNotes", this.data.leadNotes);
    await this.audit(context, "lead_note.create", "lead", leadId, undefined, { noteId: note.id });
    return note;
  }

  async createLeadCallback(context: RequestContext, leadId: string, input: CreateLeadCallbackInput) {
    this.ensureLead(context, leadId);
    const title = ensureString(input.title, "title");
    const dueAt = ensureString(input.dueAt, "dueAt");
    if (Number.isNaN(Date.parse(dueAt))) {
      throw new ApiError(400, "dueAt must be a valid ISO date");
    }
    const channel = typeof input.channel === "string" ? input.channel : "";
    if (!LEAD_CALLBACK_CHANNELS.has(channel as LeadCallbackChannel)) {
      throw new ApiError(400, `Invalid callback channel: ${channel || "(missing)"}`);
    }
    const callback: LeadCallback = {
      id: createId("lead_callback"),
      tenantId: context.tenantId,
      leadId,
      title,
      dueAt: new Date(dueAt).toISOString(),
      channel: channel as LeadCallbackChannel,
      status: "open",
      assignedTo:
        typeof input.assignedTo === "string" && input.assignedTo.trim() ? input.assignedTo.trim() : undefined,
      note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined,
      createdAt: nowIso()
    };
    this.data.leadCallbacks.push(callback);
    await this.persistence.saveCollection("leadCallbacks", this.data.leadCallbacks);
    await this.audit(context, "lead_callback.create", "lead", leadId, undefined, {
      callbackId: callback.id,
      channel: callback.channel
    });
    return callback;
  }

  async updateLeadCallback(context: RequestContext, callbackId: string, input: UpdateLeadCallbackInput) {
    const callback = this.data.leadCallbacks.find(
      (entry) => entry.id === callbackId && entry.tenantId === context.tenantId
    );
    if (!callback) {
      throw new ApiError(404, `Lead callback not found: ${callbackId}`);
    }
    if (input.status !== undefined) {
      if (input.status !== "open" && input.status !== "done" && input.status !== "cancelled") {
        throw new ApiError(400, `Invalid callback status: ${input.status}`);
      }
      callback.status = input.status;
      // Stamp completion when moving to done; clear it otherwise.
      callback.completedAt = input.status === "done" ? nowIso() : undefined;
    }
    if (typeof input.title === "string" && input.title.trim()) {
      callback.title = input.title.trim();
    }
    if (input.dueAt !== undefined) {
      if (typeof input.dueAt !== "string" || Number.isNaN(Date.parse(input.dueAt))) {
        throw new ApiError(400, "dueAt must be a valid ISO date");
      }
      callback.dueAt = new Date(input.dueAt).toISOString();
    }
    if (input.channel !== undefined) {
      if (!LEAD_CALLBACK_CHANNELS.has(input.channel as LeadCallbackChannel)) {
        throw new ApiError(400, `Invalid callback channel: ${input.channel}`);
      }
      callback.channel = input.channel as LeadCallbackChannel;
    }
    if (input.assignedTo !== undefined) {
      callback.assignedTo =
        typeof input.assignedTo === "string" && input.assignedTo.trim() ? input.assignedTo.trim() : undefined;
    }
    if (input.note !== undefined) {
      callback.note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined;
    }
    await this.persistence.saveCollection("leadCallbacks", this.data.leadCallbacks);
    await this.audit(context, "lead_callback.update", "lead", callback.leadId, undefined, {
      callbackId: callback.id,
      status: callback.status
    });
    return callback;
  }

  /** Tenant-wide callbacks, optionally filtered by status, each enriched with the
   *  lead's name + phone so the staff "Tasks" view renders without N+1 lookups.
   *  Sort: open by dueAt asc (most overdue first), then the rest. */
  listLeadCallbacks(context: RequestContext, filters: { status?: string } = {}) {
    return this.data.leadCallbacks
      .filter((cb) => cb.tenantId === context.tenantId)
      .filter((cb) => (filters.status ? cb.status === filters.status : true))
      .sort(compareCallbacks)
      .map((cb) => {
        const lead = this.data.leads.find(
          (entry) => entry.id === cb.leadId && entry.tenantId === context.tenantId
        );
        return {
          ...cb,
          leadName: lead?.name,
          leadPhone: lead?.phone
        };
      });
  }

  // ---- Lead forms (camp registration) --------------------------------------

  listForms(context: RequestContext) {
    return this.data.forms
      .filter((form) => form.tenantId === context.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createForm(context: RequestContext, input: CreateFormInput) {
    const title = ensureString(input.title, "title");
    // The lead source tagged on this form's submissions — from the tenant's
    // configured sources (default "form").
    const leadConfig = await this.getLeadConfig(context);
    const source = sanitizeLeadSource(input.source, leadConfig.sources, "form");
    const form: LeadForm = {
      id: createId("form"),
      tenantId: context.tenantId,
      title,
      description: typeof input.description === "string" && input.description.trim() ? input.description.trim() : undefined,
      slug: this.uniqueFormSlug(context.tenantId, title),
      fields: sanitizeFormFields(input.fields),
      status: input.status === "inactive" ? "inactive" : "active",
      branchId: typeof input.branchId === "string" && input.branchId.trim() ? input.branchId.trim() : undefined,
      source,
      submissions: 0,
      createdAt: nowIso()
    };
    this.data.forms.push(form);
    await this.persistence.saveCollection("forms", this.data.forms);
    await this.audit(context, "form.create", "form", form.id, undefined, { slug: form.slug });
    return form;
  }

  async updateForm(context: RequestContext, formId: string, input: UpdateFormInput) {
    const form = this.data.forms.find((entry) => entry.id === formId && entry.tenantId === context.tenantId);
    if (!form) {
      throw new ApiError(404, `Form not found: ${formId}`);
    }
    if (typeof input.title === "string" && input.title.trim()) {
      form.title = input.title.trim();
    }
    if (input.description !== undefined) {
      form.description =
        typeof input.description === "string" && input.description.trim() ? input.description.trim() : undefined;
    }
    if (input.fields !== undefined) {
      form.fields = sanitizeFormFields(input.fields);
    }
    if (input.status === "active" || input.status === "inactive") {
      form.status = input.status;
    }
    if (input.branchId !== undefined) {
      form.branchId = typeof input.branchId === "string" && input.branchId.trim() ? input.branchId.trim() : undefined;
    }
    if (typeof input.source === "string") {
      const leadConfig = await this.getLeadConfig(context);
      form.source = sanitizeLeadSource(input.source, leadConfig.sources, form.source ?? "form");
    }
    await this.persistence.saveCollection("forms", this.data.forms);
    await this.audit(context, "form.create", "form", form.id, undefined, { slug: form.slug, updated: true });
    return form;
  }

  /** Unique-ish slug within a tenant: kebab-case of the title, suffixed on collision. */
  private uniqueFormSlug(tenantId: string, title: string): string {
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "form";
    let slug = base;
    let counter = 1;
    while (this.data.forms.some((form) => form.tenantId === tenantId && form.slug === slug)) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    return slug;
  }

  // ---- Public (unauthenticated) form endpoints -----------------------------

  /** Public form schema for rendering. Throws 404 if missing or inactive. */
  getPublicForm(slug: string) {
    const form = this.data.forms.find((entry) => entry.slug === slug && entry.status === "active");
    if (!form) {
      throw new ApiError(404, "Form not found");
    }
    return {
      title: form.title,
      description: form.description,
      slug: form.slug,
      fields: form.fields
    };
  }

  /** Public submission: creates a Lead in the form's tenant and bumps the count. */
  async submitPublicForm(slug: string, input: PublicFormSubmitInput) {
    const form = this.data.forms.find((entry) => entry.slug === slug && entry.status === "active");
    if (!form) {
      throw new ApiError(404, "Form not found");
    }
    const values = sanitizeStringMap(input.values) ?? {};
    const name = values.name?.trim();
    const phone = values.phone?.trim();
    if (!name || !phone) {
      throw new ApiError(400, "Form submission requires name and phone");
    }
    const timestamp = nowIso();
    // Honour the form-tenant's configured funnel where present (this path has no
    // RequestContext, so we read the stored config directly without provisioning):
    // keep "form"/"new" defaults if the tenant removed those keys.
    const config = this.tenantLeadConfig(form.tenantId);
    const sources = config?.sources ?? [];
    // Tag with the form's configured source; fall back to "form" (or the first
    // configured source if "form" was removed).
    const source = sanitizeLeadSource(
      form.source,
      sources,
      sources.some((s) => s.key === "form") ? "form" : sources[0]?.key ?? "form"
    );
    const stage =
      config && !config.stages.some((s) => s.key === "new") ? config.stages[0]?.key ?? "new" : "new";
    const lead: Lead = {
      id: createId("lead"),
      tenantId: form.tenantId,
      name,
      phone,
      email: values.email?.trim() || undefined,
      source,
      intake: "web_form",
      sourceDetail: form.title,
      stage,
      branchId: form.branchId,
      formData: values,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const matched = this.findPatientByPhone(form.tenantId, phone);
    if (matched) {
      lead.matchedPatientId = matched.id;
    }
    this.data.leads.push(lead);
    form.submissions += 1;
    const auditEvent: AuditEvent = {
      id: createId("audit"),
      tenantId: form.tenantId,
      actorType: "service",
      actorId: "public_form",
      actorDisplayName: "Public form",
      action: "form.submit",
      resourceType: "form",
      resourceId: form.id,
      details: { leadId: lead.id, slug: form.slug, matchedPatientId: lead.matchedPatientId },
      createdAt: timestamp
    };
    this.data.auditEvents.push(auditEvent);
    await this.persistence.saveCollection("leads", this.data.leads);
    await this.persistence.saveCollection("forms", this.data.forms);
    await this.persistence.saveCollection("auditEvents", this.data.auditEvents);
    // Public form has no RequestContext — fire any automated new_lead campaigns as
    // the system actor scoped to the form's tenant.
    await this.triggerNewLeadCampaigns(this.systemContext(form.tenantId), [lead]);
    return { ok: true };
  }

  // ---- Campaigns (segmented broadcasts over the channel layer) -------------

  listCampaigns(context: RequestContext): Campaign[] {
    return this.data.campaigns
      .filter((campaign) => campaign.tenantId === context.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private ensureCampaign(context: RequestContext, campaignId: string): Campaign {
    const campaign = this.data.campaigns.find((entry) => entry.id === campaignId && entry.tenantId === context.tenantId);
    if (!campaign) {
      throw new ApiError(404, `Campaign not found: ${campaignId}`);
    }
    return campaign;
  }

  /** Coerce raw input into a clean CampaignAudience (defaults include="both"). */
  private sanitizeAudience(value: unknown): CampaignAudience {
    const raw = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as CampaignAudienceInput;
    const include = raw.include === "leads" || raw.include === "patients" ? raw.include : "both";
    const audience: CampaignAudience = { include };
    const leadStages = sanitizeStringArray(raw.leadStages);
    const leadSources = sanitizeStringArray(raw.leadSources);
    const patientStages = sanitizeStringArray(raw.patientStages);
    const conditionCodes = sanitizeStringArray(raw.conditionCodes);
    const tags = sanitizeStringArray(raw.tags);
    if (leadStages) audience.leadStages = leadStages;
    if (leadSources) audience.leadSources = leadSources;
    if (patientStages) audience.patientStages = patientStages;
    if (conditionCodes) audience.conditionCodes = conditionCodes;
    if (tags) audience.tags = tags;
    return audience;
  }

  /**
   * Resolve an audience segment into a de-duplicated (by phone) recipient list.
   * Leads use name/phone; patients use displayName/primaryPhone. Patient stage
   * comes from the computed lifecycle; condition codes from clinicalRecords.
   */
  resolveCampaignAudience(context: RequestContext, audience: CampaignAudience): CampaignRecipient[] {
    const include = audience.include;
    const recipients: CampaignRecipient[] = [];
    const seenPhones = new Set<string>();

    const push = (recipient: CampaignRecipient) => {
      const normalized = normalizePhone(recipient.phone);
      if (!normalized || seenPhones.has(normalized)) {
        return;
      }
      seenPhones.add(normalized);
      recipients.push(recipient);
    };

    if (include === "leads" || include === "both") {
      const leadStages = audience.leadStages;
      const leadSources = audience.leadSources;
      for (const lead of this.data.leads.filter((entry) => entry.tenantId === context.tenantId)) {
        if (leadStages && !leadStages.includes(lead.stage)) continue;
        if (leadSources && !leadSources.includes(lead.source)) continue;
        if (!lead.phone || !lead.phone.trim()) continue;
        push({ name: lead.name, phone: lead.phone, kind: "lead", id: lead.id });
      }
    }

    if (include === "patients" || include === "both") {
      const patientStages = audience.patientStages;
      const tags = audience.tags;
      const conditionCodes = audience.conditionCodes;
      for (const patient of this.data.patients.filter((entry) => entry.tenantId === context.tenantId)) {
        if (patientStages && !patientStages.includes(this.patientLifecycle(context, patient.id).stage)) continue;
        if (tags && !tags.some((tag) => patient.tags.includes(tag))) continue;
        if (conditionCodes) {
          const record = this.data.clinicalRecords.find(
            (entry) => entry.patientId === patient.id && entry.tenantId === context.tenantId
          );
          const codes = record?.conditions.map((condition) => condition.icd10Code) ?? [];
          if (!conditionCodes.some((code) => codes.includes(code))) continue;
        }
        if (!patient.primaryPhone || !patient.primaryPhone.trim()) continue;
        push({ name: patient.displayName, phone: patient.primaryPhone, kind: "patient", id: patient.id });
      }
    }

    return recipients;
  }

  previewCampaignAudience(context: RequestContext, input: Record<string, unknown>) {
    const audience = this.sanitizeAudience(input.audience);
    const recipients = this.resolveCampaignAudience(context, audience);
    return { size: recipients.length, sample: recipients.slice(0, 5) };
  }

  /**
   * Ledger-aware recipient preview for an EXISTING campaign: resolves the live
   * audience and, when sendOncePerContact is on, splits it into who would actually
   * receive the next run (eligible/new) vs who's already been contacted. Powers the
   * "who will this go to?" panel on the campaign card so a send is never blind.
   */
  previewCampaignRecipients(context: RequestContext, campaignId: string) {
    const campaign = this.ensureCampaign(context, campaignId);
    const resolved = this.resolveCampaignAudience(context, campaign.audience);
    const { eligible, skipped } = this.eligibleRecipients(campaign, resolved);
    const contacted = new Set((campaign.contactedPhones ?? []).map((p) => normalizePhone(p)).filter(Boolean));
    const sample = resolved.slice(0, 20).map((r) => ({
      name: r.name,
      phone: r.phone,
      kind: r.kind,
      alreadyContacted: campaign.sendOncePerContact ? contacted.has(normalizePhone(r.phone)) : false
    }));
    return {
      audienceSize: resolved.length,
      eligible: eligible.length,
      alreadyContacted: skipped,
      sendOncePerContact: Boolean(campaign.sendOncePerContact),
      generatedAt: nowIso(),
      sample
    };
  }

  /** Build (but do not persist) a tenant-scoped Campaign from raw input. */
  private buildCampaign(context: RequestContext, input: UpsertCampaignInput): Campaign {
    const timestamp = nowIso();
    const channelType: CampaignChannelType = input.channelType === "marketing" ? "marketing" : "transactional";
    const trigger: CampaignTrigger = input.trigger === "automated" ? "automated" : "manual";
    // An automated campaign is "armed" (scheduled) by default so it actually fires;
    // a manual one starts as a draft until the operator sends it.
    const status: CampaignStatus =
      typeof input.status === "string" && (CAMPAIGN_STATUSES as string[]).includes(input.status)
        ? (input.status as CampaignStatus)
        : trigger === "automated"
          ? "scheduled"
          : "draft";
    const campaign: Campaign = {
      id: createId("campaign"),
      tenantId: context.tenantId,
      name: ensureString(input.name, "name"),
      channelType,
      audience: this.sanitizeAudience(input.audience),
      trigger,
      status,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (input.provider === "ultramsg" || input.provider === "aisensy") {
      campaign.provider = input.provider;
    }
    if (typeof input.body === "string" && input.body.trim()) campaign.body = input.body.trim();
    if (typeof input.aisensyCampaign === "string" && input.aisensyCampaign.trim()) {
      campaign.aisensyCampaign = input.aisensyCampaign.trim();
    }
    const templateParams = sanitizeStringArray(input.templateParams);
    if (templateParams) campaign.templateParams = templateParams;
    if (typeof input.automatedOn === "string" && (CAMPAIGN_AUTOMATED_ON as string[]).includes(input.automatedOn)) {
      campaign.automatedOn = input.automatedOn as CampaignAutomatedOn;
    }
    if (input.sendOncePerContact === true) {
      campaign.sendOncePerContact = true;
      campaign.contactedPhones = [];
    }
    const schedule = this.sanitizeCampaignSchedule(input.schedule);
    if (schedule) {
      campaign.schedule = schedule;
      // A live recurring schedule surfaces as "scheduled" rather than a one-off draft.
      if (schedule.enabled) campaign.status = "scheduled";
    }
    return campaign;
  }

  /**
   * Normalise a recurring-schedule input into a usable CampaignSchedule, or
   * undefined when absent/invalid. `everyDays` is clamped to >= 1; `nextRunAt`
   * defaults to `everyDays` from now when not supplied or unparseable.
   */
  private sanitizeCampaignSchedule(raw: unknown): CampaignSchedule | undefined {
    if (!isPlainRecord(raw)) return undefined;
    const everyDaysNum = Number((raw as Record<string, unknown>).everyDays);
    if (!Number.isFinite(everyDaysNum) || everyDaysNum < 1) return undefined;
    const everyDays = Math.floor(everyDaysNum);
    const enabled = (raw as Record<string, unknown>).enabled !== false;
    const rawNext = (raw as Record<string, unknown>).nextRunAt;
    let nextRunAt: string;
    if (typeof rawNext === "string" && !Number.isNaN(Date.parse(rawNext))) {
      nextRunAt = new Date(rawNext).toISOString();
    } else {
      nextRunAt = new Date(Date.now() + everyDays * 86_400_000).toISOString();
    }
    return { everyDays, nextRunAt, enabled };
  }

  async createCampaign(context: RequestContext, input: UpsertCampaignInput) {
    const campaign = this.buildCampaign(context, input);
    this.data.campaigns.push(campaign);
    await this.persistence.saveCollection("campaigns", this.data.campaigns);
    await this.audit(context, "campaign.create", "campaign", campaign.id, undefined, {
      channelType: campaign.channelType,
      trigger: campaign.trigger,
      include: campaign.audience.include
    });
    return campaign;
  }

  async updateCampaign(context: RequestContext, campaignId: string, input: UpsertCampaignInput) {
    const campaign = this.ensureCampaign(context, campaignId);
    if (typeof input.name === "string" && input.name.trim()) {
      campaign.name = input.name.trim();
    }
    if (input.channelType === "marketing" || input.channelType === "transactional") {
      campaign.channelType = input.channelType;
    }
    if (input.provider === "ultramsg" || input.provider === "aisensy") {
      campaign.provider = input.provider;
    }
    if (input.audience !== undefined) {
      campaign.audience = this.sanitizeAudience(input.audience);
    }
    if (input.body !== undefined) {
      campaign.body = typeof input.body === "string" && input.body.trim() ? input.body.trim() : undefined;
    }
    if (input.aisensyCampaign !== undefined) {
      campaign.aisensyCampaign =
        typeof input.aisensyCampaign === "string" && input.aisensyCampaign.trim() ? input.aisensyCampaign.trim() : undefined;
    }
    if (input.templateParams !== undefined) {
      campaign.templateParams = sanitizeStringArray(input.templateParams);
    }
    if (input.trigger === "manual" || input.trigger === "automated") {
      campaign.trigger = input.trigger;
    }
    if (input.automatedOn !== undefined) {
      campaign.automatedOn =
        typeof input.automatedOn === "string" && (CAMPAIGN_AUTOMATED_ON as string[]).includes(input.automatedOn)
          ? (input.automatedOn as CampaignAutomatedOn)
          : undefined;
    }
    if (input.sendOncePerContact !== undefined) {
      campaign.sendOncePerContact = input.sendOncePerContact === true ? true : undefined;
      // Turning it on starts a fresh ledger; turning it off drops it.
      campaign.contactedPhones = campaign.sendOncePerContact ? campaign.contactedPhones ?? [] : undefined;
    }
    if (input.schedule !== undefined) {
      const schedule = this.sanitizeCampaignSchedule(input.schedule);
      campaign.schedule = schedule;
      if (schedule?.enabled) campaign.status = "scheduled";
    }
    if (typeof input.status === "string" && (CAMPAIGN_STATUSES as string[]).includes(input.status)) {
      campaign.status = input.status as CampaignStatus;
    }
    campaign.updatedAt = nowIso();
    await this.persistence.saveCollection("campaigns", this.data.campaigns);
    await this.audit(context, "campaign.update", "campaign", campaign.id, undefined, { status: campaign.status });
    return campaign;
  }

  /**
   * Manual "Send now". Delegates to runCampaignSend, which applies the
   * contact-once ledger, broadcasts, and records stats.
   */
  async sendCampaign(context: RequestContext, campaignId: string) {
    const campaign = this.ensureCampaign(context, campaignId);
    return this.runCampaignSend(context, campaign);
  }

  /**
   * Split resolved recipients into those eligible now and those skipped because the
   * contact-once ledger already covers them. With sendOncePerContact off, all are
   * eligible (legacy "blast the whole segment every time" behaviour).
   */
  private eligibleRecipients(
    campaign: Campaign,
    recipients: CampaignRecipient[]
  ): { eligible: CampaignRecipient[]; skipped: number } {
    if (!campaign.sendOncePerContact) return { eligible: recipients, skipped: 0 };
    const contacted = new Set((campaign.contactedPhones ?? []).map((p) => normalizePhone(p)).filter(Boolean));
    const eligible = recipients.filter((r) => {
      const n = normalizePhone(r.phone);
      return Boolean(n) && !contacted.has(n);
    });
    return { eligible, skipped: recipients.length - eligible.length };
  }

  /**
   * Core broadcast shared by manual send, the recurring scheduler, and the new-lead
   * trigger. Resolves the audience (unless the caller passes an explicit recipient
   * list), skips anyone already covered by the contact-once ledger, sends via the
   * channel layer, records the newly-contacted phones, and updates stats. Each
   * recipient send is wrapped in try/catch so one unconfigured/failed send
   * (sendMessage throws when UltraMsg/AISensy isn't configured) never aborts the run.
   */
  private async runCampaignSend(
    context: RequestContext,
    campaign: Campaign,
    opts: { recipients?: CampaignRecipient[] } = {}
  ): Promise<{ sent: number; failed: number; skipped: number; audienceSize: number }> {
    const resolved = opts.recipients ?? this.resolveCampaignAudience(context, campaign.audience);
    const { eligible, skipped } = this.eligibleRecipients(campaign, resolved);
    // Effective delivery provider — explicit, else derived from the category.
    const provider: ChannelProvider = campaign.provider ?? (campaign.channelType === "marketing" ? "aisensy" : "ultramsg");

    // Tenant-level tokens for the body (a campaign has no appointment context, so
    // branch info comes from the campaign tenant's primary branch). Recipient name
    // fills every name alias so library templates ({{name}} OR {{patientName}}) work.
    const branch =
      this.data.branches.find((b) => b.tenantId === campaign.tenantId && b.status === "active") ??
      this.data.branches.find((b) => b.tenantId === campaign.tenantId);
    const baseTokens: Record<string, string> = {
      branch: branch?.displayName ?? "",
      address: branch?.address ?? "",
      mapLink: branch?.mapUrl ?? "",
      clinicPhone: branch?.phone ?? ""
    };

    let sent = 0;
    let failed = 0;
    const newlyContacted: string[] = [];
    for (const recipient of eligible) {
      try {
        const name = firstName(recipient.name);
        const renderedBody =
          provider === "ultramsg" && campaign.body
            ? this.renderTemplate(campaign.body, { ...baseTokens, name, patientName: name, firstName: name })
            : undefined;
        const result = await this.sendMessage(context, {
          to: recipient.phone,
          type: campaign.channelType,
          provider,
          body: renderedBody,
          campaign: provider === "aisensy" ? campaign.aisensyCampaign : undefined,
          userName: recipient.name,
          params: provider === "aisensy" ? campaign.templateParams : undefined
        });
        if (result.ok) {
          sent += 1;
          const n = normalizePhone(recipient.phone);
          if (n) newlyContacted.push(n);
        } else {
          failed += 1;
        }
      } catch {
        // Provider unconfigured / transport error for this recipient — tally and continue.
        failed += 1;
      }
    }

    // Contact-once ledger: mark only successful sends, so a transient failure is
    // retried on the next run rather than silently dropped.
    if (campaign.sendOncePerContact && newlyContacted.length > 0) {
      const ledger = new Set(campaign.contactedPhones ?? []);
      for (const n of newlyContacted) ledger.add(n);
      campaign.contactedPhones = Array.from(ledger);
    }

    campaign.stats = { audienceSize: resolved.length, sent, failed, skipped, lastRunAt: nowIso() };
    // A live recurring campaign stays "scheduled"; a one-off becomes "sent".
    campaign.status = campaign.schedule?.enabled ? "scheduled" : "sent";
    campaign.updatedAt = nowIso();
    await this.persistence.saveCollection("campaigns", this.data.campaigns);
    await this.audit(context, "campaign.send", "campaign", campaign.id, undefined, {
      audienceSize: resolved.length,
      sent,
      failed,
      skipped
    });
    return { sent, failed, skipped, audienceSize: resolved.length };
  }

  /**
   * Recurring-campaign scheduler tick. Wired from main.ts on an interval: runs every
   * campaign whose schedule is enabled and due (nextRunAt <= now), advancing
   * nextRunAt by `everyDays`. Per-campaign failures are swallowed so one bad send
   * never stalls the rest. Honours the contact-once ledger, so each run reaches only
   * newly-qualifying recipients.
   */
  async runCampaignScheduler(): Promise<{ ran: number; sent: number; failed: number }> {
    const now = Date.now();
    const due = this.data.campaigns.filter(
      (c) => c.schedule?.enabled && Date.parse(c.schedule.nextRunAt) <= now
    );
    let ran = 0;
    let sent = 0;
    let failed = 0;
    for (const campaign of due) {
      try {
        const result = await this.runCampaignSend(this.systemContext(campaign.tenantId), campaign);
        ran += 1;
        sent += result.sent;
        failed += result.failed;
      } catch {
        // Non-fatal — a broken campaign shouldn't stall the scheduler.
      } finally {
        // Advance from now (not the stale nextRunAt) so a long outage doesn't create
        // a backlog of catch-up runs.
        if (campaign.schedule) {
          campaign.schedule.nextRunAt = new Date(now + campaign.schedule.everyDays * 86_400_000).toISOString();
          campaign.updatedAt = nowIso();
        }
      }
    }
    if (ran > 0) await this.persistence.saveCollection("campaigns", this.data.campaigns);
    return { ran, sent, failed };
  }

  /**
   * Fire automated `new_lead` campaigns for freshly-created leads. Called from every
   * lead-creation path. For each active automated new_lead campaign whose audience
   * matches a lead, that single lead is messaged (respecting the contact-once
   * ledger). Best-effort: wrapped so a messaging failure never fails lead creation.
   */
  private async triggerNewLeadCampaigns(context: RequestContext, leads: Lead[]): Promise<void> {
    if (leads.length === 0) return;
    const campaigns = this.data.campaigns.filter(
      (c) =>
        c.tenantId === context.tenantId &&
        c.trigger === "automated" &&
        c.automatedOn === "new_lead" &&
        c.status !== "draft" &&
        c.audience.include !== "patients"
    );
    if (campaigns.length === 0) return;
    for (const campaign of campaigns) {
      const recipients: CampaignRecipient[] = leads
        .filter((lead) => this.leadMatchesAudience(lead, campaign.audience) && lead.phone?.trim())
        .map((lead) => ({ name: lead.name, phone: lead.phone, kind: "lead" as const, id: lead.id }));
      if (recipients.length === 0) continue;
      try {
        await this.runCampaignSend(context, campaign, { recipients });
      } catch {
        // Non-fatal — never let campaign delivery break lead intake.
      }
    }
  }

  /** Whether a single lead satisfies a campaign audience's lead filters. */
  private leadMatchesAudience(lead: Lead, audience: CampaignAudience): boolean {
    if (audience.include === "patients") return false;
    if (audience.leadStages && !audience.leadStages.includes(lead.stage)) return false;
    if (audience.leadSources && !audience.leadSources.includes(lead.source)) return false;
    return true;
  }

  // ---- Communication Workflows: templates (CRUD, config-only) --------------

  /** How many workflow stages across the tenant reference this template. */
  private templateUsageCount(tenantId: string, templateId: string): number {
    return this.data.workflows
      .filter((workflow) => workflow.tenantId === tenantId)
      .reduce((total, workflow) => total + workflow.stages.filter((stage) => stage.templateId === templateId).length, 0);
  }

  /** Tenant-scoped templates (active + archived), each with a workflow usage count. */
  async listTemplates(context: RequestContext) {
    // Provision the default appointment templates + workflow the first time a
    // tenant opens the comms config, so every tenant sees the starter set (the
    // demo tenant gets it via seed; others lazily, idempotently).
    await this.ensureDefaultAppointmentWorkflow(context);
    return this.data.templates
      .filter((template) => template.tenantId === context.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((template) => ({ ...template, usageCount: this.templateUsageCount(context.tenantId, template.id) }));
  }

  getTemplate(context: RequestContext, templateId: string) {
    const template = this.ensureTemplate(context, templateId);
    return { ...template, usageCount: this.templateUsageCount(context.tenantId, template.id) };
  }

  private ensureTemplate(context: RequestContext, templateId: string): CommTemplate {
    const template = this.data.templates.find(
      (entry) => entry.id === templateId && entry.tenantId === context.tenantId
    );
    if (!template) {
      throw new ApiError(404, `Template not found: ${templateId}`);
    }
    return template;
  }

  /** Validate channel/kind and the body/formId constraints for a template payload. */
  private resolveTemplateChannelKind(input: UpsertTemplateInput, current?: CommTemplate) {
    const channel: TemplateChannel = TEMPLATE_CHANNELS.has(input.channel as TemplateChannel)
      ? (input.channel as TemplateChannel)
      : current?.channel ?? "whatsapp";
    const kind: TemplateKind = TEMPLATE_KINDS.has(input.kind as TemplateKind)
      ? (input.kind as TemplateKind)
      : current?.kind ?? "text";
    return { channel, kind };
  }

  async createTemplate(context: RequestContext, input: UpsertTemplateInput) {
    const name = ensureString(input.name, "name");
    const { channel, kind } = this.resolveTemplateChannelKind(input);
    const timestamp = nowIso();
    const template: CommTemplate = {
      id: createId("template"),
      tenantId: context.tenantId,
      name,
      channel,
      kind,
      status: input.status === "archived" ? "archived" : "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (kind === "text") {
      template.body = ensureString(input.body, "body");
    } else {
      const formId = ensureString(input.formId, "formId");
      this.ensureFormExists(context.tenantId, formId);
      template.formId = formId;
    }
    this.data.templates.push(template);
    await this.persistence.saveCollection("templates", this.data.templates);
    await this.audit(context, "template.create", "template", template.id, undefined, { kind, channel });
    return { ...template, usageCount: 0 };
  }

  async updateTemplate(context: RequestContext, templateId: string, input: UpsertTemplateInput) {
    const template = this.ensureTemplate(context, templateId);
    if (typeof input.name === "string" && input.name.trim()) {
      template.name = input.name.trim();
    }
    const { channel, kind } = this.resolveTemplateChannelKind(input, template);
    template.channel = channel;
    template.kind = kind;
    if (kind === "text") {
      // Body is required for text templates: take the new one or keep an existing body.
      if (input.body !== undefined) {
        template.body = ensureString(input.body, "body");
      } else if (!template.body) {
        throw new ApiError(400, "Missing required field: body");
      }
      template.formId = undefined;
    } else {
      const formId =
        input.formId !== undefined ? ensureString(input.formId, "formId") : template.formId;
      if (!formId) {
        throw new ApiError(400, "Missing required field: formId");
      }
      this.ensureFormExists(context.tenantId, formId);
      template.formId = formId;
      template.body = undefined;
    }
    if (input.status === "active" || input.status === "archived") {
      template.status = input.status;
    }
    template.updatedAt = nowIso();
    await this.persistence.saveCollection("templates", this.data.templates);
    await this.audit(context, "template.update", "template", template.id, undefined, { status: template.status });
    return { ...template, usageCount: this.templateUsageCount(context.tenantId, template.id) };
  }

  /** Soft-archive a template (keeps workflow references intact for attribution). */
  async deleteTemplate(context: RequestContext, templateId: string) {
    const template = this.ensureTemplate(context, templateId);
    template.status = "archived";
    template.updatedAt = nowIso();
    await this.persistence.saveCollection("templates", this.data.templates);
    await this.audit(context, "template.delete", "template", template.id, undefined, { soft: true });
    return { ...template, usageCount: this.templateUsageCount(context.tenantId, template.id) };
  }

  private ensureFormExists(tenantId: string, formId: string) {
    const exists = this.data.forms.some((form) => form.id === formId && form.tenantId === tenantId);
    if (!exists) {
      throw new ApiError(400, `Form not found: ${formId}`);
    }
  }

  // ---- Communication Workflows: workflows (CRUD, config-only) --------------

  /**
   * Test-only: force an appointment's scheduledAt so the scheduler's `relative`
   * stage due-time can be exercised deterministically (no schedule re-validation).
   */
  async setAppointmentScheduledAtForTest(appointmentId: string, scheduledAt: string): Promise<void> {
    const appointment = this.data.appointments.find((entry) => entry.id === appointmentId);
    if (appointment) {
      appointment.scheduledAt = scheduledAt;
      appointment.updatedAt = nowIso();
      await this.persistence.saveCollection("appointments", this.data.appointments);
    }
  }

  /**
   * Workflow runs anchored to an appointment (newest first). Internal/test read of
   * the runtime's run state — no UI surface yet (Templates stats come later).
   */
  listAppointmentWorkflowRunsForTest(appointmentId: string): WorkflowRun[] {
    return this.data.workflowRuns
      .filter((run) => run.anchorType === "appointment" && run.anchorId === appointmentId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /** Tenant-scoped workflows. */
  async listWorkflows(context: RequestContext) {
    // Same lazy provisioning as listTemplates — a fresh tenant lands on a populated
    // "Appointment lifecycle" workflow instead of an empty page.
    await this.ensureDefaultAppointmentWorkflow(context);
    return this.data.workflows
      .filter((workflow) => workflow.tenantId === context.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getWorkflow(context: RequestContext, workflowId: string) {
    return this.ensureWorkflow(context, workflowId);
  }

  private ensureWorkflow(context: RequestContext, workflowId: string): Workflow {
    const workflow = this.data.workflows.find(
      (entry) => entry.id === workflowId && entry.tenantId === context.tenantId
    );
    if (!workflow) {
      throw new ApiError(404, `Workflow not found: ${workflowId}`);
    }
    return workflow;
  }

  /** Validate + normalize a list of workflow stages (unique keys, valid action/trigger, template refs). */
  private sanitizeWorkflowStages(tenantId: string, value: unknown): WorkflowStage[] {
    if (!Array.isArray(value)) {
      throw new ApiError(400, "stages must be an array");
    }
    const stages: WorkflowStage[] = [];
    const seenKeys = new Set<string>();
    for (const entry of value) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new ApiError(400, "Each stage must be an object");
      }
      const candidate = entry as Record<string, unknown>;
      const key = ensureString(candidate.key, "stage key");
      if (seenKeys.has(key)) {
        throw new ApiError(400, `Duplicate stage key: ${key}`);
      }
      seenKeys.add(key);
      const name = ensureString(candidate.name, `stage "${key}" name`);
      if (!STAGE_ACTIONS.has(candidate.action as StageAction)) {
        throw new ApiError(400, `Stage "${key}" has an invalid action`);
      }
      const action = candidate.action as StageAction;
      const trigger = sanitizeStageTrigger(candidate.trigger, key);
      const stage: WorkflowStage = {
        key,
        name,
        action,
        trigger,
        enabled: candidate.enabled !== false
      };
      if (TEMPLATE_BACKED_ACTIONS.has(action)) {
        const templateId = ensureString(candidate.templateId, `stage "${key}" templateId`);
        const template = this.data.templates.find(
          (entry2) => entry2.id === templateId && entry2.tenantId === tenantId
        );
        if (!template || template.status !== "active") {
          throw new ApiError(400, `Stage "${key}" references a missing or inactive template: ${templateId}`);
        }
        stage.templateId = templateId;
      }
      if (action === "task" && typeof candidate.ownerRole === "string" && candidate.ownerRole.trim()) {
        stage.ownerRole = candidate.ownerRole.trim();
      }
      stages.push(stage);
    }
    return stages;
  }

  async createWorkflow(context: RequestContext, input: UpsertWorkflowInput) {
    const name = ensureString(input.name, "name");
    if (!WORKFLOW_ANCHORS.has(input.anchor as WorkflowAnchor)) {
      throw new ApiError(400, "Missing or invalid field: anchor");
    }
    const anchor = input.anchor as WorkflowAnchor;
    const stages = this.sanitizeWorkflowStages(context.tenantId, input.stages ?? []);
    const timestamp = nowIso();
    const workflow: Workflow = {
      id: createId("workflow"),
      tenantId: context.tenantId,
      name,
      description:
        typeof input.description === "string" && input.description.trim() ? input.description.trim() : undefined,
      anchor,
      status: input.status === "active" || input.status === "archived" ? input.status : "draft",
      stages,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.workflows.push(workflow);
    await this.persistence.saveCollection("workflows", this.data.workflows);
    await this.audit(context, "workflow.create", "workflow", workflow.id, undefined, { anchor, stages: stages.length });
    return workflow;
  }

  async updateWorkflow(context: RequestContext, workflowId: string, input: UpsertWorkflowInput) {
    const workflow = this.ensureWorkflow(context, workflowId);
    if (typeof input.name === "string" && input.name.trim()) {
      workflow.name = input.name.trim();
    }
    if (input.description !== undefined) {
      workflow.description =
        typeof input.description === "string" && input.description.trim() ? input.description.trim() : undefined;
    }
    if (input.status === "draft" || input.status === "active" || input.status === "archived") {
      workflow.status = input.status;
    }
    if (input.stages !== undefined) {
      workflow.stages = this.sanitizeWorkflowStages(context.tenantId, input.stages);
    }
    workflow.updatedAt = nowIso();
    await this.persistence.saveCollection("workflows", this.data.workflows);
    await this.audit(context, "workflow.update", "workflow", workflow.id, undefined, { status: workflow.status });
    return workflow;
  }

  /** Soft-archive a workflow. */
  async deleteWorkflow(context: RequestContext, workflowId: string) {
    const workflow = this.ensureWorkflow(context, workflowId);
    workflow.status = "archived";
    workflow.updatedAt = nowIso();
    await this.persistence.saveCollection("workflows", this.data.workflows);
    await this.audit(context, "workflow.delete", "workflow", workflow.id, undefined, { soft: true });
    return workflow;
  }

  private async audit(
    context: RequestContext,
    action: AuditEvent["action"],
    resourceType: string,
    resourceId?: string,
    patientId?: string,
    details?: Record<string, unknown>
  ) {
    const event: AuditEvent = {
      id: createId("audit"),
      tenantId: context.tenantId,
      actorType: context.actorType,
      actorId: context.actorId,
      actorDisplayName: context.displayName,
      action,
      resourceType,
      resourceId,
      patientId,
      details,
      createdAt: nowIso()
    };
    this.data.auditEvents.push(event);
    await this.persistence.saveCollection("auditEvents", this.data.auditEvents);
  }

  private summarizePatient(context: RequestContext, patient: Patient): PatientSummary {
    const interactions = this.data.interactions
      .filter((entry) => entry.tenantId === context.tenantId && entry.patientId === patient.id)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const household = patient.householdId
      ? this.data.households.find((entry) => entry.id === patient.householdId && entry.tenantId === context.tenantId)
      : undefined;

    return {
      ...patient,
      openTaskCount: this.data.tasks.filter(
        (task) => task.tenantId === context.tenantId && task.patientId === patient.id && task.status !== "completed"
      ).length,
      upcomingAppointmentCount: this.data.appointments.filter(
        (appointment) =>
          appointment.tenantId === context.tenantId &&
          appointment.patientId === patient.id &&
          ["scheduled", "confirmed", "rescheduled"].includes(appointment.status)
      ).length,
      pendingFollowUpCount: this.data.followUps.filter(
        (followUp) => followUp.tenantId === context.tenantId && followUp.patientId === patient.id && followUp.status === "due"
      ).length,
      lastInteractionAt: interactions[0]?.receivedAt,
      household: household && this.canAccessHousehold(context, household) ? this.householdView(context, household) : undefined
    };
  }

  private householdView(context: RequestContext, household: Household): Household {
    return {
      ...household,
      members: household.members.filter((member) => this.canAccessBranch(context, member.branchId))
    };
  }

  private staffHouseholdView(context: RequestContext, household: Household) {
    const view = this.householdView(context, household);
    return {
      id: view.id,
      name: view.displayName,
      primaryPhone: maskPhone(view.primaryPhone),
      preferredLanguage: view.preferredLanguage ?? "Not set",
      riskNotes: view.riskNotes,
      members: view.members.map((member) => ({
        patientId: member.patientId,
        displayName: member.displayName,
        relationship: member.relationship,
        primaryContact: member.primaryContact
      })),
      caregivers: view.caregiverPermissions.map((caregiver) => ({
        id: caregiver.caregiverId,
        displayName: caregiver.caregiverName,
        relationship: caregiver.relationship,
        consentStatus: caregiver.consentStatus,
        permissions: caregiver.permissions
      }))
    };
  }

  private inboxThreadView(context: RequestContext, interaction: Interaction) {
    const patient = interaction.patientId
      ? this.data.patients.find((entry) => entry.id === interaction.patientId && entry.tenantId === context.tenantId)
      : undefined;
    const tasks = this.data.tasks
      .filter((task) => interaction.createdTaskIds.includes(task.id))
      .map((task) => this.taskView(context, task));
    return {
      ...interaction,
      patient: patient
        ? {
            id: patient.id,
            displayName: patient.displayName,
            primaryPhone: patient.primaryPhone,
            identityStatus: patient.identityStatus
          }
        : undefined,
      tasks,
      notes: interaction.notes ?? [],
      drafts: interaction.drafts ?? [],
      linkedResourceIds: interaction.linkedResourceIds ?? []
    };
  }

  private patientJourneyView(context: RequestContext, journey: PatientJourney) {
    const patient = this.ensureKnownPatient(context, journey.patientId);
    return {
      ...journey,
      patient: {
        id: patient.id,
        displayName: patient.displayName,
        primaryPhone: patient.primaryPhone,
        preferredLanguage: patient.preferredLanguage
      },
      template: journey.templateId
        ? this.data.journeyTemplates.find((entry) => entry.id === journey.templateId && entry.tenantId === context.tenantId)
        : undefined,
      tasks: this.data.journeyTasks
        .filter((task) => task.journeyId === journey.id && task.tenantId === context.tenantId)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
      events: this.data.journeyEvents
        .filter((event) => event.journeyId === journey.id && event.tenantId === context.tenantId)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    };
  }

  private createJourneyEventRecord(
    context: RequestContext,
    journey: PatientJourney,
    type: JourneyEvent["type"],
    payload: Record<string, unknown>
  ): JourneyEvent {
    return {
      id: createId("journey_event"),
      tenantId: context.tenantId,
      journeyId: journey.id,
      patientId: journey.patientId,
      type,
      payload: {
        ...payload,
        actorId: context.actorId,
        actorType: context.actorType
      },
      occurredAt: nowIso()
    };
  }

  private taskView(context: RequestContext, task: WorkbenchTask): WorkbenchTaskView {
    const patient = task.patientId
      ? this.data.patients.find((entry) => entry.id === task.patientId && entry.tenantId === context.tenantId)
      : undefined;
    return {
      ...task,
      patient: patient
        ? {
            id: patient.id,
            displayName: patient.displayName,
            primaryPhone: patient.primaryPhone,
            preferredLanguage: patient.preferredLanguage,
            identityStatus: patient.identityStatus
          }
        : undefined
    };
  }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
