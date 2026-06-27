import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createStaffSessionToken } from "../src/auth/staff-session.js";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("staff signed session contract", () => {
  let server: Server;
  let baseUrl: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    WORKFLOW_WORKER_URL: process.env.WORKFLOW_WORKER_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.WORKFLOW_WORKER_URL;
    process.env.STAFF_SESSION_SECRET = "staff_session_contract_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";

    const service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);
  });

  after(async () => {
    await close(server);
    restoreEnv(previousEnv);
  });

  it("keeps health open without staff auth", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as { data?: JsonObject };

    assert.equal(response.status, 200);
    assert.equal(body.data?.service, "core-api");
  });

  it("issues a signed staff session through the guarded demo issuer", async () => {
    const session = await createSession();

    assert.equal(session.tokenType, "Bearer");
    assert.equal(typeof session.accessToken, "string");
    assert.equal((session.user as JsonObject).id, "user_demo_admin");
    assert.equal((session.user as JsonObject).tenantId, "org_demo_healthcare");
    assert.equal(typeof session.sessionId, "string");
  });

  it("authenticates staff APIs with a signed bearer session", async () => {
    const session = await createSession();
    const me = await requestWithSession("GET", "/auth/me", session.accessToken as string);
    const dashboard = await requestWithSession("GET", "/api/staff/dashboard", session.accessToken as string);

    const context = me.context as JsonObject;
    assert.equal(context.actorType, "staff");
    assert.equal(context.source, "staff_session");
    assert.equal(context.isDemoMode, false);
    assert.equal(context.actorId, "user_demo_admin");
    assert.equal(typeof context.sessionId, "string");
    assert.equal(dashboard.source, "core-api");
    assert.ok(Array.isArray(dashboard.workbench));
  });

  it("rejects tampered staff session tokens", async () => {
    const session = await createSession();
    const token = String(session.accessToken);
    const [prefix, payload, signature] = token.split(".");
    assert.ok(prefix && payload && signature);
    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("a") ? "b" : "a"}`;
    const tamperedToken = `${prefix}.${tamperedPayload}.${signature}`;
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${tamperedToken}` }
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 401);
    assert.match(String((body.error as JsonObject)?.message), /Invalid or expired session/);
  });

  it("rejects expired staff session tokens", async () => {
    const { token } = createStaffSessionToken({
      tenantId: "org_demo_healthcare",
      userId: "user_demo_admin",
      expiresInSeconds: -1
    }, process.env.STAFF_SESSION_SECRET as string);

    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 401);
    assert.match(String((body.error as JsonObject)?.message), /Invalid or expired session/);
  });

  it("still rejects protected staff APIs without auth", async () => {
    const response = await fetch(`${baseUrl}/api/staff/dashboard`);
    const body = (await response.json()) as JsonObject;

    assert.equal(response.status, 401);
    assert.match(String((body.error as JsonObject)?.message), /Authentication headers are required/);
  });

  async function createSession() {
    const response = await fetch(`${baseUrl}/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "org_demo_healthcare",
        userId: "user_demo_admin",
        expiresInSeconds: 900
      })
    });
    const body = (await response.json()) as { data?: JsonObject; error?: { message?: string } };
    assert.equal(response.ok, true, body.error?.message);
    assert.ok(body.data);
    return body.data;
  }

  async function requestWithSession(method: "GET", path: string, token: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` }
    });
    const body = (await response.json()) as { data?: JsonObject; error?: { message?: string } };
    assert.equal(response.ok, true, `${method} ${path}: ${body.error?.message ?? response.status}`);
    assert.ok(body.data);
    return body.data;
  }
});

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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
