import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("clinical, conditions catalog & documents contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let appointmentId: string;
  const patientId = "patient_demo_001";
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER,
    S3_BUCKET: process.env.S3_BUCKET
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.S3_BUCKET; // force the Local storage adapter
    process.env.STAFF_SESSION_SECRET = "clinical_contract_secret";
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

  it("returns the curated ophthalmology ICD-10 conditions catalog", async () => {
    const res = await authed("/clinical/conditions");
    const body = (await res.json()) as { data: Array<{ icd10Code: string; label: string }> };
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((entry) => entry.icd10Code === "H25.9"));
    assert.ok(body.data.some((entry) => entry.icd10Code === "H40.10"));
    assert.ok(body.data.some((entry) => entry.icd10Code === "E11.319"));
  });

  it("sets and gets a patient's clinical record with an ICD-10 condition", async () => {
    const put = await authed(`/patients/${patientId}/clinical`, {
      method: "PUT",
      body: JSON.stringify({
        conditions: [{ icd10Code: "H40.10", label: "Primary open-angle glaucoma, unspecified", since: "2025-01-01" }],
        allergies: ["Penicillin"],
        notes: "Monitoring IOP."
      })
    });
    const saved = (await put.json()) as { data: { conditions: JsonObject[]; allergies: string[] } };
    assert.equal(put.status, 200);
    assert.equal(saved.data.conditions.length, 1);
    assert.equal(saved.data.conditions[0].icd10Code, "H40.10");
    assert.deepEqual(saved.data.allergies, ["Penicillin"]);

    const get = await authed(`/patients/${patientId}/clinical`);
    const fetched = (await get.json()) as { data: { conditions: Array<{ icd10Code: string }>; notes: string } };
    assert.equal(get.status, 200);
    assert.equal(fetched.data.conditions[0].icd10Code, "H40.10");
    assert.equal(fetched.data.notes, "Monitoring IOP.");
  });

  it("runs the full document upload→record→list→download flow on the Local adapter", async () => {
    const fileBody = "PRESCRIPTION: take drops twice daily";

    // 1. Request an upload URL (Local adapter returns a /storage/local/<key> URL + key).
    const urlRes = await authed(`/patients/${patientId}/documents/upload-url`, {
      method: "POST",
      body: JSON.stringify({ filename: "rx.txt", contentType: "text/plain", type: "prescription" })
    });
    const urlBody = (await urlRes.json()) as { data: { uploadUrl: string; key: string; storageMode: string } };
    assert.equal(urlRes.status, 200);
    assert.equal(urlBody.data.storageMode, "local");
    const key = urlBody.data.key;
    assert.ok(key.startsWith("org_demo_healthcare/patient_demo_001/"));

    // 2. PUT the bytes to the local storage route (host comes from the test server).
    const putRes = await fetch(`${baseUrl}/storage/local/${key}`, { method: "PUT", body: fileBody });
    assert.equal(putRes.status, 200);

    // 3. Record the document metadata row.
    const recordRes = await authed(`/patients/${patientId}/documents`, {
      method: "POST",
      body: JSON.stringify({ key, filename: "rx.txt", contentType: "text/plain", type: "prescription" })
    });
    const recorded = (await recordRes.json()) as { data: { id: string; type: string; storageKey: string } };
    assert.equal(recordRes.status, 200);
    assert.equal(recorded.data.type, "prescription");
    assert.equal(recorded.data.storageKey, key);
    const docId = recorded.data.id;

    // 4. List shows it.
    const listRes = await authed(`/patients/${patientId}/documents`);
    const list = (await listRes.json()) as { data: Array<{ id: string }> };
    assert.equal(listRes.status, 200);
    assert.ok(list.data.some((entry) => entry.id === docId));

    // 5. Get the download URL and GET the bytes back.
    const dlRes = await authed(`/documents/${docId}/url`);
    const dl = (await dlRes.json()) as { data: { downloadUrl: string; key: string } };
    assert.equal(dlRes.status, 200);
    assert.equal(dl.data.key, key);

    const getFile = await fetch(`${baseUrl}/storage/local/${key}`);
    assert.equal(getFile.status, 200);
    assert.equal(await getFile.text(), fileBody);
  });

  it("completes an appointment with a disposition", async () => {
    // Fresh doctor so this booking never collides with the demo patient's seeded
    // same-day appointments (the same patient+doctor+day dedup would 409 otherwise).
    const dr = (await (
      await authed("/doctors", {
        method: "POST",
        body: JSON.stringify({ displayName: "Dr. Clinical", specialty: "Ophthalmology", branchIds: ["blr-indiranagar"], slotMinutes: 30 })
      })
    ).json()) as { data: { id: string } };
    const drId = dr.data.id;
    await authed(`/doctors/${drId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ slotMinutes: 30, weeklyHours: { 1: [{ start: "09:00", end: "11:00" }] } })
    });
    // A Monday ~3 weeks out — safely later than the demo patient's seeded
    // appointments, so the completed visit is unambiguously their latest (→ opd_done).
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 21);
    while (future.getUTCDay() !== 1) future.setUTCDate(future.getUTCDate() + 1);
    const date = future.toISOString().slice(0, 10);
    const slots = (await (await authed(`/doctors/${drId}/slots?date=${date}`)).json()) as {
      data: Array<{ start: string }>;
    };
    assert.ok(slots.data.length > 0);
    const book = await authed("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patientId,
        doctorId: drId,
        branchId: "blr-indiranagar",
        scheduledAt: slots.data[0].start,
        reason: "Glaucoma review"
      })
    });
    const booked = (await book.json()) as { data: { id: string } };
    assert.equal(book.status, 200);
    appointmentId = booked.data.id;

    // Complete it with a disposition via the convenience endpoint.
    const dispRes = await authed(`/appointments/${appointmentId}/disposition`, {
      method: "POST",
      body: JSON.stringify({ outcome: "advised_surgery", notes: "Schedule trabeculectomy", nextStep: "Pre-op workup", nextActionDate: "2026-07-15" })
    });
    const disp = (await dispRes.json()) as { data: { status: string; disposition: { outcome: string; nextStep: string } } };
    assert.equal(dispRes.status, 200);
    assert.equal(disp.data.status, "completed");
    assert.equal(disp.data.disposition.outcome, "advised_surgery");
    assert.equal(disp.data.disposition.nextStep, "Pre-op workup");

    // Patient lifecycle summary reflects the completed visit + open next action.
    const patientRes = await authed(`/patients/${patientId}`);
    const patient = (await patientRes.json()) as {
      data: { lifecycle: { stage: string; lastVisitAt?: string; openNextAction?: { description: string } } };
    };
    assert.equal(patientRes.status, 200);
    assert.equal(patient.data.lifecycle.stage, "opd_done");
    assert.ok(patient.data.lifecycle.lastVisitAt);
    assert.equal(patient.data.lifecycle.openNextAction?.description, "Pre-op workup");
  });

  // Next Monday (UTC) — guarantees the seeded Mon–Fri schedule is open.
  function nextMonday() {
    const d = new Date();
    const day = d.getUTCDay();
    const add = ((1 - day + 7) % 7) || 7;
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add));
    return target.toISOString().slice(0, 10);
  }
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
