import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

type AdapterType = "whatsapp" | "telephony" | "his-emr" | "lis-ris" | "payments";

type NormalizedEventType =
  | "patient.message.received"
  | "patient.missed_call.received"
  | "access.request.received"
  | "mobile_link.delivery.updated"
  | "appointment.synced"
  | "diagnostic.report.received"
  | "payment.event.received";

type PatientHint = {
  phone?: string;
  name?: string;
  externalPatientId?: string;
  uhid?: string;
};

type NormalizedIntegrationEvent = {
  id: string;
  adapter: AdapterType;
  eventType: NormalizedEventType;
  occurredAt: string;
  receivedAt: string;
  tenantId: string;
  sourceEventId: string;
  idempotencyKey: string;
  patientHint: PatientHint;
  subject: string;
  summary: string;
  sourceMetadata: Record<string, unknown>;
  suggestedDomainEvents: string[];
  rawPayload: Record<string, unknown>;
};

type AdapterDefinition = {
  adapter: AdapterType;
  endpoint: string;
  description: string;
  emits: NormalizedEventType;
};

const port = Number(process.env.PORT ?? "4105");
const host = process.env.HOST ?? "127.0.0.1";
const serviceApiKey = process.env.SERVICE_API_KEY;
const coreApiUrl = process.env.CORE_API_URL?.replace(/\/+$/, "");
const authMode = serviceApiKey ? "service-api-key" : "demo";
const events: NormalizedIntegrationEvent[] = [];

if (process.env.NODE_ENV === "production" && !serviceApiKey) {
  throw new Error("SERVICE_API_KEY is required when NODE_ENV=production.");
}

const adapters: AdapterDefinition[] = [
  {
    adapter: "whatsapp",
    endpoint: "POST /webhooks/whatsapp",
    description: "Normalizes inbound WhatsApp text, media, template replies, and patient intent signals.",
    emits: "patient.message.received"
  },
  {
    adapter: "telephony",
    endpoint: "POST /webhooks/telephony/missed-call",
    description: "Normalizes missed calls so patient access teams can recover demand quickly.",
    emits: "patient.missed_call.received"
  },
  {
    adapter: "payments",
    endpoint: "POST /webhooks/payments/event",
    description: "Normalizes payment link, UPI, refund, and failed payment events.",
    emits: "payment.event.received"
  }
];

function nowIso(): string {
  return new Date().toISOString();
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildPatientHint(body: Record<string, unknown>): PatientHint {
  return {
    phone: getString(body.phone || body.from || body.callerNumber || body.mobile),
    name: getString(body.patientName || body.name),
    externalPatientId: getString(body.patientId || body.externalPatientId),
    uhid: getString(body.uhid)
  };
}

function sourceEventId(body: Record<string, unknown>, prefix: AdapterType): string {
  return getString(body.eventId || body.messageId || body.callId || body.appointmentId || body.reportId || body.paymentId, `${prefix}-${randomUUID()}`);
}

function idempotencyKey(adapter: AdapterType, eventType: NormalizedEventType, body: Record<string, unknown>): string {
  return getString(body.idempotencyKey, `${tenantId(body)}:${adapter}:${eventType}:${sourceEventId(body, adapter)}`);
}

function tenantId(body: Record<string, unknown>): string {
  return getString(body.tenantId, "tenant-demo-001");
}

function occurredAt(body: Record<string, unknown>): string {
  return getString(body.occurredAt || body.timestamp || body.createdAt, nowIso());
}

function normalizeWhatsApp(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const messageText = getString(body.text || body.message || body.caption, "Inbound WhatsApp interaction");
  const mediaType = getString(body.mediaType);
  const eventType: NormalizedEventType = "patient.message.received";

  return {
    id: randomUUID(),
    adapter: "whatsapp",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "whatsapp"),
    idempotencyKey: idempotencyKey("whatsapp", eventType, body),
    patientHint: buildPatientHint(body),
    subject: "Inbound WhatsApp message",
    summary: mediaType ? `Patient sent ${mediaType}: ${messageText}` : `Patient said: ${messageText}`,
    sourceMetadata: {
      channel: "whatsapp",
      messageType: mediaType || "text",
      direction: "inbound",
      campaignId: getString(body.campaignId),
      templateName: getString(body.templateName),
      language: getString(body.language)
    },
    suggestedDomainEvents: [
      "interaction.created",
      "inbox.thread.upserted",
      "patient.identity_match.requested",
      "ai.intent_extraction.requested"
    ],
    rawPayload: body
  };
}

function normalizeMissedCall(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const branch = getString(body.branch || body.location, "unknown branch");
  const eventType: NormalizedEventType = "patient.missed_call.received";

  return {
    id: randomUUID(),
    adapter: "telephony",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "telephony"),
    idempotencyKey: idempotencyKey("telephony", eventType, body),
    patientHint: buildPatientHint(body),
    subject: "Missed patient call",
    summary: `Missed call for ${branch}; create recovery callback task.`,
    sourceMetadata: {
      channel: "telephony",
      branch,
      callDirection: "inbound",
      agentId: getString(body.agentId),
      ringDurationSeconds: getNumber(body.ringDurationSeconds, 0)
    },
    suggestedDomainEvents: [
      "interaction.created",
      "inbox.thread.upserted",
      "task.callback.created",
      "workflow.sla_timer.requested"
    ],
    rawPayload: body
  };
}

function normalizeAccessRequest(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const eventType: NormalizedEventType = "access.request.received";
  const specialty = getString(body.specialty || body.department, "requested specialty");
  const preferredDoctor = getString(body.doctorName || body.preferredDoctor);
  const preferredBranch = getString(body.branch || body.preferredBranch, "preferred branch not set");

  return {
    id: randomUUID(),
    adapter: "whatsapp",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "whatsapp"),
    idempotencyKey: idempotencyKey("whatsapp", eventType, body),
    patientHint: buildPatientHint(body),
    subject: "Patient access request",
    summary: `Patient requested ${specialty}${preferredDoctor ? ` with ${preferredDoctor}` : ""} at ${preferredBranch}.`,
    sourceMetadata: {
      channel: getString(body.channel, "whatsapp"),
      specialty,
      preferredDoctor,
      preferredBranch,
      preferredDate: getString(body.preferredDate),
      sourceThreadId: getString(body.threadId)
    },
    suggestedDomainEvents: [
      "access_request.created",
      "patient.identity_match.requested",
      "ai.access_next_action.requested"
    ],
    rawPayload: body
  };
}

function normalizeMobileLinkDelivery(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const eventType: NormalizedEventType = "mobile_link.delivery.updated";
  const status = getString(body.status, "sent");

  return {
    id: randomUUID(),
    adapter: "whatsapp",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "whatsapp"),
    idempotencyKey: idempotencyKey("whatsapp", eventType, body),
    patientHint: buildPatientHint(body),
    subject: `Mobile link ${status}`,
    summary: `Mobile link delivery status is ${status}.`,
    sourceMetadata: {
      channel: getString(body.channel, "whatsapp"),
      status,
      token: getString(body.token),
      appointmentId: getString(body.appointmentId),
      journeyId: getString(body.journeyId)
    },
    suggestedDomainEvents: [
      "mobile_link.delivery_recorded",
      status === "failed" ? "task.mobile_link_recovery.created" : "patient.timeline.updated"
    ],
    rawPayload: body
  };
}

function normalizeAppointmentSync(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const status = getString(body.status, "booked");
  const doctorName = getString(body.doctorName || body.providerName, "assigned doctor");
  const appointmentAt = getString(body.appointmentAt || body.scheduledAt, "unknown appointment time");
  const eventType: NormalizedEventType = "appointment.synced";

  return {
    id: randomUUID(),
    adapter: "his-emr",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "his-emr"),
    idempotencyKey: idempotencyKey("his-emr", eventType, body),
    patientHint: buildPatientHint(body),
    subject: `Appointment ${status}`,
    summary: `Appointment is ${status} with ${doctorName} at ${appointmentAt}.`,
    sourceMetadata: {
      status,
      doctorName,
      appointmentAt,
      branch: getString(body.branch)
    },
    suggestedDomainEvents: [
      "appointment.upserted",
      status === "no_show" ? "workflow.no_show_recovery.requested" : "workflow.appointment_reminder.requested"
    ],
    rawPayload: body
  };
}

function normalizeReportReceived(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const reportType = getString(body.reportType || body.testName || body.modality, "diagnostic report");
  const abnormalFlag = Boolean(body.abnormalFlag || body.isAbnormal);
  const eventType: NormalizedEventType = "diagnostic.report.received";

  return {
    id: randomUUID(),
    adapter: "lis-ris",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "lis-ris"),
    idempotencyKey: idempotencyKey("lis-ris", eventType, body),
    patientHint: buildPatientHint(body),
    subject: abnormalFlag ? "Abnormal diagnostic report received" : "Diagnostic report received",
    summary: abnormalFlag
      ? `${reportType} report received with abnormal flag; route for clinical review.`
      : `${reportType} report received; attach to patient timeline and follow-up journey.`,
    sourceMetadata: {
      reportType,
      abnormalFlag,
      reportUrl: getString(body.reportUrl),
      orderingDoctor: getString(body.orderingDoctor)
    },
    suggestedDomainEvents: [
      "diagnostic.report.attached",
      abnormalFlag ? "task.clinical_review.created" : "workflow.pending_diagnostics_completed"
    ],
    rawPayload: body
  };
}

function normalizePaymentEvent(body: Record<string, unknown>): NormalizedIntegrationEvent {
  const status = getString(body.status, "received");
  const amount = getNumber(body.amount, 0);
  const currency = getString(body.currency, "INR");
  const eventType: NormalizedEventType = "payment.event.received";

  return {
    id: randomUUID(),
    adapter: "payments",
    eventType,
    occurredAt: occurredAt(body),
    receivedAt: nowIso(),
    tenantId: tenantId(body),
    sourceEventId: sourceEventId(body, "payments"),
    idempotencyKey: idempotencyKey("payments", eventType, body),
    patientHint: buildPatientHint(body),
    subject: `Payment ${status}`,
    summary: `Payment event ${status} for ${currency} ${amount}.`,
    sourceMetadata: {
      status,
      amount,
      currency,
      appointmentId: getString(body.appointmentId),
      paymentLinkId: getString(body.paymentLinkId)
    },
    suggestedDomainEvents: [
      "payment.upserted",
      status === "failed" ? "task.payment_recovery.created" : "patient.timeline.updated"
    ],
    rawPayload: body
  };
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function recordEvent(event: NormalizedIntegrationEvent): NormalizedIntegrationEvent {
  const duplicate = events.find((item) => item.idempotencyKey === event.idempotencyKey);
  if (duplicate) {
    return duplicate;
  }

  events.unshift(event);
  console.log(
    JSON.stringify(
      {
        service: "integration-gateway",
        normalizedEvent: {
          id: event.id,
          adapter: event.adapter,
          eventType: event.eventType,
          subject: event.subject,
          suggestedDomainEvents: event.suggestedDomainEvents
        }
      },
      null,
      2
    )
  );
  return event;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-service-api-key"
  });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, {
    error: "not_found",
    message: "No integration-gateway route matched this request."
  });
}

function sendDeferred(res: ServerResponse, adapter: "his-emr" | "lis-ris"): void {
  sendJson(res, 501, {
    error: "adapter_deferred",
    adapter,
    message: "This adapter is intentionally deferred. HealthcareOS is communications-first for the current pilot scope."
  });
}

async function handleWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  normalizer: (body: Record<string, unknown>) => NormalizedIntegrationEvent
): Promise<void> {
  const body = await readJson(req);
  const event = recordEvent(normalizer(body));
  const forwarding = await forwardEvent(event);

  sendJson(res, 202, {
    service: "integration-gateway",
    message: "Webhook accepted and normalized.",
    event,
    forwarding
  });
}

function requireServiceAuth(req: IncomingMessage): boolean {
  if (!serviceApiKey) {
    return true;
  }

  return req.headers["x-service-api-key"] === serviceApiKey;
}

async function forwardEvent(event: NormalizedIntegrationEvent): Promise<Record<string, unknown>> {
  if (!coreApiUrl) {
    return {
      status: "stored_locally",
      reason: "CORE_API_URL is not configured."
    };
  }

  try {
    const response = await fetch(`${coreApiUrl}/service-events/integration`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(serviceApiKey ? { "x-service-api-key": serviceApiKey } : {})
      },
      body: JSON.stringify(event)
    });

    return {
      status: response.ok ? "forwarded" : "failed",
      statusCode: response.status
    };
  } catch (error) {
    return {
      status: "stored_locally",
      reason: error instanceof Error ? error.message : "Unknown forwarding error."
    };
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      service: "integration-gateway",
      status: "ready",
      authMode,
      host,
      port,
      uptimeSeconds: Math.round(process.uptime()),
      adapterCount: adapters.length,
      eventCount: events.length,
      coreApiForwardingConfigured: Boolean(coreApiUrl)
    });
    return;
  }

  if (!requireServiceAuth(req)) {
    sendJson(res, 401, {
      error: "unauthorized",
      message: "Missing or invalid x-service-api-key header."
    });
    return;
  }

  if (method === "GET" && url.pathname === "/adapters") {
    sendJson(res, 200, {
      service: "integration-gateway",
      adapters
    });
    return;
  }

  if (method === "GET" && url.pathname === "/events") {
    sendJson(res, 200, {
      service: "integration-gateway",
      events
    });
    return;
  }

  if (method === "GET" && url.pathname.startsWith("/events/")) {
    const eventId = url.pathname.split("/")[2];
    const event = events.find((item) => item.id === eventId);

    if (!event) {
      sendJson(res, 404, { error: "event_not_found", eventId });
      return;
    }

    sendJson(res, 200, { service: "integration-gateway", event });
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/whatsapp") {
    await handleWebhook(req, res, normalizeWhatsApp);
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/whatsapp/access-request") {
    await handleWebhook(req, res, normalizeAccessRequest);
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/whatsapp/mobile-link-delivery") {
    await handleWebhook(req, res, normalizeMobileLinkDelivery);
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/telephony/missed-call") {
    await handleWebhook(req, res, normalizeMissedCall);
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/his-emr/appointment-sync") {
    sendDeferred(res, "his-emr");
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/lis-ris/report-received") {
    sendDeferred(res, "lis-ris");
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/payments/event") {
    await handleWebhook(req, res, normalizePaymentEvent);
    return;
  }

  sendNotFound(res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error: unknown) => {
    sendJson(res, 500, {
      error: "integration_gateway_error",
      message: error instanceof Error ? error.message : "Unknown integration-gateway error."
    });
  });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify(
      {
        service: "integration-gateway",
        status: "listening",
        host,
        port,
        authMode,
        coreApiForwardingConfigured: Boolean(coreApiUrl),
        endpoints: [
          "GET /health",
          "GET /adapters",
          "GET /events",
          "GET /events/:id",
          "POST /webhooks/whatsapp",
          "POST /webhooks/whatsapp/access-request",
          "POST /webhooks/whatsapp/mobile-link-delivery",
          "POST /webhooks/telephony/missed-call",
          "POST /webhooks/payments/event"
        ],
        adapters: adapters.map((adapter) => adapter.adapter)
      },
      null,
      2
    )
  );
});
