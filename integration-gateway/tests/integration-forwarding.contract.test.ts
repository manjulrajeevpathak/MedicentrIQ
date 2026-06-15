import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { after, before, describe, it } from "node:test";

type JsonObject = Record<string, unknown>;

const serviceKey = "integration_contract_key";

describe("integration-gateway service contract", () => {
  let coreServer: Server;
  let coreUrl: string;
  let gateway: ChildProcessWithoutNullStreams;
  let gatewayUrl: string;
  const capturedEvents: Array<{ headers: JsonObject; body: JsonObject }> = [];

  before(async () => {
    coreServer = createServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/service-events/integration") {
        const body = await readJson(request);
        capturedEvents.push({ headers: request.headers as JsonObject, body });
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
    gatewayUrl = `http://127.0.0.1:${port}`;
    gateway = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        SERVICE_API_KEY: serviceKey,
        CORE_API_URL: coreUrl
      }
    });
    gateway.stdout.resume();
    gateway.stderr.resume();
    await waitForHealth(`${gatewayUrl}/health`);
  });

  after(async () => {
    gateway.kill();
    await close(coreServer);
  });

  it("keeps health open and protects non-health routes", async () => {
    const health = await fetch(`${gatewayUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(((await health.json()) as JsonObject).service, "integration-gateway");

    const unauthorized = await fetch(`${gatewayUrl}/adapters`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${gatewayUrl}/adapters`, {
      headers: { "x-service-api-key": serviceKey }
    });
    assert.equal(authorized.status, 200);
    const body = (await authorized.json()) as JsonObject;
    assert.ok(Array.isArray(body.adapters));
    assert.deepEqual(
      (body.adapters as JsonObject[]).map((adapter) => adapter.adapter).sort(),
      ["payments", "telephony", "whatsapp"]
    );
  });

  it("marks HIS and LIS routes as intentionally deferred", async () => {
    const response = await fetch(`${gatewayUrl}/webhooks/his-emr/appointment-sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({ appointmentId: "deferred-his-test" })
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 501);
    assert.equal(body.error, "adapter_deferred");
    assert.equal(body.adapter, "his-emr");
  });

  it("normalizes WhatsApp webhook payloads and forwards them to core-api", async () => {
    const response = await fetch(`${gatewayUrl}/webhooks/whatsapp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        messageId: "wa-contract-001",
        from: "+919900000001",
        text: "Need to confirm my appointment"
      })
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 202);
    assert.equal((body.event as JsonObject).adapter, "whatsapp");
    assert.equal((body.event as JsonObject).eventType, "patient.message.received");
    assert.equal((body.forwarding as JsonObject).status, "forwarded");
    assert.equal((body.forwarding as JsonObject).statusCode, 200);
    assert.equal(capturedEvents.length, 1);
    assert.equal(capturedEvents[0].headers["x-service-api-key"], serviceKey);
    assert.equal(capturedEvents[0].body.eventType, "patient.message.received");
    assert.equal(capturedEvents[0].body.idempotencyKey, "org_demo_healthcare:whatsapp:patient.message.received:wa-contract-001");
    assert.ok(capturedEvents[0].body.sourceMetadata);
  });

  it("normalizes access requests and de-duplicates by idempotency key", async () => {
    const payload = {
      tenantId: "org_demo_healthcare",
      eventId: "access-contract-001",
      phone: "+919900000002",
      patientName: "Rafiq Khan",
      specialty: "Cardiology",
      preferredDoctor: "Dr Rao",
      preferredBranch: "South Clinic",
      preferredDate: "Tomorrow"
    };
    const first = await fetch(`${gatewayUrl}/webhooks/whatsapp/access-request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify(payload)
    });
    const second = await fetch(`${gatewayUrl}/webhooks/whatsapp/access-request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify(payload)
    });
    const firstBody = (await first.json()) as JsonObject;
    const secondBody = (await second.json()) as JsonObject;

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal((firstBody.event as JsonObject).eventType, "access.request.received");
    assert.equal((secondBody.event as JsonObject).id, (firstBody.event as JsonObject).id);
    assert.equal((firstBody.event as JsonObject).idempotencyKey, "org_demo_healthcare:whatsapp:access.request.received:access-contract-001");
  });

  it("stores normalized events for retrieval", async () => {
    const response = await fetch(`${gatewayUrl}/events`, {
      headers: { "x-service-api-key": serviceKey }
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.events));
    assert.ok((body.events as unknown[]).some((event) => (event as JsonObject).sourceEventId === "wa-contract-001"));
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
  return 47000 + Math.floor(Math.random() * 1000);
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
