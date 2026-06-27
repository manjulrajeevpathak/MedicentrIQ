import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("per-tenant messaging channels contract", () => {
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
    process.env.STAFF_SESSION_SECRET = "channels_contract_secret";
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

  it("starts with channels unconfigured", async () => {
    const body = (await (await authed("/tenant/channels")).json()) as { data: JsonObject };
    const ch = body.data as { ultramsg: JsonObject; aisensy: JsonObject };
    assert.equal(ch.ultramsg.configured, false);
    assert.equal(ch.aisensy.configured, false);
  });

  it("rejects a transactional send when UltraMsg is not configured", async () => {
    const res = await authed("/messages/send", { method: "POST", body: JSON.stringify({ to: "+910000000000", type: "transactional", body: "hi" }) });
    const body = (await res.json()) as JsonObject;
    assert.equal(res.status, 400);
    assert.match(String((body.error as JsonObject)?.message), /UltraMsg .* not configured/);
  });

  it("rejects a marketing send when AISensy is not configured", async () => {
    const res = await authed("/messages/send", { method: "POST", body: JSON.stringify({ to: "+910000000000", type: "marketing", campaign: "c1" }) });
    const body = (await res.json()) as JsonObject;
    assert.equal(res.status, 400);
    assert.match(String((body.error as JsonObject)?.message), /AISensy .* not configured/);
  });

  it("stores credentials and returns them redacted (never raw secrets)", async () => {
    const res = await authed("/tenant/channels", {
      method: "PATCH",
      body: JSON.stringify({
        ultramsg: { instanceId: "instance999", token: "super-secret-token-abcd", enabled: true },
        aisensy: { apiKey: "aisensy-secret-key-wxyz", enabled: true }
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    const ch = body.data as { ultramsg: JsonObject; aisensy: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(ch.ultramsg.configured, true);
    assert.equal(ch.ultramsg.instanceId, "instance999");
    assert.equal(ch.ultramsg.tokenTail, "…abcd");
    assert.equal((ch.ultramsg as JsonObject).token, undefined, "raw token must not be returned");
    assert.equal(ch.aisensy.configured, true);
    assert.equal(ch.aisensy.apiKeyTail, "…wxyz");
    assert.equal((ch.aisensy as JsonObject).apiKey, undefined, "raw apiKey must not be returned");
  });

  it("routes marketing to AISensy and requires a campaign name", async () => {
    // AISensy is now configured but no campaign supplied → adapter fails fast, no network.
    const res = await authed("/messages/send", { method: "POST", body: JSON.stringify({ to: "+910000000000", type: "marketing" }) });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const d = body.data as JsonObject;
    assert.equal(d.channel, "aisensy");
    assert.equal(d.ok, false);
    assert.match(String(d.error), /campaign name is required/i);
  });

  it("logs every send attempt for the tenant", async () => {
    const body = (await (await authed("/messages?limit=10")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    assert.equal((body.data[0] as JsonObject).channel, "aisensy");
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
