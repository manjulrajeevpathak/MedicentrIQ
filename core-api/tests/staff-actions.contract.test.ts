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

describe("staff operations contract", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.WORKFLOW_WORKER_URL;
    const service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);
  });

  after(async () => {
    await close(server);
  });

  it("rejects staff dashboard requests without auth headers", async () => {
    const response = await fetch(`${baseUrl}/api/staff/dashboard`);
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 401);
    assert.match(String((body.error as JsonObject)?.message), /Authentication headers are required/);
  });

  it("returns the governed staff dashboard read model", async () => {
    const dashboard = await request("GET", "/api/staff/dashboard");

    assert.equal(dashboard.source, "core-api");
    assert.ok(Array.isArray(dashboard.metrics));
    assert.ok(Array.isArray(dashboard.workbench));
    assert.ok(Array.isArray(dashboard.inbox));
    assert.ok(Array.isArray(dashboard.accessQueue));
    assert.ok(Array.isArray(dashboard.followUpQueue));
    assert.ok((dashboard.workbench as unknown[]).length > 0);
    assert.ok((dashboard.inbox as unknown[]).length > 0);
  });

  it("completes a workbench task and records the state transition", async () => {
    const dashboard = await request("GET", "/api/staff/dashboard");
    const taskId = firstId(dashboard.workbench);

    const task = await request("PATCH", `/workbench/tasks/${taskId}`, {
      status: "completed",
      outcome: "Contract test completed the work item."
    });

    assert.equal(task.id, taskId);
    assert.equal(task.status, "completed");
    assert.equal(task.outcome, "Contract test completed the work item.");
  });

  it("assigns an inbox interaction and creates an actionable task", async () => {
    const dashboard = await request("GET", "/api/staff/dashboard");
    const interactionId = firstId(dashboard.inbox);

    const result = await request("POST", `/interactions/${interactionId}/assign`, {
      ownerRole: "care_coordinator",
      createTask: true
    });

    const interaction = result.interaction as JsonObject;
    const task = result.task as JsonObject;
    assert.equal(interaction.id, interactionId);
    assert.equal(interaction.status, "triaged");
    assert.equal(task.ownerRole, "care_coordinator");
    assert.equal(task.status, "open");
  });

  it("confirms an appointment from the access queue", async () => {
    const dashboard = await request("GET", "/api/staff/dashboard");
    const appointmentId = firstId(dashboard.accessQueue);

    const appointment = await request("POST", `/appointments/${appointmentId}/confirm`, {
      confirmedBy: "staff",
      notes: "Contract test confirmation."
    });

    assert.equal(appointment.id, appointmentId);
    assert.equal(appointment.status, "confirmed");
    assert.equal((appointment.confirmation as JsonObject).confirmedBy, "staff");
  });

  it("triggers a follow-up workflow through the staff contract", async () => {
    const dashboard = await request("GET", "/api/staff/dashboard");
    const followUpId = firstId(dashboard.followUpQueue);

    const result = await request("POST", "/workflows/trigger", {
      workflowType: "post-visit-follow-up",
      followUpId,
      trigger: "contract.staff_follow_up"
    });

    assert.equal(result.accepted, true);
    assert.equal(result.workflowType, "post-visit-follow-up");
  });

  it("records audit events for staff operation contracts", async () => {
    const events = (await request("GET", "/audit/events")) as unknown[];
    const actions = events.map((event) => String((event as JsonObject).action));

    assert.ok(actions.includes("task.update"));
    assert.ok(actions.includes("interaction.assign"));
    assert.ok(actions.includes("appointment.confirm"));
    assert.ok(actions.includes("workflow.trigger"));
  });

  async function request(method: "GET" | "POST" | "PATCH", path: string, body?: JsonObject) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: staffHeaders,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = (await response.json()) as { data?: JsonObject; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${payload.error?.message ?? response.status}`);
    assert.ok(payload.data, `${method} ${path} should return a data envelope`);
    return payload.data;
  }
});

function firstId(value: unknown): string {
  assert.ok(Array.isArray(value), "expected an array");
  assert.ok(value.length > 0, "expected at least one item");
  const id = (value[0] as JsonObject).id;
  assert.equal(typeof id, "string");
  return id;
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
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
