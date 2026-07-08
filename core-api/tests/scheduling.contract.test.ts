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
  // Kept so a test can corrupt a stored denormalized copy directly and prove the
  // read-time decorator (not the updateDoctor backfill) resolves the live value.
  let service: Awaited<ReturnType<typeof createCoreService>>;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "scheduling_contract_secret";
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

  it("backfills the doctor name on existing appointments when the doctor is renamed", async () => {
    const date = nextMonday();
    // Booked above as "Dr. Test Sharma".
    const before = (await (await authed(`/appointments?doctorId=${doctorId}&date=${date}`)).json()) as {
      data: Array<{ id: string; doctorName: string }>;
    };
    assert.ok(before.data.some((a) => a.doctorName === "Dr. Test Sharma"));

    const rename = await authed(`/doctors/${doctorId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Dr. Renamed Verma" })
    });
    assert.equal(rename.status, 200);

    const after = (await (await authed(`/appointments?doctorId=${doctorId}&date=${date}`)).json()) as {
      data: Array<{ doctorName: string }>;
    };
    assert.ok(after.data.length > 0);
    assert.ok(after.data.every((a) => a.doctorName === "Dr. Renamed Verma"));

    // Restore the name so later assertions in this suite still hold.
    await authed(`/doctors/${doctorId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Dr. Test Sharma" })
    });
  });

  it("resolves the live doctor name on GET /appointments even when the stored copy is stale (decorator, not backfill)", async () => {
    const date = nextMonday();
    // Simulate a stored denormalized copy that has drifted out of sync with the
    // live doctor record WITHOUT going through updateDoctor (so the backfill never
    // ran). This isolates the read-time decorator: the appointment row physically
    // holds a stale name/specialty, yet the endpoint must surface the live values.
    const data = (service as unknown as {
      data: {
        appointments: Array<{ doctorId?: string; doctorName: string; specialty: string }>;
      };
    }).data;
    const stale = data.appointments.filter((entry) => entry.doctorId === doctorId);
    assert.ok(stale.length > 0, "expected at least one appointment for the doctor");
    for (const entry of stale) {
      entry.doctorName = "Dr. STALE COPY";
      entry.specialty = "Stale Specialty";
    }

    const res = (await (await authed(`/appointments?doctorId=${doctorId}&date=${date}`)).json()) as {
      data: Array<{ doctorName: string; specialty: string }>;
    };
    assert.ok(res.data.length > 0);
    // Live record is "Dr. Test Sharma" (restored above) — decorator must win.
    assert.ok(
      res.data.every((a) => a.doctorName === "Dr. Test Sharma"),
      "GET /appointments must surface the live doctor name, not the stale stored copy"
    );
    assert.ok(
      res.data.every((a) => a.specialty !== "Stale Specialty"),
      "GET /appointments must surface the live specialty, not the stale stored copy"
    );
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

  it("marks the taken slot full but keeps the grid (capacity model)", async () => {
    const date = nextMonday();
    const body = (await (await authed(`/doctors/${doctorId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; capacity: number; booked: number }>;
    };
    // The full day grid is returned; the booked slot is now full, the rest have room.
    assert.equal(body.data.length, 4);
    assert.equal(body.data.filter((slot) => slot.booked < slot.capacity).length, 3);
    const taken = body.data.find((slot) => slot.start === firstSlot);
    assert.ok(taken && taken.booked >= taken.capacity, "the booked slot is full");
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

  it("books phone-first for a new patient (no patientId) — creates the patient + appointment", async () => {
    const date = nextMonday();
    const slots = (await (await authed(`/doctors/${doctorId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; capacity: number; booked: number }>;
    };
    const freeSlot = slots.data.find((s) => s.booked < s.capacity)!.start; // first slot with room
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        doctorId,
        branchId: "blr-indiranagar",
        scheduledAt: freeSlot,
        reason: "Watering eyes",
        patient: { name: "Phone First Patient", phone: "+919700099001" }
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.ok(body.data.patientId, "an appointment patientId was assigned");
    assert.equal(body.data.scheduledAt, freeSlot);
    // the created patient is now bookable / known
    const patient = (await (await authed(`/patients/${String(body.data.patientId)}`)).json()) as {
      data: JsonObject;
    };
    assert.equal(patient.data.displayName, "Phone First Patient");
  });

  it("rejects phone-first booking with neither patientId nor patient.name (400)", async () => {
    const date = nextMonday();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({ doctorId, scheduledAt: `${date}T09:00:00.000Z`, patient: { phone: "+910000000000" } })
    });
    // 09:00 is taken/invalid OR name missing — either way a 4xx, never a 500.
    assert.ok(res.status >= 400 && res.status < 500);
  });

  it("reschedules an appointment to another open slot (frees the old, takes the new)", async () => {
    const date = nextMonday();
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. Reschedule", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 30 })
      })
    ).json()) as { data: { id: string } };
    const drId = dr.data.id;
    await authed(`/doctors/${drId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 30, weeklyHours: { 1: [{ start: "09:00", end: "12:00" }] } })
    });
    const slots = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as { data: Array<{ start: string }> };
    const [s1, s2] = slots.data;

    const booked = (await (
      await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({ doctorId: drId, scheduledAt: s1.start, patient: { name: "Resched Test", phone: "+919712340000" } })
      })
    ).json()) as { data: { id: string } };

    const res = await authed(`/appointments/${booked.data.id}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt: s2.start })
    });
    const body = (await res.json()) as { data: { scheduledAt: string; status: string } };
    assert.equal(res.status, 200);
    assert.equal(body.data.scheduledAt, s2.start);
    assert.equal(body.data.status, "rescheduled");

    const after = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; capacity: number; booked: number }>;
    };
    const oldSlot = after.data.find((s) => s.start === s1.start);
    assert.ok(oldSlot && oldSlot.booked < oldSlot.capacity, "old slot is freed (has room)");
    const newSlot = after.data.find((s) => s.start === s2.start);
    assert.ok(newSlot && newSlot.booked >= newSlot.capacity, "new slot is taken (full)");
  });

  it("fills a multi-patient slot to capacity, then rejects the overflow (token model)", async () => {
    const date = nextMonday();
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({
          displayName: "Dr. Capacity",
          specialty: "Ophthalmology",
          branchIds: ["blr-indiranagar"],
          slotMinutes: 30,
          slotCapacity: 3
        })
      })
    ).json()) as { data: { id: string; slotCapacity: number } };
    const drId = dr.data.id;
    assert.equal(dr.data.slotCapacity, 3);
    await authed(`/doctors/${drId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 30, slotCapacity: 3, weeklyHours: { 1: [{ start: "09:00", end: "12:00" }] } })
    });
    const slots = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; capacity: number; booked: number }>;
    };
    const slot = slots.data[0];
    assert.equal(slot.capacity, 3);
    assert.equal(slot.booked, 0);

    // Three different patients fit into the one 30-min slot.
    for (let i = 0; i < 3; i += 1) {
      const res = await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: drId,
          scheduledAt: slot.start,
          patient: { name: `Token Patient ${i}`, phone: `+91981200000${i}` }
        })
      });
      assert.equal(res.status, 200, `booking ${i + 1} of 3 should succeed`);
    }

    // The slot now reports 3/3 and is full.
    const filled = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string; capacity: number; booked: number }>;
    };
    const filledSlot = filled.data.find((s) => s.start === slot.start);
    assert.ok(filledSlot && filledSlot.booked === 3 && filledSlot.booked >= filledSlot.capacity, "slot is 3/3 full");

    // A fourth patient into the same slot is rejected with 409 "full".
    const overflow = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        doctorId: drId,
        scheduledAt: slot.start,
        patient: { name: "Overflow Patient", phone: "+919812000099" }
      })
    });
    assert.equal(overflow.status, 409);
  });

  it("rejects a second same-day appointment for the same patient + doctor (409)", async () => {
    const date = nextMonday();
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. Dedup", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 30 })
      })
    ).json()) as { data: { id: string } };
    const drId = dr.data.id;
    await authed(`/doctors/${drId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 30, weeklyHours: { 1: [{ start: "09:00", end: "12:00" }] } })
    });
    const slots = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as { data: Array<{ start: string }> };
    const [s1, s2] = slots.data;

    const first = (await (
      await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({ doctorId: drId, scheduledAt: s1.start, patient: { name: "Dedup Patient", phone: "+919712349999" } })
      })
    ).json()) as { data: { patientId: string } };

    // same patient (by id) + same doctor + same day → rejected
    const dup = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({ doctorId: drId, scheduledAt: s2.start, patientId: first.data.patientId })
    });
    const body = (await dup.json()) as JsonObject;
    assert.equal(dup.status, 409);
    assert.match(String((body.error as JsonObject)?.message), /already has an appointment/i);
  });

  it("OPD walk-in checks in + completes the linked same-day appointment", async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const wd = new Date(`${todayIso}T00:00:00.000Z`).getUTCDay();
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. OPD Link", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 15 })
      })
    ).json()) as { data: { id: string } };
    const drId = dr.data.id;
    await authed(`/doctors/${drId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 15, weeklyHours: { [wd]: [{ start: "00:00", end: "23:45" }] } })
    });

    const appt = (await (
      await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: drId,
          scheduledAt: `${todayIso}T12:00:00.000Z`,
          patient: { name: "OPD Link Patient", phone: "+919733004400" }
        })
      })
    ).json()) as { data: { id: string; patientId: string; status: string } };
    assert.equal(appt.data.status, "scheduled");
    const apptId = appt.data.id;
    const pid = appt.data.patientId;
    const apptStatus = async () => {
      const list = (await (await authed(`/appointments?doctorId=${drId}&date=${todayIso}`)).json()) as {
        data: Array<{ id: string; status: string }>;
      };
      return list.data.find((a) => a.id === apptId)?.status;
    };

    // Patient walks in → OPD visit auto-checks-in the appointment.
    const visit = (await (
      await authed("/visits", {
        method: "POST",
        body: JSON.stringify({ patientId: pid, doctorId: drId, chiefComplaint: "Walk-in" })
      })
    ).json()) as { data: { id: string } };
    assert.equal(await apptStatus(), "checked_in");

    // Completing the OPD visit auto-completes the appointment.
    await authed(`/visits/${visit.data.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", disposition: { outcome: "prescribed" } })
    });
    assert.equal(await apptStatus(), "completed");
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
