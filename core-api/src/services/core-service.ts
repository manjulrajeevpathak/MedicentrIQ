import { randomUUID } from "node:crypto";
import { DEMO_STAFF_USER_ID, DEMO_TENANT_ID, type SeedData } from "../domain/seed.js";
import { hasPermission, permissionsForRoles } from "../auth/permissions.js";
import { bearerTokenFromAuthorization, createStaffSessionToken, verifyStaffSessionToken } from "../auth/staff-session.js";
import type {
  AccessRequest,
  Appointment,
  AuditEvent,
  Caregiver,
  DocumentMetadata,
  FollowUp,
  Household,
  HouseholdCaregiverPermission,
  Interaction,
  InteractionChannel,
  InteractionDirection,
  JourneyEvent,
  JourneyTask,
  JourneyTaskStatus,
  JourneyTemplate,
  MobileLinkSession,
  PatientJourney,
  PatientJourneyStatus,
  Organization,
  Branch,
  User,
  Patient,
  PatientSummary,
  Permission,
  Priority,
  RequestContext,
  Role,
  TaskStatus,
  TenantType,
  TimelineEvent,
  WorkbenchTask,
  WorkbenchTaskView
} from "../domain/types.js";
import {
  MODULE_CATALOG,
  PLAN_CATALOG,
  DEFAULT_PLAN_ID,
  isPlanId,
  resolveEnabledModules,
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
  doctorName?: string;
  specialty?: string;
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

type UpdateAppointmentInput = {
  status?: Appointment["status"];
  outcome?: string;
};

type ConfirmAppointmentInput = {
  confirmedBy?: "patient" | "caregiver" | "staff";
  notes?: string;
};

type CreateDocumentMetadataInput = {
  appointmentId?: string;
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
    private readonly outbound: OutboundClients
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
      const secret = process.env.STAFF_SESSION_SECRET;
      if (!secret) {
        throw new ApiError(401, "Staff session auth is not configured");
      }

      let session;
      try {
        session = verifyStaffSessionToken(bearerToken, secret);
      } catch {
        throw new ApiError(401, "Invalid or expired staff session");
      }

      const user = this.data.users.find(
        (entry) => entry.id === session.userId && entry.tenantId === session.tenantId && entry.status === "active"
      );
      if (!user) {
        throw new ApiError(401, "Staff session user was not found");
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

  // ---- Platform tier (HealthOS superadmin) ----------------------------------

  listPlans() {
    return PLAN_CATALOG;
  }

  listModules() {
    return MODULE_CATALOG;
  }

  private tenantView(org: Organization) {
    return {
      id: org.id,
      displayName: org.displayName,
      type: org.type,
      status: org.status,
      planId: org.planId,
      moduleOverrides: org.moduleOverrides ?? {},
      enabledModules: resolveEnabledModules(org.planId, org.moduleOverrides),
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
    const adminEmail = typeof input.adminEmail === "string" ? input.adminEmail : undefined;
    const branchCity = typeof input.branchCity === "string" ? input.branchCity : "";
    const moduleOverrides = sanitizeModuleOverrides(input.moduleOverrides);
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

    return this.getTenant(tenantId);
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

    return {
      generatedAt: nowIso(),
      source: "core-api",
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
    return this.summarizePatient(context, patient);
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
        .map((entry) => ({
          id: `timeline_${entry.id}`,
          patientId,
          occurredAt: entry.scheduledAt,
          type: "appointment" as const,
          title: `${entry.specialty} appointment`,
          description: `${entry.status} with ${entry.doctorName}: ${entry.reason}`,
          sourceId: entry.id
        })),
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
      appointment
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

  listAppointments(context: RequestContext, filters: { patientId?: string; status?: string }) {
    return this.data.appointments.filter((entry) => {
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
      return true;
    });
  }

  async createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    const patientId = ensureString(input.patientId, "patientId");
    const patient = this.ensureKnownPatient(context, patientId);
    const timestamp = nowIso();
    const appointment: Appointment = {
      id: createId("appointment"),
      tenantId: context.tenantId,
      patientId,
      doctorName: ensureString(input.doctorName, "doctorName"),
      specialty: ensureString(input.specialty, "specialty"),
      branchId: input.branchId ?? patient.branchId,
      scheduledAt: ensureString(input.scheduledAt, "scheduledAt"),
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
    return appointment;
  }

  async updateAppointment(context: RequestContext, appointmentId: string, input: UpdateAppointmentInput) {
    const appointment = this.data.appointments.find((entry) => entry.id === appointmentId && entry.tenantId === context.tenantId);
    if (!appointment) {
      throw new ApiError(404, `Appointment not found: ${appointmentId}`);
    }
    if (!this.canAccessBranch(context, appointment.branchId)) {
      throw new ApiError(403, "Appointment is outside the actor's branch scope");
    }
    if (input.status) {
      appointment.status = input.status;
    }
    appointment.updatedAt = nowIso();
    await this.persistence.saveCollection("appointments", this.data.appointments);
    await this.audit(context, "appointment.update", "appointment", appointment.id, appointment.patientId, {
      status: appointment.status,
      outcome: input.outcome
    });
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
    return appointment;
  }

  async lookupMobileLinkSession(context: RequestContext, token: string) {
    const session = this.ensureSession(token);
    if (session.tenantId !== context.tenantId) {
      throw new ApiError(403, "Mobile link session is outside this tenant");
    }
    const patient = this.summarizePatient(context, this.ensureKnownPatient(context, session.patientId));
    await this.audit(context, "mobile_link.lookup", "mobile_link_session", session.token, session.patientId);
    return {
      session,
      patient,
      household: patient.household ? this.householdView(context, patient.household) : undefined,
      appointments: this.data.appointments.filter(
        (entry) => entry.tenantId === context.tenantId && entry.patientId === patient.id && entry.status === "scheduled"
      ),
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
      .map((entry) => ({
        at: formatDue(entry.scheduledAt),
        title: entry.reason,
        note: `${entry.doctorName}, ${entry.specialty}`
      }));

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
