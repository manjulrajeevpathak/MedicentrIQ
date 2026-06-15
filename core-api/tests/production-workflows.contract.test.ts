import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

const staffHeaders = {
  "content-type": "application/json",
  "x-demo-user-id": "user_demo_admin",
  "x-demo-tenant-id": "org_demo_healthcare"
};

const workflowHeaders = {
  "content-type": "application/json",
  "x-service-api-key": "workflow_demo_service_key"
};

describe("production workflow MVP contracts", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.WORKFLOW_WORKER_URL;
    delete process.env.DATACENTRIQ_GATEWAY_URL;
    const service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);
  });

  after(async () => {
    await close(server);
  });

  it("supports production inbox thread detail, assignment, notes, drafts, status, and links", async () => {
    const assigned = await request("POST", "/interactions/interaction_demo_002/assign", staffHeaders, {
      ownerRole: "front_desk",
      assignedToUserId: "user_demo_admin",
      createTask: true
    });
    assert.equal((assigned.interaction as JsonObject).assignedToRole, "front_desk");

    const withNote = await request("POST", "/inbox/interaction_demo_002/notes", staffHeaders, {
      body: "Verified callback preference with the patient.",
      visibility: "internal"
    });
    assert.equal(((withNote.notes as JsonObject[])[0]).body, "Verified callback preference with the patient.");

    const withDraft = await request("POST", "/inbox/interaction_demo_002/drafts", staffHeaders, {
      channel: "whatsapp",
      body: "We can hold a diabetology slot for you tomorrow.",
      status: "ready_to_send"
    });
    assert.equal(((withDraft.drafts as JsonObject[])[0]).status, "ready_to_send");

    const linked = await request("PATCH", "/inbox/interaction_demo_002", staffHeaders, {
      status: "linked",
      patientId: "patient_demo_002",
      linkedResourceId: "access_demo_001"
    });
    assert.equal(linked.status, "linked");
    assert.equal((linked.patient as JsonObject).id, "patient_demo_002");
    assert.ok((linked.linkedResourceIds as string[]).includes("access_demo_001"));

    const detail = await request("GET", "/inbox/interaction_demo_002", staffHeaders);
    assert.ok((detail.tasks as JsonObject[]).length > 0);
    assert.ok((detail.notes as JsonObject[]).length > 0);
    assert.ok((detail.drafts as JsonObject[]).length > 0);
  });

  it("matches identities and updates household caregiver authority", async () => {
    const search = await request("GET", "/identity/search?query=Rahul&phone=%2B919900001111", staffHeaders);
    const candidates = search.candidates as JsonObject[];
    assert.equal((candidates[0].patient as JsonObject).id, "patient_demo_002");
    assert.ok(Number(candidates[0].matchScore) >= 60);

    const resolved = await request("POST", "/identity/resolve", staffHeaders, {
      patientId: "patient_demo_002",
      interactionId: "interaction_demo_002",
      identityStatus: "verified"
    });
    assert.equal(resolved.identityStatus, "verified");

    const householdLink = await request("PATCH", "/patients/patient_demo_002/household", staffHeaders, {
      householdId: "household_demo_mehta",
      relationship: "self",
      primaryContact: true
    });
    assert.equal((householdLink.household as JsonObject).id, "household_demo_mehta");

    const household = await request("POST", "/households/household_demo_mehta/caregivers", staffHeaders, {
      caregiverName: "Priya Mehta",
      relationship: "spouse",
      phone: "+919900002222",
      consentStatus: "granted",
      permissions: ["book", "reschedule", "receive_reminders"]
    });
    const caregivers = household.caregiverPermissions as JsonObject[];
    assert.equal(caregivers[0].caregiverName, "Priya Mehta");
    assert.ok((caregivers[0].permissions as string[]).includes("reschedule"));
  });

  it("runs access request through slot, hold, booking, mobile link, confirmation, and reschedule", async () => {
    const accessRequest = await request("POST", "/access/requests", staffHeaders, {
      patientId: "patient_demo_001",
      interactionId: "interaction_demo_001",
      requestedSpecialty: "Ophthalmology",
      reason: "Post-op review requested by caregiver.",
      priority: "high"
    });
    assert.equal(accessRequest.status, "requested");

    const offered = await request("POST", `/access/requests/${accessRequest.id}/slot`, staffHeaders, {
      doctorName: "Dr. Neha Rao",
      specialty: "Ophthalmology",
      branchId: "blr-indiranagar",
      scheduledAt: "2026-06-14T09:30:00.000Z",
      holdMinutes: 20
    });
    assert.equal(offered.status, "hold_created");
    assert.equal((offered.candidateSlot as JsonObject).scheduledAt, "2026-06-14T09:30:00.000Z");

    const booked = await request("POST", `/access/requests/${accessRequest.id}/book`, staffHeaders);
    const appointment = booked.appointment as JsonObject;
    assert.equal((booked.accessRequest as JsonObject).status, "booked");
    assert.equal(appointment.status, "scheduled");

    const mobile = await request("POST", `/access/requests/${accessRequest.id}/mobile-link`, staffHeaders, {
      expiresInHours: 48
    });
    const session = mobile.mobileLinkSession as JsonObject;
    assert.equal((mobile.accessRequest as JsonObject).status, "mobile_link_sent");
    assert.equal(session.patientId, "patient_demo_001");

    const lookup = await request("GET", `/mobile-link-sessions/${session.token}`, { "content-type": "application/json" });
    assert.equal((lookup.session as JsonObject).token, session.token);

    const confirmed = await request("POST", `/access/requests/${accessRequest.id}/confirm`, staffHeaders, {
      confirmedBy: "staff",
      notes: "Confirmed through access workflow contract."
    });
    assert.equal((confirmed.accessRequest as JsonObject).status, "confirmed");
    assert.equal((confirmed.appointment as JsonObject).status, "confirmed");

    const rescheduled = await request("POST", `/access/requests/${accessRequest.id}/reschedule`, staffHeaders, {
      reason: "Patient requested a later arrival.",
      scheduledAt: "2026-06-14T11:30:00.000Z"
    });
    assert.equal(rescheduled.status, "reschedule_requested");
  });

  it("creates follow-up journeys, tasks, events, and accepts workflow callbacks", async () => {
    const template = await request("POST", "/journey-templates", staffHeaders, {
      name: "Diabetes follow-up journey",
      condition: "diabetes",
      defaultOwnerRole: "care_coordinator",
      steps: [
        {
          key: "collect_hba1c",
          title: "Collect HbA1c report",
          offsetDays: 2,
          instructions: "Ask the patient to upload the latest HbA1c report."
        }
      ]
    });
    assert.equal(template.status, "active");

    const journey = await request("POST", "/patient-journeys", staffHeaders, {
      patientId: "patient_demo_002",
      templateId: template.id,
      start: true
    });
    assert.equal(journey.status, "active");
    assert.ok((journey.tasks as JsonObject[]).length >= 1);

    const taskId = String(((journey.tasks as JsonObject[])[0]).id);
    const task = await request("PATCH", `/journey-tasks/${taskId}`, staffHeaders, {
      status: "in_progress",
      outcome: "Patient asked for upload link."
    });
    assert.equal(task.status, "in_progress");

    const event = await request("POST", `/patient-journeys/${journey.id}/events`, staffHeaders, {
      type: "note",
      payload: {
        note: "Care coordinator will follow up tomorrow."
      }
    });
    assert.equal(event.type, "note");

    const callback = await request("POST", "/service-events/workflow-callback", workflowHeaders, {
      type: "workflow.post_visit_follow_up.task_completed",
      journeyId: journey.id,
      journeyTaskId: taskId,
      status: "completed",
      outcome: "Report uploaded."
    });
    assert.equal(callback.accepted, true);
    assert.equal(callback.handled, true);
    assert.equal((callback.updatedJourneyTask as JsonObject).status, "completed");
  });

  async function request(method: "GET" | "POST" | "PATCH", path: string, headers: Record<string, string>, body?: JsonObject) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = (await response.json()) as { data?: JsonObject; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
    assert.ok(payload.data, `${method} ${path} should return a data envelope`);
    return payload.data;
  }
});

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
