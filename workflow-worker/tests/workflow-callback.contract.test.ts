import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { after, before, describe, it } from "node:test";

type JsonObject = Record<string, unknown>;

const serviceKey = "workflow_contract_key";

describe("workflow-worker service contract", () => {
  let coreServer: Server;
  let coreUrl: string;
  let worker: ChildProcessWithoutNullStreams;
  let workerUrl: string;
  const callbacks: Array<{ headers: JsonObject; body: JsonObject }> = [];

  before(async () => {
    coreServer = createServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/service-events/workflow-callback") {
        const body = await readJson(request);
        callbacks.push({ headers: request.headers as JsonObject, body });
        response.writeHead(request.headers["x-service-api-key"] === serviceKey ? 200 : 403, {
          "content-type": "application/json"
        });
        response.end(JSON.stringify({ data: { accepted: true } }));
        return;
      }
      response.writeHead(404).end();
    });
    coreUrl = await listen(coreServer);

    const port = randomPort();
    workerUrl = `http://127.0.0.1:${port}`;
    worker = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        SERVICE_API_KEY: serviceKey,
        CORE_API_URL: coreUrl
      }
    });
    worker.stdout.resume();
    worker.stderr.resume();
    await waitForHealth(`${workerUrl}/health`);
  });

  after(async () => {
    worker.kill();
    await close(coreServer);
  });

  it("keeps health open and protects non-health routes", async () => {
    const health = await fetch(`${workerUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(((await health.json()) as JsonObject).service, "workflow-worker");

    const unauthorized = await fetch(`${workerUrl}/workflows`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${workerUrl}/workflows`, {
      headers: { "x-service-api-key": serviceKey }
    });
    assert.equal(authorized.status, 200);
    const body = (await authorized.json()) as JsonObject;
    assert.ok(Array.isArray(body.workflows));
  });

  it("starts a workflow run and delivers callback to core-api", async () => {
    const response = await fetch(`${workerUrl}/workflows/post-visit-follow-up/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        patientId: "patient_demo_001",
        trigger: "contract.workflow_start",
        context: {
          followUpId: "followup_demo_001"
        }
      })
    });
    const body = (await response.json()) as JsonObject;
    const run = body.run as JsonObject;
    const callback = body.callback as JsonObject;

    assert.equal(response.status, 202);
    assert.equal(run.type, "post-visit-follow-up");
    assert.equal(run.patientId, "patient_demo_001");
    assert.equal(callback.status, "delivered");
    assert.equal(callback.statusCode, 200);
    assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].headers["x-service-api-key"], serviceKey);
    assert.equal(callbacks[0].body.workflowType, "post-visit-follow-up");
    assert.equal(callbacks[0].body.patientId, "patient_demo_001");
    assert.equal(callbacks[0].body.status, "running");
    assert.ok(callbacks[0].body.context);
    assert.ok(typeof callbacks[0].body.runId === "string");
    assert.ok(Array.isArray(callbacks[0].body.emittedEvents));
  });

  it("pauses and resumes workflow runs with callback state", async () => {
    const startResponse = await fetch(`${workerUrl}/workflows/pending-diagnostics-reminder/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        patientId: "patient_demo_002",
        trigger: "diagnostic.advised"
      })
    });
    const startBody = (await startResponse.json()) as JsonObject;
    const run = startBody.run as JsonObject;

    const pauseResponse = await fetch(`${workerUrl}/runs/${run.id}/pause`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({ reason: "Patient requested callback next week", actor: "care-coordinator" })
    });
    const pauseBody = (await pauseResponse.json()) as JsonObject;

    const resumeResponse = await fetch(`${workerUrl}/runs/${run.id}/resume`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({ reason: "Patient available again", actor: "care-coordinator" })
    });
    const resumeBody = (await resumeResponse.json()) as JsonObject;

    assert.equal(pauseResponse.status, 200);
    assert.equal((pauseBody.run as JsonObject).status, "paused");
    assert.equal((pauseBody.callback as JsonObject).status, "delivered");
    assert.equal(resumeResponse.status, 200);
    assert.equal((resumeBody.run as JsonObject).status, "running");
    assert.ok(Array.isArray((resumeBody.run as JsonObject).timeline));
  });

  it("rejects unsupported workflow types with accepted type list", async () => {
    const response = await fetch(`${workerUrl}/workflows/not-real/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({})
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 400);
    assert.equal(body.error, "invalid_workflow_type");
    assert.ok(Array.isArray(body.acceptedTypes));
  });
});

async function readJson(request: NodeJS.ReadableStream): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as JsonObject;
}

function randomPort() {
  return 48000 + Math.floor(Math.random() * 1000);
}

async function waitForHealth(url: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry while service starts
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
