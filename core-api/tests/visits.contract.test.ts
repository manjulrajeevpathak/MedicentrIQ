import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("OPD walk-in visits contract", () => {
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
    process.env.STAFF_SESSION_SECRET = "visits_contract_secret";
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

  it("intake lookup for an existing patient returns match:patient + clinical", async () => {
    const body = (await (await authed("/intake/lookup?phone=%2B919876543210")).json()) as {
      data: { match: string; patient?: JsonObject; clinical?: { conditions: JsonObject[]; allergies: string[] }; recentVisits?: JsonObject[] };
    };
    assert.equal(body.data.match, "patient");
    assert.equal(body.data.patient?.id, "patient_demo_001");
    assert.ok(body.data.clinical);
    assert.ok(body.data.clinical?.conditions.some((c) => c.icd10Code === "H25.9"));
    assert.ok(Array.isArray(body.data.recentVisits));
    // Seeded completed walk-in visit shows up.
    assert.ok((body.data.recentVisits ?? []).some((v) => v.id === "visit_demo_001"));
  });

  it("intake lookup for an unknown phone with a seeded lead returns match:lead", async () => {
    // lead_demo_001 Sunita Reddy +919845012345, no patient with that phone.
    const body = (await (await authed("/intake/lookup?phone=%2B919845012345")).json()) as {
      data: { match: string; lead?: JsonObject };
    };
    assert.equal(body.data.match, "lead");
    assert.equal(body.data.lead?.id, "lead_demo_001");
    assert.equal(body.data.lead?.name, "Sunita Reddy");
  });

  it("intake lookup for a fully unknown phone returns match:none", async () => {
    const body = (await (await authed("/intake/lookup?phone=%2B910000000000")).json()) as { data: { match: string } };
    assert.equal(body.data.match, "none");
  });

  it("creates a visit with new-patient fields, registering the patient and merging intake into the clinical record", async () => {
    const res = await authed("/visits", {
      method: "POST",
      body: JSON.stringify({
        name: "Walkin Wally",
        age: 55,
        gender: "male",
        phone: "+919766001122",
        branchId: "blr-indiranagar",
        chiefComplaint: "Red eye and itching",
        doctorId: "doctor_demo_kavita",
        intakeConditions: [{ icd10Code: "H10.9", label: "Conjunctivitis, unspecified" }],
        intakeAllergies: ["Penicillin"],
        vitals: { bp: "120/80", iopOD: 14, visualAcuityOD: "6/6" },
        intakeNotes: "First visit"
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const visit = body.data;
    assert.ok(String(visit.id).startsWith("visit_"));
    assert.equal(visit.status, "registered");
    assert.equal(visit.visitType, "walk_in");
    assert.equal(visit.chiefComplaint, "Red eye and itching");
    assert.equal(visit.doctorName, "Dr. Kavita Menon");
    assert.equal(visit.department, "Ophthalmology");
    assert.ok(visit.patientId);
    assert.equal((visit.vitals as JsonObject).iopOD, 14);

    const patientId = String(visit.patientId);
    // Intake conditions + allergies merged into the clinical record.
    const clinical = (await (await authed(`/patients/${patientId}/clinical`)).json()) as {
      data: { conditions: JsonObject[]; allergies: string[] };
    };
    assert.ok(clinical.data.conditions.some((c) => c.icd10Code === "H10.9"));
    assert.ok(clinical.data.allergies.includes("Penicillin"));
  });

  it("creates a visit for an existing patient", async () => {
    const res = await authed("/visits", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_001", chiefComplaint: "Routine review" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.patientId, "patient_demo_001");
    assert.equal(body.data.patientName, "Anita Sharma");
    assert.equal(body.data.status, "registered");
  });

  it("advances a visit to in_consult then completed, merging the diagnosis into the clinical record", async () => {
    const create = await authed("/visits", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_002", chiefComplaint: "Diabetes eye screen" })
    });
    const visitId = String(((await create.json()) as { data: JsonObject }).data.id);

    // in_consult sets consultedAt.
    const inConsult = (await (await authed(`/visits/${visitId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_consult" })
    })).json()) as { data: JsonObject };
    assert.equal(inConsult.data.status, "in_consult");
    assert.ok(inConsult.data.consultedAt);

    // completed with diagnosis + disposition.
    const completed = (await (await authed(`/visits/${visitId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        diagnosis: [{ icd10Code: "E11.319", label: "Type 2 diabetes with unspecified diabetic retinopathy" }],
        disposition: { outcome: "follow_up", nextStep: "Laser review in 4 weeks" },
        consultNotes: "Mild NPDR."
      })
    })).json()) as { data: JsonObject };
    assert.equal(completed.data.status, "completed");
    assert.equal((completed.data.disposition as JsonObject).outcome, "follow_up");
    assert.ok((completed.data.diagnosis as JsonObject[]).some((d) => d.icd10Code === "E11.319"));

    // Diagnosis merged into clinical record.
    const clinical = (await (await authed(`/patients/patient_demo_002/clinical`)).json()) as {
      data: { conditions: JsonObject[] };
    };
    assert.ok(clinical.data.conditions.some((c) => c.icd10Code === "E11.319"));
  });

  it("rejects completing a visit without a disposition", async () => {
    const create = await authed("/visits", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_001", chiefComplaint: "No disposition yet" })
    });
    const visitId = String(((await create.json()) as { data: JsonObject }).data.id);
    const res = await authed(`/visits/${visitId}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
    assert.equal(res.status, 400);
  });

  it("filters visits by date (registeredAt day)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const body = (await (await authed(`/visits?date=${today}`)).json()) as { data: JsonObject[] };
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.every((v) => String(v.registeredAt).slice(0, 10) === today));
    // The seeded visit (registered 7 days ago) is excluded.
    assert.ok(!body.data.some((v) => v.id === "visit_demo_001"));
  });

  it("lists and gets a visit with patientName resolved", async () => {
    const list = (await (await authed("/visits?patientId=patient_demo_001")).json()) as { data: JsonObject[] };
    assert.ok(list.data.length >= 1);
    assert.ok(list.data.every((v) => v.patientName === "Anita Sharma"));

    const single = (await (await authed(`/visits/${list.data[0].id}`)).json()) as { data: JsonObject };
    assert.equal(single.data.patientName, "Anita Sharma");
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
