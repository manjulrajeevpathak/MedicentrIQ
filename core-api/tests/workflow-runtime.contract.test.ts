import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService, type CoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

/**
 * Contract for the Communication Workflow RUNTIME (enrollment, firing, signalling,
 * scheduler) cut over from the retired fixed appointment-notification path. Asserts:
 *  - booking enrolls a run + logs a "booked" message carrying templateId
 *  - cancelling logs the cancellation message (on_event signal)
 *  - the scheduler fires a due relative reminder exactly once (idempotent)
 *  - a tenant with NO active appointment workflow still gets notifications
 *    (lazy default provisioning)
 *  - patient reschedule logs a reschedule message with NO confirm link
 */
describe("communication workflow runtime contract", () => {
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
    process.env.STAFF_SESSION_SECRET = "workflow_runtime_contract_secret";
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

    // Enable UltraMsg so workflow message stages produce a transactional message-log
    // row. The send to the fake provider fails at the HTTP layer but is still logged.
    await authed("/tenant/channels", {
      method: "PATCH",
      body: JSON.stringify({ ultramsg: { instanceId: "inst_test", token: "tok_test", enabled: true } })
    });

    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. Workflow", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 30 })
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

  type MsgRow = { id: string; type: string; body?: string; templateId?: string };
  const messages = async (templateId?: string): Promise<MsgRow[]> => {
    const q = templateId ? `&templateId=${templateId}` : "";
    const list = (await (await authed(`/messages?limit=500${q}`)).json()) as { data: MsgRow[] };
    return list.data;
  };

  it("booking creates a workflow run and logs a 'booked' message carrying templateId", async () => {
    const slot = await openSlot();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patient: { name: "Booked Tester", phone: "+919800010001" },
        doctorId,
        scheduledAt: slot,
        reason: "Booked workflow test"
      })
    });
    assert.equal(res.status, 200);
    const created = (await res.json()) as { data: { id: string; patientId: string } };

    // A booking message was logged carrying the booking-template's templateId.
    const all = await messages();
    const bookedRow = all.find(
      (m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("is booked for")
    );
    assert.ok(bookedRow, "a booking message was logged");
    assert.ok(typeof bookedRow!.templateId === "string" && bookedRow!.templateId.length > 0, "booking message carries a templateId");
    assert.ok(String(bookedRow!.body).includes("token=mls_"), "booking message carries a confirm link");

    // The templateId filter returns only that template's messages.
    const filtered = await messages(bookedRow!.templateId);
    assert.ok(filtered.length >= 1, "templateId filter returns the booking message");
    assert.ok(filtered.every((m) => m.templateId === bookedRow!.templateId), "filter is exact");

    // The seeded workflow produced an active run anchored to this appointment.
    const runs = service.listAppointmentWorkflowRunsForTest(created.data.id);
    assert.ok(runs.length >= 1, "a workflow run was created for the booking");
    assert.equal(runs[0].status, "active");
    const enrollStage = runs[0].stageRuns.find((s) => s.status === "sent" && s.messageId === bookedRow!.id);
    assert.ok(enrollStage, "the on_enroll stage run is marked sent with the booking messageId");
  });

  it("cancelling an appointment logs the cancellation message", async () => {
    const slot = await openSlot();
    const booked = (await (
      await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient: { name: "Cancel Tester", phone: "+919800020002" },
          doctorId,
          scheduledAt: slot,
          reason: "Cancel workflow test"
        })
      })
    ).json()) as { data: { id: string } };

    const before = (await messages()).length;
    const res = await authed(`/appointments/${booked.data.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" })
    });
    assert.equal(res.status, 200);

    const after = await messages();
    assert.ok(after.length > before, "a message was logged on cancellation");
    const cancelRow = after.find(
      (m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("has been cancelled")
    );
    assert.ok(cancelRow, "a cancellation message was logged");
    assert.ok(typeof cancelRow!.templateId === "string", "cancellation message carries a templateId");

    // Cancelling closes the run so reminders stop.
    const runs = service.listAppointmentWorkflowRunsForTest(booked.data.id);
    assert.ok(runs.every((r) => r.status === "cancelled"), "runs are cancelled");
  });

  it("the scheduler fires a due relative reminder exactly once (idempotent)", async () => {
    // Book a valid Monday slot, then push its scheduledAt to ~2h out so the seeded
    // final reminder (offset -3h) is already due for the scheduler.
    const slot = await openSlot();
    const booked = (await (
      await authed("/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient: { name: "Reminder Tester", phone: "+919800030003" },
          doctorId,
          scheduledAt: slot,
          reason: "Reminder workflow test"
        })
      })
    ).json()) as { data: { id: string } };
    await service.setAppointmentScheduledAtForTest(booked.data.id, new Date(Date.now() + 2 * 60 * 60_000).toISOString());

    const beforeRun = (await messages()).length;
    const tally1 = await service.runWorkflowScheduler();
    assert.ok(tally1.fired >= 1, "scheduler fired at least one due reminder");
    const afterRun1 = (await messages()).length;
    assert.ok(afterRun1 > beforeRun, "a reminder message was logged");

    // Second run is a no-op for this appointment's already-fired reminders.
    const tally2 = await service.runWorkflowScheduler();
    const afterRun2 = (await messages()).length;
    assert.equal(afterRun2, afterRun1, "no duplicate reminder on the second scheduler tick");
    // tally2 may be 0 (idempotent); just assert it didn't re-fire the same stages.
    assert.ok(tally2.fired === 0 || afterRun2 === afterRun1);

    const runs = service.listAppointmentWorkflowRunsForTest(booked.data.id);
    const fired = runs[0]?.stageRuns.filter((s) => s.status === "sent") ?? [];
    assert.ok(fired.length >= 2, "booking + at least one reminder stage are sent");
  });

  it("an un-configured tenant is auto-provisioned the default workflow on read, and it fires", async () => {
    // Archive the demo tenant's seeded appointment workflow so NO active appointment
    // workflow exists — exactly the position a never-configured tenant is in.
    const list = (await (await authed("/workflows")).json()) as { data: Array<{ id: string; anchor: string; status: string }> };
    for (const wf of list.data) {
      if (wf.anchor === "appointment" && wf.status === "active") {
        await authed(`/workflows/${wf.id}`, { method: "DELETE" });
      }
    }

    // Listing the comms config re-provisions a tenant-scoped default workflow on the
    // spot, so a fresh tenant never lands on an empty page.
    const reprovisioned = (await (await authed("/workflows")).json()) as { data: Array<{ id: string; anchor: string; status: string }> };
    const lazy = reprovisioned.data.find((w) => w.anchor === "appointment" && w.status === "active");
    assert.ok(lazy, "an active appointment workflow was lazily provisioned on read");
    assert.ok(lazy!.id.includes("org_demo_healthcare"), "the provisioned workflow is tenant-scoped");

    // And it actually fires: booking still logs a booking message.
    const before = (await messages()).length;
    const slot = await openSlot();
    const res = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patient: { name: "Lazy Tester", phone: "+919800040004" },
        doctorId,
        scheduledAt: slot,
        reason: "Lazy provisioning test"
      })
    });
    assert.equal(res.status, 200);

    const after = await messages();
    assert.ok(after.length > before, "a booking message was logged for the (re)provisioned tenant");
    const bookedRow = after.find(
      (m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("is booked for")
    );
    assert.ok(bookedRow, "the provisioned workflow fired the booking message");
  });

  it("patient reschedule logs a reschedule message with NO confirm link", async () => {
    // Book against a Monday slot (fresh patient) so a confirm session is minted whose
    // token rides in the booking body — reuse it as the PWA link.
    const date = nextMonday();
    const firstSlot = await openSlot();
    const booked = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patient: { name: "Patient Reschedule", phone: "+919800050005" },
        doctorId,
        scheduledAt: firstSlot,
        reason: "Patient reschedule workflow test"
      })
    });
    assert.equal(booked.status, 200);

    const afterBook = await messages();
    const confirmRow = afterBook.find(
      (m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("token=mls_")
    );
    assert.ok(confirmRow, "booking logged a confirm-link message carrying an mls_ token");
    const sessionToken = /token=(mls_[a-z0-9]+)/i.exec(String(confirmRow!.body))![1];

    const lookup = (await (await fetch(`${baseUrl}/mobile-link-sessions/${sessionToken}`)).json()) as {
      data: { appointments: Array<{ id: string }> };
    };
    const appointmentId = lookup.data.appointments[0].id;

    const slotsRes = await authed(`/mobile-link-sessions/${sessionToken}/appointments/${appointmentId}/slots?date=${date}`);
    assert.equal(slotsRes.status, 200);
    const slotsBody = (await slotsRes.json()) as { data: Array<{ start: string }> };
    const target = slotsBody.data.find((s) => s.start !== firstSlot);
    assert.ok(target, "a second open slot exists to move to");

    const before = (await messages()).length;
    const moved = await authed(`/mobile-link-sessions/${sessionToken}/appointments/${appointmentId}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt: target!.start })
    });
    assert.equal(moved.status, 200);
    const movedBody = (await moved.json()) as { data: { status: string; rescheduledBy?: string } };
    assert.equal(movedBody.data.status, "rescheduled");
    assert.equal(movedBody.data.rescheduledBy, "patient");

    const after = await messages();
    assert.ok(after.length > before, "a message was logged for the reschedule");
    const reschedRow = after.find(
      (m) => m.type === "transactional" && typeof m.body === "string" && m.body.includes("is rescheduled to")
    );
    assert.ok(reschedRow, "a 'rescheduled' message was logged");
    assert.ok(!String(reschedRow!.body).includes("token=mls_"), "the rescheduled message carries NO confirm link");
  });

  it("POST /scheduling/run-reminders drives the new workflow scheduler", async () => {
    const res = await authed("/scheduling/run-reminders", { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { fired: number; byStage: JsonObject } };
    assert.equal(typeof body.data.fired, "number");
    assert.equal(typeof body.data.byStage, "object");
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
