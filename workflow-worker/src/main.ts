import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

type WorkflowType =
  | "appointment-reminder"
  | "no-show-recovery"
  | "post-visit-follow-up"
  | "pending-diagnostics-reminder"
  | "sla-timer";

type WorkflowStatus = "scheduled" | "running" | "waiting" | "paused" | "completed" | "escalated" | "cancelled";

type WorkflowStep = {
  name: string;
  status: WorkflowStatus;
  detail: string;
  scheduledFor?: string;
};

type WorkflowRun = {
  id: string;
  type: WorkflowType;
  patientId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  status: WorkflowStatus;
  trigger: string;
  context: Record<string, unknown>;
  steps: WorkflowStep[];
  emittedEvents: string[];
  timeline: WorkflowTimelineEvent[];
  pauseReason?: string;
  outcome?: string;
};

type WorkflowTimelineEvent = {
  id: string;
  at: string;
  type: string;
  summary: string;
  actor: string;
};

type WorkflowDefinition = {
  type: WorkflowType;
  description: string;
  acceptedTriggers: string[];
  defaultContext: Record<string, unknown>;
};

const port = Number(process.env.PORT ?? "4104");
const host = process.env.HOST ?? "127.0.0.1";
const serviceApiKey = process.env.SERVICE_API_KEY;
const coreApiUrl = process.env.CORE_API_URL?.replace(/\/+$/, "");
const authMode = serviceApiKey ? "service-api-key" : "demo";
const runs: WorkflowRun[] = [];

if (process.env.NODE_ENV === "production" && !serviceApiKey) {
  throw new Error("SERVICE_API_KEY is required when NODE_ENV=production.");
}

const workflowDefinitions: WorkflowDefinition[] = [
  {
    type: "appointment-reminder",
    description: "Schedules reminder nudges before an appointment and records confirmation state.",
    acceptedTriggers: ["appointment.booked", "appointment.rescheduled"],
    defaultContext: {
      appointmentId: "apt-demo-001",
      appointmentAt: "2026-06-12T10:30:00.000Z",
      channel: "whatsapp",
      preferredLanguage: "hi-IN"
    }
  },
  {
    type: "no-show-recovery",
    description: "Starts recovery outreach when a patient misses a booked appointment.",
    acceptedTriggers: ["appointment.no_show"],
    defaultContext: {
      appointmentId: "apt-demo-002",
      missedAt: "2026-06-11T05:30:00.000Z",
      recoveryWindowHours: 24
    }
  },
  {
    type: "post-visit-follow-up",
    description: "Creates follow-up tasks, patient instructions, and escalation checks after a visit.",
    acceptedTriggers: ["visit.completed"],
    defaultContext: {
      visitId: "visit-demo-001",
      doctorId: "doc-demo-001",
      followUpDueAt: "2026-06-18T04:30:00.000Z"
    }
  },
  {
    type: "pending-diagnostics-reminder",
    description: "Tracks advised diagnostics and nudges patients until completion or escalation.",
    acceptedTriggers: ["diagnostic.advised", "diagnostic.overdue"],
    defaultContext: {
      orderId: "lab-demo-001",
      testName: "HbA1c",
      dueAt: "2026-06-14T04:30:00.000Z"
    }
  },
  {
    type: "sla-timer",
    description: "Monitors operational SLAs for staff tasks, callbacks, escalations, and approvals.",
    acceptedTriggers: ["task.created", "task.escalated", "message.unanswered"],
    defaultContext: {
      taskId: "task-demo-001",
      ownerRole: "care_coordinator",
      slaMinutes: 30
    }
  }
];

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function definitionFor(type: WorkflowType): WorkflowDefinition {
  const definition = workflowDefinitions.find((item) => item.type === type);

  if (!definition) {
    throw new Error(`Unknown workflow type: ${type}`);
  }

  return definition;
}

function isWorkflowType(value: string): value is WorkflowType {
  return workflowDefinitions.some((definition) => definition.type === value);
}

function buildSteps(type: WorkflowType, startedAt: Date): WorkflowStep[] {
  switch (type) {
    case "appointment-reminder":
      return [
        {
          name: "send_first_reminder",
          status: "scheduled",
          detail: "Send WhatsApp reminder 24 hours before appointment.",
          scheduledFor: addMinutes(startedAt, 1)
        },
        {
          name: "check_patient_confirmation",
          status: "waiting",
          detail: "Wait for patient confirmation, reschedule request, or no response.",
          scheduledFor: addMinutes(startedAt, 2)
        },
        {
          name: "send_same_day_reminder",
          status: "scheduled",
          detail: "Send same-day reminder with branch location and queue instructions.",
          scheduledFor: addMinutes(startedAt, 3)
        }
      ];
    case "no-show-recovery":
      return [
        {
          name: "create_recovery_task",
          status: "running",
          detail: "Create a same-day callback task for front desk or call center."
        },
        {
          name: "draft_reschedule_message",
          status: "scheduled",
          detail: "Ask DatacentrIQ Copilot for a polite reschedule message draft.",
          scheduledFor: addMinutes(startedAt, 1)
        },
        {
          name: "escalate_if_high_value",
          status: "waiting",
          detail: "Escalate when patient has active treatment plan or procedure interest.",
          scheduledFor: addMinutes(startedAt, 30)
        }
      ];
    case "post-visit-follow-up":
      return [
        {
          name: "generate_follow_up_plan",
          status: "running",
          detail: "Create post-visit journey from doctor notes, diagnosis tags, and due date."
        },
        {
          name: "send_patient_instructions",
          status: "scheduled",
          detail: "Send approved patient-friendly care instructions in preferred language.",
          scheduledFor: addMinutes(startedAt, 5)
        },
        {
          name: "schedule_follow_up_task",
          status: "scheduled",
          detail: "Create staff task before the recommended follow-up date.",
          scheduledFor: addMinutes(startedAt, 10)
        }
      ];
    case "pending-diagnostics-reminder":
      return [
        {
          name: "detect_pending_order",
          status: "running",
          detail: "Detect advised diagnostic order without completed report."
        },
        {
          name: "send_test_completion_reminder",
          status: "scheduled",
          detail: "Send reminder with test name, branch details, and collection instructions.",
          scheduledFor: addMinutes(startedAt, 15)
        },
        {
          name: "escalate_abnormal_or_overdue",
          status: "waiting",
          detail: "Escalate if test remains overdue or abnormal report requires review.",
          scheduledFor: addMinutes(startedAt, 60)
        }
      ];
    case "sla-timer":
      return [
        {
          name: "start_sla_clock",
          status: "running",
          detail: "Start SLA timer for task ownership and first response."
        },
        {
          name: "warn_before_breach",
          status: "scheduled",
          detail: "Notify owner before SLA breach.",
          scheduledFor: addMinutes(startedAt, 20)
        },
        {
          name: "escalate_after_breach",
          status: "scheduled",
          detail: "Escalate to supervisor if task is still open after SLA.",
          scheduledFor: addMinutes(startedAt, 30)
        }
      ];
  }
}

function createWorkflowRun(
  type: WorkflowType,
  input: Partial<Pick<WorkflowRun, "patientId" | "tenantId" | "trigger" | "context">> = {}
): WorkflowRun {
  const definition = definitionFor(type);
  const createdAt = new Date();
  const trigger = input.trigger ?? definition.acceptedTriggers[0] ?? "manual.start";
  const context = {
    ...definition.defaultContext,
    ...(input.context ?? {})
  };

  const run: WorkflowRun = {
    id: randomUUID(),
    type,
    patientId: input.patientId ?? "patient-demo-001",
    tenantId: input.tenantId ?? "tenant-demo-001",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    status: "running",
    trigger,
    context,
    steps: buildSteps(type, createdAt),
    emittedEvents: [
      `workflow.${type}.started`,
      `workflow.${type}.steps_scheduled`
    ],
    timeline: [
      {
        id: randomUUID(),
        at: createdAt.toISOString(),
        type: "workflow.started",
        summary: `${type} workflow started from ${trigger}.`,
        actor: "workflow-worker"
      }
    ]
  };

  runs.unshift(run);
  return run;
}

function appendRunEvent(run: WorkflowRun, type: string, summary: string, actor = "workflow-worker"): WorkflowRun {
  const at = nowIso();
  run.updatedAt = at;
  run.timeline.unshift({
    id: randomUUID(),
    at,
    type,
    summary,
    actor
  });
  run.emittedEvents.unshift(type);
  return run;
}

function transitionRun(run: WorkflowRun, status: WorkflowStatus, input: Record<string, unknown> = {}): WorkflowRun {
  const reason = getString(input.reason, "");
  const outcome = getString(input.outcome, "");

  run.status = status;
  if (status === "paused") {
    run.pauseReason = reason || "Paused by staff.";
    run.steps = run.steps.map((step) =>
      step.status === "scheduled" || step.status === "waiting"
        ? { ...step, status: "paused", detail: `${step.detail} Paused until workflow resumes.` }
        : step
    );
  }

  if (status === "running" && run.pauseReason) {
    delete run.pauseReason;
    run.steps = run.steps.map((step) =>
      step.status === "paused"
        ? { ...step, status: "scheduled", detail: step.detail.replace(" Paused until workflow resumes.", "") }
        : step
    );
  }

  if (status === "completed" || status === "cancelled") {
    run.outcome = outcome || reason || status;
    run.steps = run.steps.map((step) =>
      step.status === "scheduled" || step.status === "waiting" || step.status === "running" || step.status === "paused"
        ? { ...step, status: "completed" }
        : step
    );
  }

  return appendRunEvent(
    run,
    `workflow.${run.type}.${status}`,
    reason || outcome || `${run.type} workflow moved to ${status}.`,
    getString(input.actor, "staff")
  );
}

function seedDemoRuns(): void {
  for (const definition of workflowDefinitions) {
    createWorkflowRun(definition.type, {
      patientId: `patient-demo-${workflowDefinitions.indexOf(definition) + 1}`,
      trigger: definition.acceptedTriggers[0]
    });
  }
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
    message: "No workflow-worker route matched this request."
  });
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function requireServiceAuth(req: IncomingMessage): boolean {
  if (!serviceApiKey) {
    return true;
  }

  return req.headers["x-service-api-key"] === serviceApiKey;
}

async function postWorkflowCallback(run: WorkflowRun): Promise<Record<string, unknown>> {
  if (!coreApiUrl) {
    return {
      status: "skipped",
      reason: "CORE_API_URL is not configured."
    };
  }

  const payload = {
    tenantId: run.tenantId,
    patientId: run.patientId,
    workflowType: run.type,
    runId: run.id,
    status: run.status,
    context: run.context,
    timeline: run.timeline.slice(0, 5),
    emittedEvents: run.emittedEvents
  };

  try {
    const response = await fetch(`${coreApiUrl}/service-events/workflow-callback`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(serviceApiKey ? { "x-service-api-key": serviceApiKey } : {})
      },
      body: JSON.stringify(payload)
    });

    return {
      status: response.ok ? "delivered" : "failed",
      statusCode: response.status
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown callback error."
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
      service: "workflow-worker",
      status: "ready",
      authMode,
      host,
      port,
      uptimeSeconds: Math.round(process.uptime()),
      workflowCount: workflowDefinitions.length,
      runCount: runs.length,
      coreApiCallbackConfigured: Boolean(coreApiUrl)
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

  if (method === "GET" && url.pathname === "/workflows") {
    sendJson(res, 200, {
      service: "workflow-worker",
      workflows: workflowDefinitions
    });
    return;
  }

  if (method === "GET" && url.pathname === "/runs") {
    sendJson(res, 200, {
      service: "workflow-worker",
      runs
    });
    return;
  }

  if (method === "GET" && url.pathname.startsWith("/runs/")) {
    const runId = url.pathname.split("/")[2];
    const run = runs.find((item) => item.id === runId);
    if (!run) {
      sendJson(res, 404, { error: "run_not_found", runId });
      return;
    }

    sendJson(res, 200, { service: "workflow-worker", run });
    return;
  }

  if (method === "POST" && url.pathname.startsWith("/runs/")) {
    const [, , runId, action] = url.pathname.split("/");
    const run = runs.find((item) => item.id === runId);
    if (!run) {
      sendJson(res, 404, { error: "run_not_found", runId });
      return;
    }

    const supportedActions = ["pause", "resume", "complete", "cancel", "escalate"];
    if (!supportedActions.includes(action ?? "")) {
      sendJson(res, 400, { error: "invalid_run_action", acceptedActions: supportedActions });
      return;
    }

    const body = await readJson(req);
    const nextStatus: WorkflowStatus =
      action === "pause"
        ? "paused"
        : action === "resume"
          ? "running"
          : action === "complete"
            ? "completed"
            : action === "cancel"
              ? "cancelled"
              : "escalated";
    const updatedRun = transitionRun(run, nextStatus, body);
    const callback = await postWorkflowCallback(updatedRun);

    sendJson(res, 200, {
      service: "workflow-worker",
      message: `Workflow run ${action} accepted.`,
      run: updatedRun,
      callback
    });
    return;
  }

  if (method === "POST" && url.pathname === "/simulate/all") {
    const created = workflowDefinitions.map((definition) => createWorkflowRun(definition.type));
    const callbacks = await Promise.all(created.map(postWorkflowCallback));
    sendJson(res, 202, {
      service: "workflow-worker",
      message: "Simulated all MVP workflow families.",
      runs: created,
      callbacks
    });
    return;
  }

  if (method === "POST" && url.pathname.startsWith("/workflows/") && url.pathname.endsWith("/start")) {
    const workflowType = url.pathname.split("/")[2];

    if (!workflowType || !isWorkflowType(workflowType)) {
      sendJson(res, 400, {
        error: "invalid_workflow_type",
        acceptedTypes: workflowDefinitions.map((definition) => definition.type)
      });
      return;
    }

    const body = await readJson(req);
    const run = createWorkflowRun(workflowType, {
      patientId: getString(body.patientId, "patient-demo-001"),
      tenantId: getString(body.tenantId, "tenant-demo-001"),
      trigger: getString(body.trigger, "manual.start"),
      context:
        body.context && typeof body.context === "object" && !Array.isArray(body.context)
          ? (body.context as Record<string, unknown>)
          : {}
    });
    const callback = await postWorkflowCallback(run);

    sendJson(res, 202, {
      service: "workflow-worker",
      message: "Workflow run accepted by simulated durable worker.",
      run,
      callback
    });
    return;
  }

  sendNotFound(res);
}

seedDemoRuns();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error: unknown) => {
    sendJson(res, 500, {
      error: "workflow_worker_error",
      message: error instanceof Error ? error.message : "Unknown workflow-worker error."
    });
  });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify(
      {
        service: "workflow-worker",
        status: "listening",
        host,
        port,
        authMode,
        coreApiCallbackConfigured: Boolean(coreApiUrl),
        endpoints: [
          "GET /health",
          "GET /workflows",
          "GET /runs",
          "GET /runs/:id",
          "POST /runs/:id/pause",
          "POST /runs/:id/resume",
          "POST /runs/:id/complete",
          "POST /runs/:id/cancel",
          "POST /runs/:id/escalate",
          "POST /workflows/:type/start",
          "POST /simulate/all"
        ],
        workflows: workflowDefinitions.map((definition) => definition.type)
      },
      null,
      2
    )
  );
});
