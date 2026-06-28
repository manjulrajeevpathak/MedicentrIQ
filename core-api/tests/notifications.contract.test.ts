import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService, type CoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("appointment notifications contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let service: CoreService;
  let doctorId: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "notifications_contract_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";
    service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);

    const res = await fetch(`${baseUrl}/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "org_demo_healthcare", userId: "user_demo_admin", expiresInSeconds: 900 })
    });
    token = String(((await res.json()) as { data: JsonObject }).data.accessToken);

    // Enable UltraMsg so booking produces a transactional message-log row. The send
    // to the fake provider fails at the HTTP layer but is still logged (status "failed").
    await authed("/tenant/channels", {
      method: "PATCH",
      body: JSON.stringify({ ultramsg: { instanceId: "inst_test", token: "tok_test", enabled: true } })
    });

    // A doctor + open Monday schedule to book against.
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. Notify", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 30 })
      })
    ).json()) as { data: { id: string } };
    doctorId = dr.data.id;
    await authed(`/doctors/${doctorId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 30, weeklyHours: { 1: [{ start: "09:00", end: "12:00" }] } })
    });
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

  // Next Monday (UTC) — guarantees the Mon schedule above is open.
  const nextMonday = () => {
    const d = new Date();
    const day = d.getUTCDay();
    const add = ((1 - day + 7) % 7) || 7;
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add));
    return target.toISOString().slice(0, 10);
  };

  const openSlot = async () => {
    const date = nextMonday();
    const slots = (await (await authed(`/doctors/${doctorId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string }>;
    };
    return slots.data[0].start;
  };

  const messageCount = async () => {
    const list = (await (await authed("/messages?limit=200")).json()) as { data: JsonObject[] };
    return list.data.length;
  };

  it("GET /tenant/notifications returns resolved defaults", async () => {
    const res = await authed("/tenant/notifications");
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const booked = body.data.booked as { enabled: boolean; body: string };
    assert.equal(booked.enabled, true);
    assert.match(booked.body, /\{\{confirmLink\}\}/);
    assert.equal((body.data.reminder24h as { enabled: boolean }).enabled, true);
    assert.equal((body.data.reminder3h as { enabled: boolean }).enabled, true);
    assert.equal((body.data.cancelled as { enabled: boolean }).enabled, true);
  });

  it("booking a 'booked'-enabled appointment logs a transactional message + mints a confirm session", async () => {
    const before = await messageCount();
    const slot = await openSlot();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_001", doctorId, scheduledAt: slot, reason: "Notify test" })
    });
    assert.equal(res.status, 200);

    const list = (await (await authed("/messages?limit=200")).json()) as {
      data: Array<{ type: string; body?: string }>;
    };
    assert.ok(list.data.length > before, "a message-log row was written");
    const row = list.data.find((m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("token=mls_"));
    assert.ok(row, "a transactional row with a confirm-link mobile-link token was logged");

    // The confirm session referenced by the link must actually exist + be usable.
    // The mobile-link lookup authenticates via the token in the path (no bearer).
    const tokenMatch = /token=(mls_[a-z0-9]+)/i.exec(String(row?.body));
    assert.ok(tokenMatch, "confirm link carries an mls_ token");
    const session = await fetch(`${baseUrl}/mobile-link-sessions/${tokenMatch![1]}`, {
      headers: { "content-type": "application/json" }
    });
    assert.equal(session.status, 200);
    const sessionBody = (await session.json()) as { data: { session: { allowedActions: string[] } } };
    assert.ok(sessionBody.data.session.allowedActions.includes("confirm_appointment"));
  });

  it("PATCH disabling 'booked' is reflected on GET and suppresses the message", async () => {
    const patch = await authed("/tenant/notifications", {
      method: "PATCH",
      body: JSON.stringify({ booked: { enabled: false } })
    });
    assert.equal(patch.status, 200);
    const patched = (await patch.json()) as { data: { booked: { enabled: boolean } } };
    assert.equal(patched.data.booked.enabled, false);

    const get = (await (await authed("/tenant/notifications")).json()) as { data: { booked: { enabled: boolean } } };
    assert.equal(get.data.booked.enabled, false);

    const before = await messageCount();
    const slot = await openSlot();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_002", doctorId, scheduledAt: slot, reason: "No notify" })
    });
    assert.equal(res.status, 200);
    assert.equal(await messageCount(), before, "no message sent when 'booked' is disabled");
  });

  it("runAppointmentReminders returns a tally without throwing", async () => {
    const tally = await service.runAppointmentReminders();
    assert.equal(typeof tally.sent, "number");
    assert.equal(typeof tally.byEvent.reminder24h, "number");
    assert.equal(typeof tally.byEvent.reminder3h, "number");
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
