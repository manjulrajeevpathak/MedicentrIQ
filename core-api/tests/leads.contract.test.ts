import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("leads & data sources contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let leadId: string;
  let formSlug: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "leads_contract_secret";
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

  it("creates a lead", async () => {
    const res = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Camp Lead",
        phone: "+919800000456",
        source: "camp",
        sourceDetail: "Free Eye Camp",
        branchId: "blr-indiranagar"
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    leadId = String(body.data.id);
    assert.ok(leadId.startsWith("lead_"));
    assert.equal(body.data.stage, "new");
    assert.equal(body.data.source, "camp");
  });

  it("sets matchedPatientId when a new lead's phone matches an existing patient", async () => {
    const res = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Anita Dup", phone: "+919876543210", source: "referral" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.matchedPatientId, "patient_demo_001");
    assert.equal(body.data.convertedPatientId, undefined);
  });

  it("returns funnel counts per stage and per source", async () => {
    const body = (await (await authed("/leads/funnel")).json()) as {
      data: { total: number; byStage: Record<string, number>; bySource: Record<string, number> };
    };
    assert.ok(body.data.total >= 4);
    assert.ok(body.data.byStage.new >= 2);
    assert.ok(body.data.bySource.camp >= 1);
    assert.equal(typeof body.data.byStage.converted, "number");
  });

  it("patches a lead's stage and assignee", async () => {
    const res = await authed(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "contacted", assignedTo: "user_demo_frontdesk" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.stage, "contacted");
    assert.equal(body.data.assignedTo, "user_demo_frontdesk");
  });

  it("filters leads by stage", async () => {
    const body = (await (await authed("/leads?stage=contacted")).json()) as { data: JsonObject[] };
    assert.ok(body.data.every((lead) => lead.stage === "contacted"));
    assert.ok(body.data.some((lead) => lead.id === leadId));
  });

  it("converts a lead into a brand-new patient and marks it converted", async () => {
    const res = await authed(`/leads/${leadId}/convert`, { method: "POST", body: JSON.stringify({}) });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.ok(String(body.data.id).startsWith("patient_"));
    assert.equal(body.data.displayName, "Test Camp Lead");

    const lead = (await (await authed("/leads?source=camp")).json()) as { data: JsonObject[] };
    const converted = lead.data.find((entry) => entry.id === leadId);
    assert.ok(converted);
    assert.equal(converted?.stage, "converted");
    assert.equal(converted?.convertedPatientId, body.data.id);
  });

  it("converts a lead by linking an existing patient", async () => {
    const create = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Link Me", phone: "+919811112222", source: "meta" })
    });
    const created = (await create.json()) as { data: JsonObject };
    const id = String(created.data.id);

    const res = await authed(`/leads/${id}/convert`, {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_002" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.id, "patient_demo_002");
  });

  it("imports rows and de-dupes by phone within the batch", async () => {
    const res = await authed("/leads/import", {
      method: "POST",
      body: JSON.stringify({
        source: "import",
        rows: [
          { name: "Row One", phone: "+919700000001", email: "one@example.com" },
          { name: "Row Two", phone: "+919700000002" },
          { name: "Row One Dup", phone: "919700000001" }, // same digits → skipped
          { name: "", phone: "+919700000003" } // missing name → skipped
        ]
      })
    });
    const body = (await res.json()) as { data: { created: number; skipped: number } };
    assert.equal(res.status, 200);
    assert.equal(body.data.created, 2);
    assert.equal(body.data.skipped, 2);
  });

  it("creates a form and auto-generates a slug", async () => {
    const res = await authed("/forms", {
      method: "POST",
      body: JSON.stringify({
        title: "Diabetes Screening Camp",
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "phone", label: "Phone", type: "phone", required: true },
          { key: "age", label: "Age", type: "number" }
        ]
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    formSlug = String(body.data.slug);
    assert.equal(formSlug, "diabetes-screening-camp");
    assert.equal(body.data.submissions, 0);
    assert.equal((body.data.fields as unknown[]).length, 3);
  });

  it("serves the public form schema with no auth", async () => {
    const res = await fetch(`${baseUrl}/public/forms/${formSlug}`);
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.title, "Diabetes Screening Camp");
    assert.equal((body.data.fields as unknown[]).length, 3);
  });

  it("404s an unknown public form slug", async () => {
    const res = await fetch(`${baseUrl}/public/forms/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("public submit creates a lead and increments the submission count", async () => {
    const submit = await fetch(`${baseUrl}/public/forms/${formSlug}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values: { name: "Camp Walkup", phone: "+919733333333", age: "60" } })
    });
    const submitBody = (await submit.json()) as { data: JsonObject };
    assert.equal(submit.status, 200);
    assert.equal(submitBody.data.ok, true);

    // Form submission count bumped.
    const forms = (await (await authed("/forms")).json()) as { data: JsonObject[] };
    const form = forms.data.find((entry) => entry.slug === formSlug);
    assert.equal(form?.submissions, 1);

    // A form-sourced lead now exists.
    const leads = (await (await authed("/leads?source=form")).json()) as { data: JsonObject[] };
    const lead = leads.data.find((entry) => entry.name === "Camp Walkup");
    assert.ok(lead);
    assert.equal(lead?.source, "form");
    assert.equal(lead?.sourceDetail, "Diabetes Screening Camp");
    assert.equal((lead?.formData as JsonObject)?.age, "60");
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
