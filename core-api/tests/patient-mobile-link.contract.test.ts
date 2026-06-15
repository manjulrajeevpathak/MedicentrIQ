import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createSeedData, normalizeSeedData, type SeedData } from "../src/domain/seed.js";
import { CoreService } from "../src/services/core-service.js";
import type { CollectionName, CorePersistence } from "../src/persistence/store.js";
import type { OutboundClients } from "../src/integrations/outbound-clients.js";

type JsonObject = Record<string, unknown>;

const activeToken = "mls_demo_anita";
const limitedToken = "mls_demo_rahul";

describe("patient mobile-link contract", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const service = createTestCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);
  });

  after(async () => {
    await close(server);
  });

  it("looks up a valid token with patient context and allowed actions", async () => {
    const session = await request("GET", `/mobile-link-sessions/${activeToken}`);

    assert.equal((session.session as JsonObject).token, activeToken);
    assert.equal((session.patient as JsonObject).id, "patient_demo_001");
    assert.equal((session.household as JsonObject).id, "household_demo_sharma");
    assert.equal((session.household as JsonObject).displayName, "Sharma household");
    assert.ok(Array.isArray(session.appointments));
    assert.ok(Array.isArray(session.followUps));
    assert.deepEqual((session.session as JsonObject).allowedActions, [
      "confirm_appointment",
      "upload_document_metadata",
      "confirm_follow_up",
      "reschedule_request",
      "update_checklist",
      "update_consent",
      "opt_out"
    ]);
  });

  it("rejects an invalid token", async () => {
    const response = await fetch(`${baseUrl}/mobile-link-sessions/not-a-real-token`);
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 404);
    assert.match(String((body.error as JsonObject)?.message), /Mobile link session not found/);
  });

  it("returns 410 for an expired token", async () => {
    const response = await fetch(`${baseUrl}/mobile-link-sessions/mls_expired_contract`);
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 410);
    assert.match(String((body.error as JsonObject)?.message), /expired/);
  });

  it("confirms an appointment with the token-scoped patient", async () => {
    const appointment = await request("POST", `/mobile-link-sessions/${activeToken}/appointments/appointment_demo_001/confirm`, {
      confirmedBy: "patient",
      notes: "Contract test patient confirmation."
    });

    assert.equal(appointment.id, "appointment_demo_001");
    assert.equal(appointment.status, "confirmed");
    assert.equal((appointment.confirmation as JsonObject).confirmedBy, "patient");
  });

  it("rejects appointment confirmation for another patient's appointment", async () => {
    const response = await fetch(`${baseUrl}/mobile-link-sessions/${activeToken}/appointments/appointment_demo_002/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmedBy: "patient" })
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 403);
    assert.match(String((body.error as JsonObject)?.message), /does not belong/);
  });

  it("requests appointment reschedule through an allowed token action", async () => {
    const appointment = await request(
      "POST",
      `/mobile-link-sessions/${activeToken}/appointments/appointment_demo_001/reschedule-requests`,
      {
        reason: "Need an evening slot."
      }
    );

    assert.equal(appointment.id, "appointment_demo_001");
    assert.equal(appointment.status, "rescheduled");
  });

  it("rejects a mobile-link action not allowed by the token", async () => {
    const response = await fetch(
      `${baseUrl}/mobile-link-sessions/${limitedToken}/appointments/appointment_demo_002/reschedule-requests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "This action is not allowed for Rahul's token." })
      }
    );
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 403);
    assert.match(String((body.error as JsonObject)?.message), /not allowed/);
  });

  it("updates checklist state through the secure token", async () => {
    const checklist = await request("POST", `/mobile-link-sessions/${activeToken}/checklist/check-contact-details`, {
      completed: true
    });

    assert.equal(checklist.itemId, "check-contact-details");
    assert.equal(checklist.completed, true);
    assert.equal(typeof checklist.savedAt, "string");
  });

  it("stores document metadata without accepting a raw file upload", async () => {
    const document = await request("POST", `/mobile-link-sessions/${activeToken}/document-metadata`, {
      appointmentId: "appointment_demo_001",
      documentType: "lab_report",
      fileName: "post-op-report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      notes: "Contract test metadata."
    });

    assert.equal(document.patientId, "patient_demo_001");
    assert.equal(document.sessionToken, activeToken);
    assert.equal(document.fileName, "post-op-report.pdf");
    assert.equal(document.storageStatus, "metadata_only");
  });

  it("rejects document metadata linked to another patient's appointment", async () => {
    const response = await fetch(`${baseUrl}/mobile-link-sessions/${activeToken}/document-metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appointmentId: "appointment_demo_002",
        documentType: "lab_report",
        fileName: "wrong-patient-report.pdf"
      })
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 403);
    assert.match(String((body.error as JsonObject)?.message), /does not belong/);
  });

  it("confirms a due follow-up with patient preference", async () => {
    const followUp = await request("POST", `/mobile-link-sessions/${activeToken}/follow-ups/followup_demo_001/confirm`, {
      patientResponse: "needs_callback"
    });

    assert.equal(followUp.id, "followup_demo_001");
    assert.equal(followUp.status, "confirmed");
    assert.equal(followUp.patientResponse, "needs_callback");
  });

  it("updates consent for a supported channel", async () => {
    const patient = await request("POST", `/mobile-link-sessions/${activeToken}/consent`, {
      channel: "aiProcessing",
      enabled: false
    });

    const consent = patient.consent as JsonObject;
    assert.equal(patient.id, "patient_demo_001");
    assert.equal(consent.aiProcessing, "revoked");
  });

  it("rejects unsupported consent channels", async () => {
    const response = await fetch(`${baseUrl}/mobile-link-sessions/${activeToken}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "marketing", enabled: true })
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 400);
    assert.match(String((body.error as JsonObject)?.message), /Unsupported consent channel/);
  });

  it("opts out of non-care communication", async () => {
    const patient = await request("POST", `/mobile-link-sessions/${activeToken}/opt-out`, {
      scope: "non_care_messages"
    });

    const consent = patient.consent as JsonObject;
    assert.equal(patient.id, "patient_demo_001");
    assert.equal(consent.communications, "revoked");
  });

  it("records audit evidence for patient-link actions", async () => {
    const events = (await staffRequest("GET", "/audit/events")) as unknown[];
    const actions = events.map((event) => String((event as JsonObject).action));
    const resourceTypes = events.map((event) => String((event as JsonObject).resourceType));

    assert.ok(actions.includes("mobile_link.lookup"));
    assert.ok(actions.includes("mobile_link.action"));
    assert.ok(actions.includes("appointment.confirm"));
    assert.ok(actions.includes("document_metadata.create"));
    assert.ok(actions.includes("follow_up.confirm"));
    assert.ok(resourceTypes.includes("patient_consent"));
    assert.ok(resourceTypes.includes("checklist_item"));
  });

  async function request(method: "GET" | "POST", path: string, body?: JsonObject) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = (await response.json()) as { data?: JsonObject; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
    assert.ok(payload.data, `${method} ${path} should return a data envelope`);
    return payload.data;
  }

  async function staffRequest(method: "GET", path: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "x-demo-user-id": "user_demo_admin",
        "x-demo-tenant-id": "org_demo_healthcare"
      }
    });
    const payload = (await response.json()) as { data?: unknown; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
    assert.ok(payload.data, `${method} ${path} should return a data envelope`);
    return payload.data;
  }
});

function createTestCoreService() {
  const data = normalizeSeedData(createSeedData());
  data.sessions.push({
    token: "mls_expired_contract",
    tenantId: "org_demo_healthcare",
    patientId: "patient_demo_001",
    expiresAt: "2020-01-01T00:00:00.000Z",
    allowedActions: ["confirm_appointment"],
    createdAt: "2020-01-01T00:00:00.000Z"
  });

  return new CoreService(data, new TestPersistence(data), testOutboundClients);
}

class TestPersistence implements CorePersistence {
  readonly mode = "in-memory" as const;

  constructor(private readonly data: SeedData) {}

  async load() {
    return this.data;
  }

  async saveCollection<K extends CollectionName>(collection: K, records: SeedData[K]) {
    this.data[collection] = records;
  }
}

const testOutboundClients: OutboundClients = {
  datacentriq: {
    isConfigured: false,
    async extractIntent() {
      return undefined;
    }
  },
  workflow: {
    isConfigured: false,
    async startWorkflow() {
      return undefined;
    }
  }
};

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
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
