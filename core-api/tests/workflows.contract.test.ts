import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("communication workflows contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let templateId: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "workflows_contract_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";
    const service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);

    const res = await fetch(`${baseUrl}/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "org_demo_healthcare", userId: "user_demo_admin", expiresInSeconds: 900 })
    });
    token = String(((await res.json()) as { data: JsonObject }).data.accessToken);
  });

  after(async () => {
    await close(server);
    restoreEnv(previousEnv);
  });

  const authed = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }
    });

  it("lists the 5 seeded templates with usageCount >= 1 on the seeded ones", async () => {
    const body = (await (await authed("/templates")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    const seededIds = [
      "template_demo_booking",
      "template_demo_early_reminder",
      "template_demo_final_reminder",
      "template_demo_cancellation",
      "template_demo_reschedule"
    ];
    for (const id of seededIds) {
      const template = body.data.find((t) => t.id === id);
      assert.ok(template, `expected seeded template ${id}`);
      assert.ok((template?.usageCount as number) >= 1, `expected usageCount >= 1 for ${id}`);
    }
  });

  it("creates a text template", async () => {
    const res = await authed("/templates", {
      method: "POST",
      body: JSON.stringify({ name: "No-show follow-up", channel: "whatsapp", kind: "text", body: "Hi {{patientName}}, we missed you." })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    templateId = String(body.data.id);
    assert.ok(templateId.startsWith("template_"));
    assert.equal(body.data.status, "active");
    assert.equal(body.data.usageCount, 0);
  });

  it("rejects a text template missing a body", async () => {
    const res = await authed("/templates", {
      method: "POST",
      body: JSON.stringify({ name: "Bad template", channel: "whatsapp", kind: "text" })
    });
    assert.equal(res.status, 400);
  });

  it("patches a template", async () => {
    const res = await authed(`/templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "No-show follow-up v2" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.name, "No-show follow-up v2");
  });

  it("archives (soft-deletes) a template", async () => {
    const res = await authed(`/templates/${templateId}`, { method: "DELETE" });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.status, "archived");

    // Still listed (archived templates are returned).
    const list = (await (await authed("/templates")).json()) as { data: JsonObject[] };
    assert.ok(list.data.some((t) => t.id === templateId && t.status === "archived"));
  });

  it("lists the seeded Appointment lifecycle workflow with 5 stages", async () => {
    const body = (await (await authed("/workflows")).json()) as { data: JsonObject[] };
    const workflow = body.data.find((w) => w.id === "workflow_demo_appointment");
    assert.ok(workflow, "expected seeded workflow");
    assert.equal(workflow?.anchor, "appointment");
    assert.equal(workflow?.status, "active");
    assert.equal((workflow?.stages as JsonObject[]).length, 5);
  });

  it("creates a workflow", async () => {
    const res = await authed("/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "Post-visit care",
        anchor: "visit",
        status: "draft",
        stages: [
          {
            key: "thank_you",
            name: "Thank you",
            action: "message",
            templateId: "template_demo_booking",
            trigger: { type: "on_enroll" },
            enabled: true
          }
        ]
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.ok(String(body.data.id).startsWith("workflow_"));
    assert.equal(body.data.anchor, "visit");
    assert.equal((body.data.stages as JsonObject[]).length, 1);
  });

  it("rejects a workflow stage referencing a missing template", async () => {
    const res = await authed("/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "Broken workflow",
        anchor: "appointment",
        stages: [
          {
            key: "s1",
            name: "Stage 1",
            action: "message",
            templateId: "template_does_not_exist",
            trigger: { type: "on_enroll" },
            enabled: true
          }
        ]
      })
    });
    assert.equal(res.status, 400);
  });

  it("rejects duplicate stage keys", async () => {
    const res = await authed("/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "Dupe keys",
        anchor: "appointment",
        stages: [
          { key: "dup", name: "A", action: "task", trigger: { type: "on_enroll" }, enabled: true },
          { key: "dup", name: "B", action: "task", trigger: { type: "on_enroll" }, enabled: true }
        ]
      })
    });
    assert.equal(res.status, 400);
  });
});

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}
function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
}
