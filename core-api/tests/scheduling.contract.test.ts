import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("scheduling & appointments contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let doctorId: string;
  let firstSlot: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "scheduling_contract_secret";
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

  // Next Monday (UTC) — guarantees the seeded Mon–Fri schedule is open.
  const nextMonday = () => {
    const d = new Date();
    const day = d.getUTCDay();
    const add = ((1 - day + 7) % 7) || 7;
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add));
    return target.toISOString().slice(0, 10);
  };

  it("creates a doctor and sets its weekly schedule", async () => {
    const create = await authed("/doctors", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Dr. Test Sharma",
        specialty: "Cardiology",
        branchIds: ["blr-indiranagar"],
        phone: "+919800000123",
        slotMinutes: 30
      })
    });
    const created = (await create.json()) as { data: JsonObject };
    assert.equal(create.status, 200);
    doctorId = String(created.data.id);
    assert.ok(doctorId.startsWith("doctor_"));

    const schedule = await authed(`/doctors/${doctorId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({
        slotMinutes: 30,
        weeklyHours: { 1: [{ start: "09:00", end: "11:00" }] }
      })
    });
    const scheduled = (await schedule.json()) as { data: JsonObject };
    assert.equal(schedule.status, 200);
    assert.equal((scheduled.data as { slotMinutes: number }).slotMinutes, 30);
  });

  it("lists tenant doctors (seed + created)", async () => {
    const body = (await (await authed("/doctors")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((d) => d.id === doctorId));
    assert.ok(body.data.some((d) => d.id === "doctor_demo_kavita"));
  });

  it("computes available slots for a working day", async () => {
    const date = nextMonday();
    const body = (await (await authed(`/doctors/${doctorId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; end: string }>;
    };
    // 09:00–11:00 at 30-min granularity → 4 slots.
    assert.equal(body.data.length, 4);
    firstSlot = body.data[0].start;
    assert.ok(firstSlot.startsWith(date));
  });

  it("books an available slot", async () => {
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patientId: "patient_demo_001",
        doctorId,
        branchId: "blr-indiranagar",
        scheduledAt: firstSlot,
        reason: "New consult"
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.doctorId, doctorId);
    assert.equal(body.data.scheduledAt, firstSlot);
    assert.equal(body.data.durationMinutes, 30);
    assert.equal(body.data.status, "scheduled");
  });

  it("rejects double-booking the same slot with 409", async () => {
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patientId: "patient_demo_001",
        doctorId,
        branchId: "blr-indiranagar",
        scheduledAt: firstSlot
      })
    });
    const body = (await res.json()) as JsonObject;
    assert.equal(res.status, 409);
    assert.match(String((body.error as JsonObject)?.message), /already booked/i);
  });

  it("drops the taken slot from subsequent availability", async () => {
    const date = nextMonday();
    const body = (await (await authed(`/doctors/${doctorId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string }>;
    };
    assert.equal(body.data.length, 3);
    assert.ok(!body.data.some((slot) => slot.start === firstSlot));
  });

  it("rejects a time outside the schedule with 400", async () => {
    const date = nextMonday();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patientId: "patient_demo_001",
        doctorId,
        scheduledAt: `${date}T20:00:00.000Z`
      })
    });
    const body = (await res.json()) as JsonObject;
    assert.equal(res.status, 400);
    assert.match(String((body.error as JsonObject)?.message), /outside the doctor's available schedule/i);
  });

  it("lists appointments filtered by doctor and date", async () => {
    const date = nextMonday();
    const body = (await (await authed(`/appointments?doctorId=${doctorId}&date=${date}`)).json()) as {
      data: JsonObject[];
    };
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].doctorId, doctorId);
  });

  it("send-confirmations returns sent/failed counts", async () => {
    const res = await authed("/scheduling/send-confirmations", { method: "POST" });
    const body = (await res.json()) as { data: { sent: number; failed: number } };
    assert.equal(res.status, 200);
    // UltraMsg is not configured in this in-memory run, so every active doctor with a
    // phone counts as failed — but the endpoint must still tally a result per doctor.
    assert.equal(typeof body.data.sent, "number");
    assert.equal(typeof body.data.failed, "number");
    assert.ok(body.data.sent + body.data.failed >= 1);
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
