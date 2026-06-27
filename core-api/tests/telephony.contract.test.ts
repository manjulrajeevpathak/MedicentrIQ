import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("per-tenant telephony seam contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "telephony_contract_secret";
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
    fetch(`${baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });

  it("starts with telephony unconfigured (redacted read)", async () => {
    const body = (await (await authed("/tenant/channels")).json()) as { data: JsonObject };
    const tel = (body.data as { telephony: JsonObject }).telephony;
    assert.equal(tel.configured, false);
    assert.equal(tel.enabled, false);
  });

  it("records a call even when telephony is not configured (no 500)", async () => {
    const res = await authed("/calls", {
      method: "POST",
      body: JSON.stringify({ to: "+919876543210", direction: "outbound", patientId: "patient_demo_001", notes: "manual log" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const call = body.data;
    assert.equal(call.status, "queued");
    assert.equal(call.providerId, undefined, "no stub providerId when unconfigured");
    assert.match(String(call.disposition), /not configured/i);
  });

  it("stores telephony credentials and returns them redacted (never raw apiKey)", async () => {
    const res = await authed("/tenant/channels", {
      method: "PATCH",
      body: JSON.stringify({
        telephony: { provider: "twilio", apiKey: "telephony-secret-key-mnop", callerId: "+918000000000", enabled: true }
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    const tel = (body.data as { telephony: JsonObject }).telephony;
    assert.equal(res.status, 200);
    assert.equal(tel.configured, true);
    assert.equal(tel.provider, "twilio");
    assert.equal(tel.callerId, "+918000000000");
    assert.equal(tel.apiKeyTail, "…mnop");
    assert.equal((tel as JsonObject).apiKey, undefined, "raw apiKey must not be returned");
  });

  it("queues a call via the stub adapter once telephony is configured", async () => {
    const res = await authed("/calls", {
      method: "POST",
      body: JSON.stringify({ to: "+919812340001", leadId: "lead_for_call_test", notes: "configured dial" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const call = body.data;
    assert.equal(call.status, "queued");
    assert.match(String(call.providerId), /^stub-/);
    assert.equal(call.from, "+918000000000", "caller id from telephony config");
  });

  it("updates a call disposition via PATCH", async () => {
    const created = (await (await authed("/calls", {
      method: "POST",
      body: JSON.stringify({ to: "+910000000001", notes: "to-update" })
    })).json()) as { data: JsonObject };
    const id = String(created.data.id);
    const res = await authed(`/calls/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", disposition: "reached", recordingUrl: "https://rec.example/abc" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.status, "completed");
    assert.equal(body.data.disposition, "reached");
    assert.equal(body.data.recordingUrl, "https://rec.example/abc");
  });

  it("filters the call log by leadId", async () => {
    const body = (await (await authed("/calls?leadId=lead_for_call_test")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].leadId, "lead_for_call_test");
    assert.match(String(body.data[0].providerId), /^stub-/);
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
