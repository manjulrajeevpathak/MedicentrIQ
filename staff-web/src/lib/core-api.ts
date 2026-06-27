import { buildDemoAuthContext, demoBranch, demoTenant, mockAuditEvents, mockDashboardData } from "./mock-data";
import type { AuditEvent, DashboardData, DemoAuthContext, DemoUser } from "./types";

const DASHBOARD_PATH = "/api/staff/dashboard";
const AUDIT_EVENTS_PATH = "/audit/events";

/**
 * Fetch the staff dashboard from core-api, gracefully degrading to the rich
 * demo dataset when the API is unset, slow, or unavailable. Extended UI-only
 * fields (threads, slots, journeys, directory) are always merged from mock so
 * the console looks complete even against a minimal live response.
 */
export async function getDashboardData(userId?: string, sessionToken?: string): Promise<DashboardData> {
  const baseUrl = process.env.NEXT_PUBLIC_CORE_API_URL;
  const authContext = buildDemoAuthContext(
    resolveDemoUserId(userId),
    baseUrl ? resolveAuthMode(sessionToken) : "fallback"
  );

  if (!baseUrl) {
    return withGovernance({ ...mockDashboardData, source: "mock" }, authContext, mockAuditEvents);
  }

  try {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const headers = buildAuthHeaders(authContext.activeUser, sessionToken);
    const [dashboardResponse, auditEvents] = await Promise.all([
      fetch(`${normalizedBaseUrl}${DASHBOARD_PATH}`, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(1500)
      }),
      fetchAuditEvents(normalizedBaseUrl, headers)
    ]);

    if (!dashboardResponse.ok) {
      return withGovernance({ ...mockDashboardData, source: "mock" }, authContext, auditEvents);
    }

    const envelope = (await dashboardResponse.json()) as { data?: Partial<DashboardData> } | Partial<DashboardData>;
    const data = ("data" in envelope && envelope.data ? envelope.data : envelope) as Partial<DashboardData>;

    return withGovernance(
      {
        ...mockDashboardData,
        ...data,
        source: "core-api"
      },
      authContext,
      auditEvents
    );
  } catch {
    return withGovernance({ ...mockDashboardData, source: "mock" }, authContext, mockAuditEvents);
  }
}

export type StaffActionRequest =
  | { type: "create_patient"; name: string; age?: number; gender?: string; phone?: string; language?: string; condition?: string }
  | { type: "complete_task"; id: string; outcome?: string }
  | { type: "assign_interaction"; id: string; ownerRole?: string }
  | { type: "link_conversation_patient"; id: string; patientId?: string }
  | { type: "save_inbox_draft"; id: string; body?: string }
  | { type: "add_inbox_note"; id: string; note?: string }
  | { type: "escalate_interaction"; id: string; reason?: string }
  | { type: "resolve_identity_match"; id: string; householdId?: string }
  | { type: "hold_access_slot"; id: string }
  | { type: "confirm_appointment"; id: string }
  | { type: "send_mobile_link"; id: string }
  | { type: "start_follow_up"; id: string; patientName?: string }
  | { type: "complete_follow_up_task"; id: string }
  | { type: "escalate_follow_up"; id: string; reason?: string };

export type StaffActionResult = { ok: boolean; message: string };

export async function submitStaffAction(
  activeUser: Pick<DemoUser, "id">,
  action: StaffActionRequest
): Promise<StaffActionResult> {
  const baseUrl = process.env.NEXT_PUBLIC_CORE_API_URL;
  if (!baseUrl) {
    // Demo mode: optimistic, locally-resolved success so the UI stays clickable.
    return { ok: true, message: `${successMessage(action)} (demo mode)` };
  }

  try {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const headers = { ...buildAuthHeaders(activeUser), "content-type": "application/json" };
    const request = actionRequest(action);
    const response = await fetch(`${normalizedBaseUrl}${request.path}`, {
      method: request.method,
      headers,
      body: JSON.stringify(request.body)
    });
    const envelope = (await response.json().catch(() => ({}))) as { error?: { message?: string } };

    if (!response.ok) {
      return { ok: false, message: envelope.error?.message ?? `Action failed with ${response.status}.` };
    }
    return { ok: true, message: successMessage(action) };
  } catch {
    return { ok: false, message: "core-api is unavailable. Try again after the service is online." };
  }
}

function resolveDemoUserId(requestedUserId?: string): string | undefined {
  return requestedUserId || process.env.NEXT_PUBLIC_DEMO_USER_ID || process.env.DEMO_USER_ID;
}

function resolveAuthMode(sessionToken?: string): DemoAuthContext["mode"] {
  return sessionToken || staffSessionToken() ? "staff-session" : "demo-headers";
}

function staffSessionToken(): string | undefined {
  return process.env.NEXT_PUBLIC_CORE_API_STAFF_SESSION_TOKEN || process.env.CORE_API_STAFF_SESSION_TOKEN;
}

function buildAuthHeaders(activeUser: Pick<DemoUser, "id">, sessionToken?: string): HeadersInit {
  // A logged-in session cookie wins over any static env token; both win over
  // demo headers (used in cookie-less demo mode).
  const token = sessionToken || staffSessionToken();
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return {
    "x-demo-user-id": activeUser.id,
    "x-demo-tenant-id": process.env.NEXT_PUBLIC_DEMO_TENANT_ID || process.env.DEMO_TENANT_ID || demoTenant.id,
    "x-demo-branch-id": process.env.NEXT_PUBLIC_DEMO_BRANCH_ID || process.env.DEMO_BRANCH_ID || demoBranch.id
  };
}

async function fetchAuditEvents(baseUrl: string, headers: HeadersInit): Promise<AuditEvent[]> {
  try {
    const response = await fetch(`${baseUrl}${AUDIT_EVENTS_PATH}`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return mockAuditEvents;

    const data = (await response.json()) as AuditEvent[] | { events?: AuditEvent[]; data?: AuditEvent[] };
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.data)) return data.data;
    return mockAuditEvents;
  } catch {
    return mockAuditEvents;
  }
}

function withGovernance(data: DashboardData, authContext: DemoAuthContext, auditEvents: AuditEvent[]): DashboardData {
  return {
    ...data,
    generatedAt: data.generatedAt || new Date().toISOString(),
    authContext,
    auditEvents: auditEvents.length ? auditEvents : mockAuditEvents,
    serviceStatus: data.serviceStatus.map((service) => ({
      ...service,
      authMode: service.authMode ?? (authContext.mode === "staff-session" ? "staff session" : "demo headers"),
      scope: service.scope ?? `${demoTenant.id} / ${demoBranch.id}`
    }))
  };
}

function actionRequest(action: StaffActionRequest): { method: "POST" | "PATCH"; path: string; body: Record<string, unknown> } {
  switch (action.type) {
    case "create_patient":
      return {
        method: "POST",
        path: "/patients",
        body: {
          displayName: action.name,
          age: action.age,
          gender: action.gender,
          primaryPhone: action.phone,
          preferredLanguage: action.language,
          tags: action.condition ? [action.condition] : undefined,
          source: "staff.patients"
        }
      };
    case "complete_task":
      return {
        method: "PATCH",
        path: `/workbench/tasks/${encodeURIComponent(action.id)}`,
        body: { status: "completed", outcome: action.outcome ?? "Completed from staff console." }
      };
    case "assign_interaction":
      return {
        method: "POST",
        path: `/interactions/${encodeURIComponent(action.id)}/assign`,
        body: { ownerRole: action.ownerRole ?? "care_coordinator", createTask: true }
      };
    case "link_conversation_patient":
      return {
        method: "POST",
        path: `/interactions/${encodeURIComponent(action.id)}/patient-link`,
        body: { patientId: action.patientId, source: "staff.inbox" }
      };
    case "save_inbox_draft":
      return {
        method: "POST",
        path: `/interactions/${encodeURIComponent(action.id)}/drafts`,
        body: { body: action.body ?? "Draft saved from staff inbox.", source: "staff.inbox" }
      };
    case "add_inbox_note":
      return {
        method: "POST",
        path: `/interactions/${encodeURIComponent(action.id)}/notes`,
        body: { note: action.note ?? "Staff note added from unified inbox.", source: "staff.inbox" }
      };
    case "escalate_interaction":
      return {
        method: "POST",
        path: `/interactions/${encodeURIComponent(action.id)}/escalations`,
        body: { reason: action.reason ?? "Escalated from unified inbox.", ownerRole: "nurse" }
      };
    case "resolve_identity_match":
      return {
        method: "POST",
        path: `/patients/${encodeURIComponent(action.id)}/identity-matches/resolve`,
        body: { householdId: action.householdId, source: "staff.patient_identity" }
      };
    case "hold_access_slot":
      return { method: "POST", path: `/access/requests/${encodeURIComponent(action.id)}/slot-hold`, body: { source: "staff.access" } };
    case "confirm_appointment":
      return {
        method: "POST",
        path: `/appointments/${encodeURIComponent(action.id)}/confirm`,
        body: { confirmedBy: "staff", notes: "Confirmed from staff console." }
      };
    case "send_mobile_link":
      return {
        method: "POST",
        path: `/access/requests/${encodeURIComponent(action.id)}/mobile-link`,
        body: { channel: "sms", source: "staff.access" }
      };
    case "start_follow_up":
      return {
        method: "POST",
        path: "/workflows/trigger",
        body: { workflowType: "post-visit-follow-up", followUpId: action.id, trigger: "staff.follow_up_queue" }
      };
    case "complete_follow_up_task":
      return {
        method: "PATCH",
        path: `/follow-ups/${encodeURIComponent(action.id)}`,
        body: { status: "completed", outcome: "Completed from continuity workspace." }
      };
    case "escalate_follow_up":
    default:
      return {
        method: "POST",
        path: `/follow-ups/${encodeURIComponent(action.id)}/escalations`,
        body: { reason: action.reason ?? "Escalated from continuity workspace.", ownerRole: "nurse" }
      };
  }
}

function successMessage(action: StaffActionRequest): string {
  const messages: Record<StaffActionRequest["type"], string> = {
    create_patient: "Patient added.",
    complete_task: "Task completed.",
    assign_interaction: "Conversation assigned and task created.",
    link_conversation_patient: "Conversation linked to patient record.",
    save_inbox_draft: "Draft saved.",
    add_inbox_note: "Note added.",
    escalate_interaction: "Conversation escalated.",
    resolve_identity_match: "Identity match resolved.",
    hold_access_slot: "Slot held.",
    confirm_appointment: "Appointment confirmed.",
    send_mobile_link: "Mobile confirmation link sent.",
    start_follow_up: "Follow-up workflow started.",
    complete_follow_up_task: "Follow-up task completed.",
    escalate_follow_up: "Follow-up escalated."
  };
  return messages[action.type];
}
