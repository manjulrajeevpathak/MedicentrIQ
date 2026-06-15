import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { after, before, describe, it } from "node:test";

type JsonObject = Record<string, unknown>;

const serviceKey = "dciq_contract_key";

describe("datacentriq-gateway service contract", () => {
  let gateway: ChildProcessWithoutNullStreams;
  let gatewayUrl: string;

  before(async () => {
    const port = 49000 + Math.floor(Math.random() * 1000);
    gatewayUrl = `http://127.0.0.1:${port}`;
    gateway = spawn("node", ["--import", "tsx", "src/main.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        SERVICE_API_KEY: serviceKey
      }
    });
    gateway.stdout.resume();
    gateway.stderr.resume();
    await waitForHealth(`${gatewayUrl}/health`);
  });

  after(() => {
    gateway.kill();
  });

  it("keeps health open and protects non-health routes", async () => {
    const health = await fetch(`${gatewayUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(((await health.json()) as JsonObject).service, "datacentriq-gateway");

    const unauthorized = await fetch(`${gatewayUrl}/v1/capabilities`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${gatewayUrl}/v1/capabilities`, {
      headers: { "x-service-api-key": serviceKey }
    });
    assert.equal(authorized.status, 200);
    const body = (await authorized.json()) as JsonObject;
    const capabilities = body.capabilities as JsonObject;
    assert.ok(Array.isArray(capabilities.copilot));
    assert.ok(Array.isArray(capabilities.controlTower));
  });

  it("extracts intent with confidence, sources, and trace metadata", async () => {
    const response = await fetch(`${gatewayUrl}/v1/copilot/extract-intent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        requestActor: "core-api-contract",
        text: "I have pain after surgery and need urgent doctor callback",
        channel: "whatsapp",
        language: "English"
      })
    });
    const body = (await response.json()) as JsonObject;
    const data = body.data as JsonObject;
    const trace = body.decisionTrace as JsonObject;

    assert.equal(response.status, 200);
    assert.equal(data.primaryIntent, "post_op_concern");
    assert.equal(data.urgency, "high");
    assert.ok(typeof body.confidence === "number");
    assert.ok(Array.isArray(body.sources));
    assert.equal(trace.tenantId, "org_demo_healthcare");
    assert.equal(trace.requestActor, "core-api-contract");
  });

  it("prioritizes control tower items with ordered patient scores", async () => {
    const response = await fetch(`${gatewayUrl}/v1/control-tower/prioritize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        requestActor: "core-api-contract",
        objective: "follow_up",
        items: [
          {
            patientId: "patient_demo_001",
            patientName: "Anita Sharma",
            specialty: "Ophthalmology",
            openTasks: [{ priority: "high", title: "Post-op pain" }]
          },
          {
            patientId: "patient_demo_002",
            patientName: "Rahul Mehta",
            specialty: "Diabetology"
          }
        ]
      })
    });
    const body = (await response.json()) as JsonObject;
    const data = body.data as JsonObject;

    assert.equal(response.status, 200);
    assert.equal(data.objective, "follow_up");
    assert.ok(Array.isArray(data.orderedItems));
    assert.equal(((data.orderedItems as JsonObject[])[0]).patientId, "patient_demo_001");
    assert.ok(Array.isArray(body.sources));
    assert.ok(body.decisionTrace);
  });

  it("explains patient and household identity match candidates", async () => {
    const response = await fetch(`${gatewayUrl}/v1/copilot/explain-identity-match`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        requestActor: "core-api-contract",
        requester: {
          phone: "+919900000001",
          name: "Rohit Sharma",
          relationship: "son",
          message: "I am booking for my mother"
        },
        candidates: [
          {
            patientId: "patient_demo_001",
            patientName: "Anita Sharma",
            householdId: "household_demo_001",
            phone: "+919900000001",
            caregiverName: "Rohit Sharma",
            uhid: "UHID-1"
          }
        ]
      })
    });
    const body = (await response.json()) as JsonObject;
    const data = body.data as JsonObject;
    const explanations = data.explanations as JsonObject[];

    assert.equal(response.status, 200);
    assert.equal(data.requesterType, "caregiver");
    assert.equal(explanations[0].recommendation, "link_household");
    assert.ok(typeof explanations[0].confidence === "number");
    assert.ok(body.decisionTrace);
  });

  it("returns access and follow-up workflow intelligence envelopes", async () => {
    const accessResponse = await fetch(`${gatewayUrl}/v1/control-tower/access-next-actions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        patient: {
          patientId: "patient_demo_001",
          patientName: "Anita Sharma",
          messages: ["Need urgent review for pain after surgery"]
        },
        accessRequest: {
          specialty: "Ophthalmology",
          preferredDoctor: "Dr Menon",
          status: "slot_needed"
        }
      })
    });
    const accessBody = (await accessResponse.json()) as JsonObject;
    const accessData = accessBody.data as JsonObject;

    const followUpResponse = await fetch(`${gatewayUrl}/v1/control-tower/follow-up-leakage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-api-key": serviceKey
      },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        patient: {
          patientId: "patient_demo_001",
          patientName: "Anita Sharma",
          openTasks: [{ title: "Overdue post-op follow-up", priority: "high" }]
        },
        journey: {
          journeyId: "journey_demo_001",
          status: "missed",
          dueAt: "2026-06-01T10:00:00.000Z"
        }
      })
    });
    const followUpBody = (await followUpResponse.json()) as JsonObject;
    const followUpData = followUpBody.data as JsonObject;

    assert.equal(accessResponse.status, 200);
    assert.equal(accessData.recommendedQueue, "nurse_escalation");
    assert.ok(Array.isArray(accessData.actions));
    assert.equal(followUpResponse.status, 200);
    assert.equal(followUpData.leakageDetected, true);
    assert.ok(Array.isArray(followUpData.reasons));
  });
});

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
