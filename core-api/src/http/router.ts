import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { ApiError, type CoreService } from "../services/core-service.js";
import type { Permission, RequestContext } from "../domain/types.js";
import type { ModuleKey } from "../domain/platform.js";

type RouteHandler = (context: {
  request: IncomingMessage;
  response: ServerResponse;
  auth: RequestContext;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}) => unknown | Promise<unknown>;

type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  permission?: Permission;
  /** Entitlement module this route belongs to; staff actors must have it enabled. */
  module?: ModuleKey;
  handler: RouteHandler;
};

const parseJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
};

const toRecord = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
};

const route = (
  method: string,
  path: string,
  permission: Permission | undefined,
  handler: RouteHandler,
  module?: ModuleKey
): Route => {
  const paramNames: string[] = [];
  const expression = path
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        paramNames.push(part.slice(1));
        return "([^/]+)";
      }
      return part;
    })
    .join("/");

  return {
    method,
    pattern: new RegExp(`^${expression}$`),
    paramNames,
    permission,
    module,
    handler
  };
};

const createRoutes = (service: CoreService): Route[] => [
  route("GET", "/health", undefined, () => service.health()),
  route("GET", "/auth/me", "auth:read_self", ({ auth }) => service.getCurrentUser(auth)),
  route("POST", "/auth/password/change", "auth:read_self", ({ auth, body }) => service.changePassword(auth, toRecord(body))),

  // Hospital user management (org admin).
  route("GET", "/users", "users:read", ({ auth }) => service.listUsers(auth)),
  route("POST", "/users", "users:manage", ({ auth, body }) => service.createUser(auth, toRecord(body))),
  route("PATCH", "/users/:userId", "users:manage", ({ auth, params, body }) => service.updateUser(auth, params.userId, toRecord(body))),
  route("POST", "/users/:userId/reset-password", "users:manage", ({ auth, params }) => service.resetUserPassword(auth, params.userId)),
  route("PATCH", "/tenant/settings", "tenant:settings:manage", ({ auth, body }) => service.updateTenantSettings(auth, toRecord(body))),

  // Messaging channels (per-tenant WhatsApp): config + send.
  route("GET", "/tenant/channels", "tenant:settings:manage", ({ auth }) => service.getTenantChannels(auth)),
  route("PATCH", "/tenant/channels", "tenant:settings:manage", ({ auth, body }) => service.updateTenantChannels(auth, toRecord(body))),
  route("POST", "/messages/send", "messages:send", ({ auth, body }) => service.sendMessage(auth, toRecord(body))),
  route("POST", "/messages/test", "tenant:settings:manage", ({ auth, body }) => service.sendMessage(auth, toRecord(body))),
  route("GET", "/messages", "tenant:settings:manage", ({ auth, query }) =>
    service.listMessages(auth, Number.parseInt(query.get("limit") ?? "25", 10))
  ),

  // Platform admin management (superadmin).
  route("GET", "/platform/admins", "platform:admins:read", () => service.listPlatformAdmins()),
  route("POST", "/platform/admins", "platform:admins:manage", ({ auth, body }) => service.createPlatformAdmin(auth, toRecord(body))),
  route("PATCH", "/platform/admins/:adminId", "platform:admins:manage", ({ auth, params, body }) =>
    service.updatePlatformAdmin(auth, params.adminId, toRecord(body))
  ),
  route("GET", "/api/staff/dashboard", "patients:read", ({ auth }) => service.getStaffDashboard(auth), "today"),
  route("GET", "/audit/events", "audit:read", ({ auth, query }) =>
    service.listAuditEvents(auth, {
      patientId: query.get("patientId") ?? undefined,
      action: query.get("action") ?? undefined
    }), "operations"
  ),

  // Platform tier — HealthOS superadmin: provision tenants and manage entitlements.
  route("GET", "/platform/plans", "platform:tenants:read", () => service.listPlans()),
  route("GET", "/platform/modules", "platform:tenants:read", () => service.listModules()),
  route("GET", "/platform/tenants", "platform:tenants:read", () => service.listTenants()),
  route("POST", "/platform/tenants", "platform:tenants:manage", ({ auth, body }) =>
    service.createTenant(auth, toRecord(body))
  ),
  route("GET", "/platform/tenants/:tenantId", "platform:tenants:read", ({ params }) =>
    service.getTenant(params.tenantId)
  ),
  route("PATCH", "/platform/tenants/:tenantId", "platform:entitlements:manage", ({ auth, params, body }) =>
    service.updateTenant(auth, params.tenantId, toRecord(body))
  ),
  route("PATCH", "/platform/tenants/:tenantId/users/:userId", "platform:tenants:manage", ({ auth, params, body }) =>
    service.updateTenantUser(auth, params.tenantId, params.userId, toRecord(body))
  ),

  route("GET", "/patients", "patients:read", ({ auth }) => service.listPatients(auth), "patients"),
  route("POST", "/patients", "patients:create", ({ auth, body }) => service.createPatient(auth, toRecord(body))),
  route("GET", "/patients/:patientId", "patients:read", ({ auth, params }) => service.getPatient(auth, params.patientId)),
  route("GET", "/patients/:patientId/timeline", "patients:read", ({ auth, params }) =>
    service.getPatientTimeline(auth, params.patientId)
  ),
  route("GET", "/households", "patients:read", ({ auth }) => service.listHouseholds(auth)),
  route("GET", "/households/:householdId", "patients:read", ({ auth, params }) => service.getHousehold(auth, params.householdId)),
  route("POST", "/households/:householdId/caregivers", "identity:resolve", ({ auth, params, body }) =>
    service.upsertHouseholdCaregiver(auth, params.householdId, toRecord(body))
  ),
  route("PATCH", "/patients/:patientId/household", "identity:resolve", ({ auth, params, body }) =>
    service.updatePatientHousehold(auth, params.patientId, toRecord(body))
  ),
  route("GET", "/identity/search", "patients:read", ({ auth, query }) =>
    service.searchIdentities(auth, {
      query: query.get("query") ?? undefined,
      phone: query.get("phone") ?? undefined,
      uhid: query.get("uhid") ?? undefined,
      abhaId: query.get("abhaId") ?? undefined
    })
  ),
  route("GET", "/identity/match-candidates", "patients:read", ({ auth, query }) =>
    service.listIdentityMatchCandidates(auth, {
      interactionId: query.get("interactionId") ?? undefined,
      phone: query.get("phone") ?? undefined,
      patientId: query.get("patientId") ?? undefined
    })
  ),
  route("POST", "/identity/resolve", "identity:resolve", ({ auth, body }) => service.resolveIdentity(auth, toRecord(body))),

  route("GET", "/interactions", "interactions:read", ({ auth, query }) =>
    service.listInteractions(auth, {
      status: query.get("status") ?? undefined,
      patientId: query.get("patientId") ?? undefined
    }), "inbox"
  ),
  route("POST", "/interactions", "interactions:create", ({ auth, body }) => service.createInteraction(auth, toRecord(body))),
  route("POST", "/interactions/:interactionId/assign", "tasks:update", ({ auth, params, body }) =>
    service.assignInteraction(auth, params.interactionId, toRecord(body))
  ),
  route("GET", "/inbox", "interactions:read", ({ auth }) => service.listInbox(auth), "inbox"),
  route("GET", "/inbox/:interactionId", "interactions:read", ({ auth, params }) =>
    service.getInboxThread(auth, params.interactionId)
  ),
  route("PATCH", "/inbox/:interactionId", "interactions:update", ({ auth, params, body }) =>
    service.updateInboxThread(auth, params.interactionId, toRecord(body))
  ),
  route("POST", "/inbox/:interactionId/notes", "interactions:update", ({ auth, params, body }) =>
    service.addInboxThreadNote(auth, params.interactionId, toRecord(body))
  ),
  route("POST", "/inbox/:interactionId/drafts", "interactions:update", ({ auth, params, body }) =>
    service.upsertInboxThreadDraft(auth, params.interactionId, toRecord(body))
  ),

  route("GET", "/access/requests", "access_requests:read", ({ auth, query }) =>
    service.listAccessRequests(auth, {
      status: query.get("status") ?? undefined,
      patientId: query.get("patientId") ?? undefined
    }), "access"
  ),
  route("POST", "/access/requests", "access_requests:update", ({ auth, body }) =>
    service.createAccessRequest(auth, toRecord(body))
  ),
  route("GET", "/access/requests/:accessRequestId", "access_requests:read", ({ auth, params }) =>
    service.getAccessRequest(auth, params.accessRequestId)
  ),
  route("POST", "/access/requests/:accessRequestId/slot", "access_requests:update", ({ auth, params, body }) =>
    service.offerAccessSlot(auth, params.accessRequestId, toRecord(body))
  ),
  route("POST", "/access/requests/:accessRequestId/book", "access_requests:update", ({ auth, params, body }) =>
    service.bookAccessRequest(auth, params.accessRequestId, toRecord(body))
  ),
  route("POST", "/access/requests/:accessRequestId/mobile-link", "access_requests:update", ({ auth, params, body }) =>
    service.sendAccessMobileLink(auth, params.accessRequestId, toRecord(body))
  ),
  route("POST", "/access/requests/:accessRequestId/confirm", "appointments:confirm", ({ auth, params, body }) =>
    service.confirmAccessRequest(auth, params.accessRequestId, toRecord(body))
  ),
  route("POST", "/access/requests/:accessRequestId/reschedule", "access_requests:update", ({ auth, params, body }) =>
    service.rescheduleAccessRequest(auth, params.accessRequestId, toRecord(body))
  ),

  route("GET", "/workbench/tasks", "tasks:read", ({ auth, query }) =>
    service.listWorkbenchTasks(auth, {
      status: query.get("status") ?? undefined,
      ownerRole: query.get("ownerRole") ?? undefined,
      patientId: query.get("patientId") ?? undefined
    }), "today"
  ),
  route("PATCH", "/workbench/tasks/:taskId", "tasks:update", ({ auth, params, body }) =>
    service.updateTask(auth, params.taskId, toRecord(body))
  ),

  // Doctors & scheduling.
  route("GET", "/doctors", "doctors:read", ({ auth }) => service.listDoctors(auth), "access"),
  route("POST", "/doctors", "doctors:manage", ({ auth, body }) => service.createDoctor(auth, toRecord(body)), "access"),
  route("PATCH", "/doctors/:doctorId", "doctors:manage", ({ auth, params, body }) =>
    service.updateDoctor(auth, params.doctorId, toRecord(body)), "access"
  ),
  route("PUT", "/doctors/:doctorId/schedule", "doctors:manage", ({ auth, params, body }) =>
    service.setDoctorSchedule(auth, params.doctorId, toRecord(body)), "access"
  ),
  route("GET", "/doctors/:doctorId/slots", "appointments:read", ({ auth, params, query }) =>
    service.getDoctorSlots(auth, params.doctorId, query.get("date") ?? "", query.get("branchId") ?? undefined), "access"
  ),
  route("POST", "/scheduling/send-confirmations", "doctors:manage", ({ auth }) =>
    service.sendDoctorConfirmations(auth), "access"
  ),

  route("GET", "/appointments", "appointments:read", ({ auth, query }) =>
    service.listAppointments(auth, {
      patientId: query.get("patientId") ?? undefined,
      status: query.get("status") ?? undefined,
      doctorId: query.get("doctorId") ?? undefined,
      date: query.get("date") ?? undefined
    }), "access"
  ),
  route("POST", "/appointments", "appointments:create", ({ auth, body }) => service.bookAppointment(auth, toRecord(body)), "access"),
  route("POST", "/appointments/:appointmentId/confirm", "appointments:confirm", ({ auth, params, body }) =>
    service.confirmAppointment(auth, params.appointmentId, toRecord(body))
  ),
  route("PATCH", "/appointments/:appointmentId", "appointments:create", ({ auth, params, body }) =>
    service.updateAppointment(auth, params.appointmentId, toRecord(body))
  ),
  route("POST", "/appointments/:appointmentId/disposition", "appointments:create", ({ auth, params, body }) =>
    service.recordAppointmentDisposition(auth, params.appointmentId, toRecord(body))
  ),

  // Clinical history (ICD-10 conditions) per patient.
  route("GET", "/clinical/conditions", "clinical:read", () => service.listConditionCatalog()),
  route("GET", "/patients/:patientId/clinical", "clinical:read", ({ auth, params }) =>
    service.getClinicalRecord(auth, params.patientId)
  ),
  route("PUT", "/patients/:patientId/clinical", "clinical:write", ({ auth, params, body }) =>
    service.setClinicalRecord(auth, params.patientId, toRecord(body))
  ),

  // Patient documents (S3 presigned URLs, local-disk fallback).
  route("POST", "/patients/:patientId/documents/upload-url", "documents:create", ({ auth, params, body }) =>
    service.createDocumentUploadUrl(auth, params.patientId, toRecord(body))
  ),
  route("POST", "/patients/:patientId/documents", "documents:create", ({ auth, params, body }) =>
    service.recordPatientDocument(auth, params.patientId, toRecord(body))
  ),
  route("GET", "/patients/:patientId/documents", "documents:read", ({ auth, params }) =>
    service.listPatientDocuments(auth, params.patientId)
  ),
  route("GET", "/documents/:docId/url", "documents:read", ({ auth, params }) =>
    service.getDocumentDownloadUrl(auth, params.docId)
  ),

  route("GET", "/mobile-link-sessions/:token", "mobile_links:use", ({ auth, params }) =>
    service.lookupMobileLinkSession(auth, params.token)
  ),
  route("POST", "/mobile-link-sessions/:token/appointments/:appointmentId/confirm", "appointments:confirm", ({ auth, params, body }) =>
    service.confirmAppointment(auth, params.appointmentId, toRecord(body), params.token)
  ),
  route("POST", "/mobile-link-sessions/:token/appointments/:appointmentId/reschedule-requests", "mobile_links:use", ({ auth, params, body }) =>
    service.requestAppointmentReschedule(auth, params.token, params.appointmentId, toRecord(body))
  ),
  route("POST", "/mobile-link-sessions/:token/checklist/:itemId", "mobile_links:use", ({ auth, params, body }) =>
    service.updateMobileChecklist(auth, params.token, params.itemId, toRecord(body))
  ),
  route("POST", "/mobile-link-sessions/:token/document-metadata", "documents:create", ({ auth, params, body }) =>
    service.createDocumentMetadata(auth, params.token, toRecord(body))
  ),
  route("POST", "/mobile-link-sessions/:token/follow-ups/:followUpId/confirm", "followups:confirm", ({ auth, params, body }) =>
    service.confirmFollowUp(auth, params.token, params.followUpId, toRecord(body))
  ),
  route("POST", "/mobile-link-sessions/:token/consent", "mobile_links:use", ({ auth, params, body }) =>
    service.updateMobileConsent(auth, params.token, toRecord(body))
  ),
  route("POST", "/mobile-link-sessions/:token/opt-out", "mobile_links:use", ({ auth, params, body }) =>
    service.optOutMobileLink(auth, params.token, toRecord(body))
  ),

  route("POST", "/workflows/trigger", "tasks:update", ({ auth, body }) => service.triggerWorkflow(auth, toRecord(body))),

  route("GET", "/journey-templates", "journeys:read", ({ auth }) => service.listJourneyTemplates(auth), "journeys"),
  route("POST", "/journey-templates", "journeys:update", ({ auth, body }) => service.createJourneyTemplate(auth, toRecord(body))),
  route("GET", "/patient-journeys", "journeys:read", ({ auth, query }) =>
    service.listPatientJourneys(auth, {
      patientId: query.get("patientId") ?? undefined,
      status: query.get("status") ?? undefined
    }), "journeys"
  ),
  route("POST", "/patient-journeys", "journeys:update", ({ auth, body }) => service.createPatientJourney(auth, toRecord(body))),
  route("GET", "/patient-journeys/:journeyId", "journeys:read", ({ auth, params }) =>
    service.getPatientJourney(auth, params.journeyId)
  ),
  route("PATCH", "/patient-journeys/:journeyId", "journeys:update", ({ auth, params, body }) =>
    service.updatePatientJourney(auth, params.journeyId, toRecord(body))
  ),
  route("POST", "/patient-journeys/:journeyId/tasks", "journeys:update", ({ auth, params, body }) =>
    service.createJourneyTask(auth, params.journeyId, toRecord(body))
  ),
  route("POST", "/patient-journeys/:journeyId/events", "journeys:update", ({ auth, params, body }) =>
    service.createJourneyEvent(auth, params.journeyId, toRecord(body))
  ),
  route("PATCH", "/journey-tasks/:taskId", "journeys:update", ({ auth, params, body }) =>
    service.updateJourneyTask(auth, params.taskId, toRecord(body))
  ),

  // Leads & data sources.
  route("GET", "/leads", "leads:read", ({ auth, query }) =>
    service.listLeads(auth, {
      stage: query.get("stage") ?? undefined,
      source: query.get("source") ?? undefined,
      assignedTo: query.get("assignedTo") ?? undefined
    }), "leads"
  ),
  route("GET", "/leads/funnel", "leads:read", ({ auth }) => service.getLeadFunnel(auth), "leads"),
  route("POST", "/leads", "leads:manage", ({ auth, body }) => service.createLead(auth, toRecord(body)), "leads"),
  route("POST", "/leads/import", "leads:manage", ({ auth, body }) => service.importLeads(auth, toRecord(body)), "leads"),
  route("PATCH", "/leads/:leadId", "leads:manage", ({ auth, params, body }) =>
    service.updateLead(auth, params.leadId, toRecord(body)), "leads"
  ),
  route("POST", "/leads/:leadId/convert", "leads:manage", ({ auth, params, body }) =>
    service.convertLead(auth, params.leadId, toRecord(body)), "leads"
  ),

  // Lead forms (camp registration). List uses leads:read; writes need forms:manage.
  route("GET", "/forms", "leads:read", ({ auth }) => service.listForms(auth), "leads"),
  route("POST", "/forms", "forms:manage", ({ auth, body }) => service.createForm(auth, toRecord(body)), "leads"),
  route("PATCH", "/forms/:formId", "forms:manage", ({ auth, params, body }) =>
    service.updateForm(auth, params.formId, toRecord(body)), "leads"
  ),

  // Campaigns (segmented broadcasts over the channel layer).
  route("GET", "/campaigns", "campaigns:read", ({ auth }) => service.listCampaigns(auth), "campaigns"),
  route("POST", "/campaigns", "campaigns:manage", ({ auth, body }) => service.createCampaign(auth, toRecord(body)), "campaigns"),
  route("POST", "/campaigns/preview-audience", "campaigns:read", ({ auth, body }) =>
    service.previewCampaignAudience(auth, toRecord(body)), "campaigns"
  ),
  route("PATCH", "/campaigns/:campaignId", "campaigns:manage", ({ auth, params, body }) =>
    service.updateCampaign(auth, params.campaignId, toRecord(body)), "campaigns"
  ),
  route("POST", "/campaigns/:campaignId/send", "campaigns:send", ({ auth, params }) =>
    service.sendCampaign(auth, params.campaignId), "campaigns"
  ),

  route("POST", "/service-events/integration", "service_events:ingest", ({ auth, body }) =>
    service.intakeIntegrationEvent(auth, toRecord(body))
  ),
  route("POST", "/service-events/workflow-callback", "service_events:ingest", ({ auth, body }) =>
    service.intakeWorkflowCallback(auth, toRecord(body))
  )
];

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-demo-user-id,x-demo-tenant-id,x-service-api-key,x-platform-api-key"
  });
  response.end(JSON.stringify(payload, null, 2));
};

const requestHeaders = (request: IncomingMessage): Record<string, string | undefined> => {
  const value = (name: string) => {
    const header = request.headers[name];
    return Array.isArray(header) ? header[0] : header;
  };

  return {
    authorization: value("authorization"),
    "x-demo-user-id": value("x-demo-user-id"),
    "x-demo-tenant-id": value("x-demo-tenant-id"),
    "x-service-api-key": value("x-service-api-key"),
    "x-platform-api-key": value("x-platform-api-key")
  };
};

export const createApiServer = (service: CoreService) =>
  createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        sendJson(response, 204, {});
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");
      const method = request.method ?? "GET";

      if (method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { data: service.health() });
        return;
      }

      if (method === "POST" && url.pathname === "/auth/sessions") {
        const body = await parseJsonBody(request);
        sendJson(response, 200, { data: service.createStaffSession(toRecord(body)) });
        return;
      }

      // Public (pre-authentication) endpoints — no auth context required.
      if (method === "POST" && url.pathname === "/auth/login") {
        sendJson(response, 200, { data: await service.login(toRecord(await parseJsonBody(request))) });
        return;
      }
      if (method === "POST" && url.pathname === "/auth/login/verify-otp") {
        sendJson(response, 200, { data: await service.verifyLoginOtp(toRecord(await parseJsonBody(request))) });
        return;
      }
      if (method === "POST" && url.pathname === "/auth/password/forgot") {
        sendJson(response, 200, { data: await service.requestPasswordReset(toRecord(await parseJsonBody(request))) });
        return;
      }
      if (method === "POST" && url.pathname === "/auth/password/reset") {
        sendJson(response, 200, { data: await service.resetPassword(toRecord(await parseJsonBody(request))) });
        return;
      }
      // Public lead-capture forms (no auth). core-api holds all tenants in memory /
      // connects with platform DB scope, so it can read/write the form's own tenant.
      {
        const publicFormMatch = /^\/public\/forms\/([^/]+)$/.exec(url.pathname);
        if (method === "GET" && publicFormMatch) {
          const slug = decodeURIComponent(publicFormMatch[1]);
          sendJson(response, 200, { data: service.getPublicForm(slug) });
          return;
        }
        const publicSubmitMatch = /^\/public\/forms\/([^/]+)\/submit$/.exec(url.pathname);
        if (method === "POST" && publicSubmitMatch) {
          const slug = decodeURIComponent(publicSubmitMatch[1]);
          sendJson(response, 200, { data: await service.submitPublicForm(slug, toRecord(await parseJsonBody(request))) });
          return;
        }
      }

      if (method === "GET" && url.pathname === "/auth/dev/outbox") {
        if (process.env.NODE_ENV === "production") {
          throw new ApiError(404, "Not found");
        }
        sendJson(response, 200, { data: service.getDevOutbox() });
        return;
      }

      // Local-disk storage fallback (no S3). These carry an unguessable storage key
      // in the path (which itself contains slashes, so they can't use the regex
      // router) and handle raw file bytes — PUT writes, GET streams. Keyed by the
      // storage key only; acceptable for the local dev fallback, not for production.
      if (url.pathname.startsWith("/storage/local/")) {
        const key = decodeURIComponent(url.pathname.slice("/storage/local/".length));
        if (!key) {
          throw new ApiError(400, "Missing storage key");
        }
        if (method === "PUT") {
          const chunks: Buffer[] = [];
          for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const result = await service.putLocalObject(key, Buffer.concat(chunks));
          sendJson(response, 200, { data: result });
          return;
        }
        if (method === "GET") {
          const bytes = await service.getLocalObject(key);
          response.writeHead(200, {
            "content-type": "application/octet-stream",
            "access-control-allow-origin": "*"
          });
          response.end(bytes);
          return;
        }
        throw new ApiError(405, `Method not allowed: ${method} ${url.pathname}`);
      }

      const routes = createRoutes(service);
      const matchedRoute = routes.find((candidate) => candidate.method === method && candidate.pattern.test(url.pathname));

      if (!matchedRoute) {
        throw new ApiError(404, `Route not found: ${method} ${url.pathname}`);
      }

      const match = matchedRoute.pattern.exec(url.pathname);
      const params = Object.fromEntries(
        matchedRoute.paramNames.map((name, index) => [name, decodeURIComponent(match?.[index + 1] ?? "")])
      );
      const mobileLinkToken = url.pathname.startsWith("/mobile-link-sessions/") ? params.token : undefined;
      const auth = service.authenticate(requestHeaders(request), mobileLinkToken);
      if (matchedRoute.permission) {
        service.ensurePermission(auth, matchedRoute.permission);
      }
      if (matchedRoute.module) {
        service.ensureModuleEnabled(auth, matchedRoute.module);
      }
      const body = await parseJsonBody(request);
      const result = await matchedRoute.handler({
        request,
        response,
        auth,
        params,
        query: url.searchParams,
        body
      });

      sendJson(response, 200, { data: result });
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(response, error.statusCode, {
          error: {
            message: error.message,
            details: error.details
          }
        });
        return;
      }

      sendJson(response, 500, {
        error: {
          message: "Unexpected server error"
        }
      });
    }
  });
