import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { seededPatients } from "./seed.js";
import {
  accessNextActions,
  detectLeakage,
  draft,
  explainIdentityMatch,
  extractIntent,
  followUpLeakage,
  nextBestActions,
  prioritize,
  summarize
} from "./mock-intelligence.js";
import type {
  ApiError,
  DraftRequest,
  AccessNextActionRequest,
  ExplainIdentityMatchRequest,
  ExtractIntentRequest,
  FollowUpLeakageRequest,
  LeakageRequest,
  NextBestActionRequest,
  PrioritizeRequest,
  SummarizeRequest
} from "./types.js";

const serviceName = "datacentriq-gateway";
const port = Number(process.env.PORT ?? 4305);
const host = process.env.HOST ?? "127.0.0.1";
const serviceApiKey = process.env.SERVICE_API_KEY;
const authMode = serviceApiKey ? "service-api-key" : "demo";

if (process.env.NODE_ENV === "production" && !serviceApiKey) {
  throw new Error("SERVICE_API_KEY is required when NODE_ENV=production.");
}

const capabilities = {
  copilot: [
    "summarization",
    "patient-message-drafting",
    "intent-extraction",
    "identity-match-explanation",
    "decision-traces",
    "source-attribution",
    "fallback-behavior"
  ],
  controlTower: [
    "patient-prioritization",
    "leakage-detection",
    "access-next-actions",
    "follow-up-leakage-detection",
    "next-best-action-recommendations",
    "confidence-scoring",
    "decision-traces",
    "source-attribution"
  ],
  mode: "mock",
  networkCalls: false
};

const routes: Record<string, (body: unknown) => unknown> = {
  "POST /v1/copilot/summarize": (body) => summarize(requirePatientBody<SummarizeRequest>(body)),
  "POST /v1/copilot/draft": (body) => draft(requirePatientBody<DraftRequest>(body)),
  "POST /v1/copilot/extract-intent": (body) => extractIntent(requireTextBody<ExtractIntentRequest>(body)),
  "POST /v1/copilot/explain-identity-match": (body) => explainIdentityMatch(requireBody<ExplainIdentityMatchRequest>(body, ["requester", "candidates"])),
  "POST /v1/control-tower/prioritize": (body) => prioritize(requireItemsBody<PrioritizeRequest>(body)),
  "POST /v1/control-tower/detect-leakage": (body) => detectLeakage(requireItemsBody<LeakageRequest>(body)),
  "POST /v1/control-tower/next-best-actions": (body) => nextBestActions(requirePatientBody<NextBestActionRequest>(body)),
  "POST /v1/control-tower/access-next-actions": (body) => accessNextActions(requirePatientBody<AccessNextActionRequest>(body)),
  "POST /v1/control-tower/follow-up-leakage": (body) => followUpLeakage(requirePatientBody<FollowUpLeakageRequest>(body))
};

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    writeJson(res, statusCode, toApiError(error));
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    service: serviceName,
    status: "listening",
    host,
    port,
    capabilities
  }, null, 2));
});

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = normalizePath(url.pathname);

  if (method === "GET" && path === "/health") {
    writeJson(res, 200, {
      service: serviceName,
      status: "ok",
      mode: "mock",
      authMode,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return;
  }

  requireServiceAuth(req);

  if (method === "GET" && path === "/v1/capabilities") {
    writeJson(res, 200, {
      service: serviceName,
      capabilities
    });
    return;
  }

  if (method === "GET" && path === "/v1/mock/seed-patients") {
    writeJson(res, 200, {
      service: serviceName,
      count: seededPatients.length,
      patients: seededPatients
    });
    return;
  }

  const route = routes[`${method} ${path}`];
  if (!route) {
    throw new HttpError(404, "not_found", `Route ${method} ${path} is not supported.`);
  }

  const body = await readJson(req);
  const result = withTraceContext(route(body), body);
  writeJson(res, 200, result);
}

function requireServiceAuth(req: IncomingMessage): void {
  if (!serviceApiKey) {
    return;
  }

  if (req.headers["x-service-api-key"] !== serviceApiKey) {
    throw new HttpError(401, "unauthorized", "Missing or invalid x-service-api-key header.");
  }
}

function withTraceContext(result: unknown, body: unknown): unknown {
  if (!isObject(result) || !isObject(result.decisionTrace) || !isObject(body)) {
    return result;
  }

  const tenantId = typeof body.tenantId === "string" && body.tenantId.trim() ? body.tenantId : undefined;
  const requestActor = typeof body.requestActor === "string" && body.requestActor.trim() ? body.requestActor : undefined;

  if (!tenantId && !requestActor) {
    return result;
  }

  return {
    ...result,
    decisionTrace: {
      ...result.decisionTrace,
      ...(tenantId ? { tenantId } : {}),
      ...(requestActor ? { requestActor } : {})
    }
  };
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function writeJson(res: ServerResponse, statusCode: number, value: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${JSON.stringify(value, null, 2)}\n`);
}

function requireBody<T>(body: unknown, requiredFields: string[]): T {
  if (!isObject(body)) {
    throw new HttpError(400, "invalid_body", "Request body must be a JSON object.");
  }

  for (const field of requiredFields) {
    if (!(field in body)) {
      throw new HttpError(400, "missing_field", `Missing required field: ${field}`);
    }
  }

  return body as T;
}

function requirePatientBody<T>(body: unknown): T {
  const value = requireBody<Record<string, unknown>>(body, ["patient"]);
  if (!isObject(value.patient)) {
    throw new HttpError(400, "invalid_patient", "Field patient must be a JSON object.");
  }

  return value as T;
}

function requireItemsBody<T>(body: unknown): T {
  const value = requireBody<Record<string, unknown>>(body, ["items"]);
  if (!Array.isArray(value.items)) {
    throw new HttpError(400, "invalid_items", "Field items must be an array.");
  }

  return value as T;
}

function requireTextBody<T>(body: unknown): T {
  const value = requireBody<Record<string, unknown>>(body, ["text"]);
  if (typeof value.text !== "string") {
    throw new HttpError(400, "invalid_text", "Field text must be a string.");
  }

  return value as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof HttpError) {
    return {
      error: {
        code: error.code,
        message: error.message
      }
    };
  }

  return {
    error: {
      code: "internal_error",
      message: error instanceof Error ? error.message : "Unexpected server error."
    }
  };
}

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}
