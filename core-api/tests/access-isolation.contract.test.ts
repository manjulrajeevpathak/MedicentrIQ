import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createSeedData, normalizeSeedData, type SeedData } from "../src/domain/seed.js";
import type { CollectionName, CorePersistence } from "../src/persistence/store.js";
import { CoreService } from "../src/services/core-service.js";
import type { OutboundClients } from "../src/integrations/outbound-clients.js";

type JsonObject = Record<string, unknown>;

const doctorHeaders = {
  "content-type": "application/json",
  "x-demo-user-id": "user_demo_doctor",
  "x-demo-tenant-id": "org_demo_healthcare"
};

const indiranagarFrontDeskHeaders = {
  "content-type": "application/json",
  "x-demo-user-id": "user_demo_ind_frontdesk",
  "x-demo-tenant-id": "org_demo_healthcare"
};

const adminHeaders = {
  "content-type": "application/json",
  "x-demo-user-id": "user_demo_admin",
  "x-demo-tenant-id": "org_demo_healthcare"
};

const integrationServiceHeaders = {
  "content-type": "application/json",
  "x-service-api-key": "core_demo_service_key"
};

describe("access isolation contract", () => {
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

  it("scopes branch-limited staff reads across patients, appointments, and audit", async () => {
    await ok("GET", "/patients/patient_demo_002", adminHeaders);

    const patients = (await ok("GET", "/patients", doctorHeaders)) as JsonObject[];
    assert.deepEqual(ids(patients), ["patient_demo_001"]);
    assert.equal(((patients[0].household as JsonObject)?.id), "household_demo_sharma");

    const appointments = (await ok("GET", "/appointments", doctorHeaders)) as JsonObject[];
    assert.deepEqual(ids(appointments), ["appointment_demo_001"]);

    const households = (await ok("GET", "/households", doctorHeaders)) as JsonObject[];
    assert.deepEqual(ids(households), ["household_demo_sharma"]);
    assert.equal(((households[0].members as JsonObject[])[0]).patientId, "patient_demo_001");

    const dashboard = (await ok("GET", "/api/staff/dashboard", doctorHeaders)) as JsonObject;
    assert.equal(((dashboard.patient360 as JsonObject).household as JsonObject).id, "household_demo_sharma");
    const auditEvents = dashboard.auditEvents as JsonObject[];
    assert.equal(auditEvents.some((event) => event.patientId === "patient_demo_002"), false);
  });

  it("blocks direct household access outside branch scope", async () => {
    await denied("GET", "/households/household_demo_mehta", doctorHeaders, 403, /outside.*branch/i);
  });

  it("blocks branch-limited staff writes against another branch", async () => {
    await denied("PATCH", "/workbench/tasks/task_demo_002", indiranagarFrontDeskHeaders, 403, /outside.*branch/i, {
      status: "completed"
    });
    await denied("POST", "/appointments/appointment_demo_002/confirm", indiranagarFrontDeskHeaders, 403, /outside.*branch/i, {
      confirmedBy: "staff"
    });
    await denied("POST", "/interactions/interaction_demo_002/assign", indiranagarFrontDeskHeaders, 403, /outside.*branch/i, {
      ownerRole: "front_desk"
    });
    await denied("POST", "/patients", indiranagarFrontDeskHeaders, 403, /outside.*branch/i, {
      displayName: "Cross Branch Patient",
      age: 44,
      branchId: "blr-whitefield"
    });
    await denied("POST", "/workflows/trigger", indiranagarFrontDeskHeaders, 403, /outside.*branch/i, {
      workflowType: "post-visit-follow-up",
      taskId: "task_demo_002"
    });
  });

  it("rejects workflow triggers with references that point to different patients", async () => {
    await denied("POST", "/workflows/trigger", adminHeaders, 400, /same patient/i, {
      workflowType: "post-visit-follow-up",
      patientId: "patient_demo_001",
      appointmentId: "appointment_demo_002"
    });
  });

  it("enforces role permissions even when the branch is visible", async () => {
    await denied("PATCH", "/workbench/tasks/task_demo_001", doctorHeaders, 403, /tasks:update/, {
      status: "completed"
    });
    await denied("POST", "/appointments/appointment_demo_001/confirm", doctorHeaders, 403, /appointments:confirm/, {
      confirmedBy: "staff"
    });
  });

  it("keeps service keys limited to service ingestion APIs", async () => {
    await denied("GET", "/patients", integrationServiceHeaders, 403, /patients:read/);
    await denied("POST", "/appointments", integrationServiceHeaders, 403, /appointments:create/, {
      patientId: "patient_demo_001",
      doctorName: "Dr. Service",
      specialty: "Ophthalmology",
      scheduledAt: "2026-06-12T12:00:00.000Z"
    });

    const event = (await ok("POST", "/service-events/integration", integrationServiceHeaders, {
      type: "patient.message.received",
      payload: {
        subject: "Service boundary test",
        summary: "Inbound integration event should be accepted through the service-only API.",
        patientHint: {
          phone: "+919999999999"
        }
      }
    })) as JsonObject;

    assert.equal(event.accepted, true);
    assert.equal(event.eventType, "patient.message.received");
    assert.equal(event.handled, true);
  });

  it("rejects demo headers when the user and tenant do not match", async () => {
    await denied(
      "GET",
      "/api/staff/dashboard",
      {
        "content-type": "application/json",
        "x-demo-user-id": "user_demo_admin",
        "x-demo-tenant-id": "org_other"
      },
      401,
      /user or tenant/i
    );
  });

  async function ok(
    method: "GET" | "POST" | "PATCH",
    path: string,
    headers: Record<string, string>,
    body?: JsonObject
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = (await response.json()) as { data?: unknown; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
    assert.ok(payload.data, `${method} ${path} should return a data envelope`);
    return payload.data;
  }

  async function denied(
    method: "GET" | "POST" | "PATCH",
    path: string,
    headers: Record<string, string>,
    status: number,
    messagePattern: RegExp,
    body?: JsonObject
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    assert.equal(response.status, status, `${method} ${path}`);
    assert.match(String(payload.error?.message), messagePattern);
  }
});

function createTestCoreService() {
  const data = normalizeSeedData(createSeedData());
  data.users.push({
    id: "user_demo_ind_frontdesk",
    tenantId: "org_demo_healthcare",
    displayName: "Indiranagar Front Desk",
    email: "ind.frontdesk.demo@healthcareos.local",
    roles: ["front_desk"],
    branchIds: ["blr-indiranagar"],
    status: "active",
    createdAt: new Date().toISOString()
  });

  return new CoreService(data, new TestPersistence(data), testOutboundClients);
}

function ids(records: JsonObject[]) {
  return records.map((record) => String(record.id)).sort();
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
