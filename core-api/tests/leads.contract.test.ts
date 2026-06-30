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

  it("GET /tenant/lead-config returns ordered defaults", async () => {
    const body = (await (await authed("/tenant/lead-config")).json()) as {
      data: { sources: Array<{ key: string; label: string }>; stages: Array<{ key: string; label: string }> };
    };
    assert.deepEqual(
      body.data.stages.map((s) => s.key),
      ["new", "contacted", "qualified", "booked", "converted", "lost"]
    );
    assert.ok(body.data.sources.some((s) => s.key === "camp"));
    assert.ok(body.data.sources.some((s) => s.key === "import"));
  });

  it("PATCH /tenant/lead-config adds a custom stage + source (reflected, ordered)", async () => {
    const res = await authed("/tenant/lead-config", {
      method: "PATCH",
      body: JSON.stringify({
        sources: [
          { key: "camp", label: "Camp" },
          { key: "form", label: "Web form" },
          { key: "import", label: "Import" },
          { key: "google_ads", label: "Google Ads" }
        ],
        stages: [
          { key: "new", label: "New" },
          { key: "contacted", label: "Contacted" },
          { key: "nurture", label: "Nurturing" },
          { key: "converted", label: "Converted" }
        ]
      })
    });
    const body = (await res.json()) as {
      data: { sources: Array<{ key: string }>; stages: Array<{ key: string }> };
    };
    assert.equal(res.status, 200);
    assert.deepEqual(body.data.stages.map((s) => s.key), ["new", "contacted", "nurture", "converted"]);
    assert.ok(body.data.sources.some((s) => s.key === "google_ads"));

    // A subsequent GET reflects the new config in the same order.
    const after = (await (await authed("/tenant/lead-config")).json()) as { data: { stages: Array<{ key: string }> } };
    assert.deepEqual(after.data.stages.map((s) => s.key), ["new", "contacted", "nurture", "converted"]);
  });

  it("rejects a lead-config entry with a blank label or duplicate key", async () => {
    const blank = await authed("/tenant/lead-config", {
      method: "PATCH",
      body: JSON.stringify({ sources: [{ key: "camp", label: "" }] })
    });
    assert.equal(blank.status, 400);

    const dup = await authed("/tenant/lead-config", {
      method: "PATCH",
      body: JSON.stringify({
        stages: [
          { key: "new", label: "New" },
          { key: "new", label: "New Again" }
        ]
      })
    });
    assert.equal(dup.status, 400);
  });

  it("creates a lead with a custom source key", async () => {
    const res = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Custom Source Lead", phone: "+919800000999", source: "google_ads" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.source, "google_ads");
    // Default stage is the first configured stage.
    assert.equal(body.data.stage, "new");
  });

  it("moves a lead to a custom funnel stage", async () => {
    const created = (await (await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Funnel Move", phone: "+919800000888", source: "camp" })
    })).json()) as { data: JsonObject };
    const id = String(created.data.id);
    const res = await authed(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ stage: "nurture" }) });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.stage, "nurture");
  });

  it("falls back to a safe value for an unknown source/stage key", async () => {
    const create = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Bad Keys", phone: "+919800000777", source: "totally_unknown" })
    });
    const created = (await create.json()) as { data: JsonObject };
    assert.equal(create.status, 200);
    // Unknown source falls back to "import" (configured); unknown stage → first stage.
    assert.equal(created.data.source, "import");
    assert.equal(created.data.stage, "new");

    // An unknown stage on update keeps the lead's current stage.
    const patched = (await (await authed(`/leads/${String(created.data.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "no_such_stage" })
    })).json()) as { data: JsonObject };
    assert.equal(patched.data.stage, "new");
  });

  it("funnel summary counts per configured stage + source (with config echoed)", async () => {
    const body = (await (await authed("/leads/funnel")).json()) as {
      data: {
        byStage: Record<string, number>;
        bySource: Record<string, number>;
        stages: Array<{ key: string }>;
        sources: Array<{ key: string }>;
      };
    };
    // Every configured stage has a count bucket (including the custom one).
    assert.equal(typeof body.data.byStage.nurture, "number");
    assert.equal(typeof body.data.bySource.google_ads, "number");
    assert.deepEqual(body.data.stages.map((s) => s.key), ["new", "contacted", "nurture", "converted"]);
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

  describe("CRM record (notes, callbacks, timeline)", () => {
    let crmLeadId: string;
    let callbackId: string;

    it("creates a lead for CRM, logs a note, schedules a callback, and surfaces them in the detail timeline", async () => {
      const created = (await (await authed("/leads", {
        method: "POST",
        body: JSON.stringify({ name: "CRM Lead", phone: "+919766600001", source: "referral" })
      })).json()) as { data: JsonObject };
      crmLeadId = String(created.data.id);

      // Move the stage so a stage-change shows up in the timeline (derived from audit).
      await authed(`/leads/${crmLeadId}`, { method: "PATCH", body: JSON.stringify({ stage: "contacted" }) });

      const noteRes = await authed(`/leads/${crmLeadId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: "Called and left a voicemail." })
      });
      const note = (await noteRes.json()) as { data: JsonObject };
      assert.equal(noteRes.status, 200);
      assert.equal(note.data.body, "Called and left a voicemail.");
      assert.ok(String(note.data.id).startsWith("lead_note_"));
      assert.ok(note.data.authorId);

      const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const cbRes = await authed(`/leads/${crmLeadId}/callbacks`, {
        method: "POST",
        body: JSON.stringify({ title: "Call back in 2 days", dueAt, channel: "call", note: "ask about timing" })
      });
      const cb = (await cbRes.json()) as { data: JsonObject };
      assert.equal(cbRes.status, 200);
      callbackId = String(cb.data.id);
      assert.equal(cb.data.status, "open");
      assert.equal(cb.data.channel, "call");

      const detail = (await (await authed(`/leads/${crmLeadId}`)).json()) as {
        data: {
          lead: JsonObject;
          notes: JsonObject[];
          callbacks: JsonObject[];
          timeline: Array<{ type: string; text: string }>;
        };
      };
      assert.equal(detail.data.lead.id, crmLeadId);
      assert.equal(detail.data.notes.length, 1);
      assert.equal(detail.data.callbacks.length, 1);
      const types = detail.data.timeline.map((e) => e.type);
      assert.ok(types.includes("created"));
      assert.ok(types.includes("note"));
      assert.ok(types.includes("callback_scheduled"));
      assert.ok(types.includes("stage_change"));
      // Newest-first: every entry's timestamp is >= the next one's.
      const ats = detail.data.timeline.map((e) => (e as { at: string }).at);
      for (let i = 1; i < ats.length; i += 1) {
        assert.ok(ats[i - 1] >= ats[i]);
      }
    });

    it("rejects a callback with an invalid channel or bad date", async () => {
      const badChannel = await authed(`/leads/${crmLeadId}/callbacks`, {
        method: "POST",
        body: JSON.stringify({ title: "x", dueAt: new Date().toISOString(), channel: "carrier_pigeon" })
      });
      assert.equal(badChannel.status, 400);

      const badDate = await authed(`/leads/${crmLeadId}/callbacks`, {
        method: "POST",
        body: JSON.stringify({ title: "x", dueAt: "not-a-date", channel: "call" })
      });
      assert.equal(badDate.status, 400);
    });

    it("lists open callbacks enriched with leadName + leadPhone", async () => {
      const body = (await (await authed("/lead-callbacks?status=open")).json()) as {
        data: Array<{ id: string; status: string; leadName?: string; leadPhone?: string }>;
      };
      const mine = body.data.find((entry) => entry.id === callbackId);
      assert.ok(mine, "open callback should be listed");
      assert.equal(mine?.status, "open");
      assert.equal(mine?.leadName, "CRM Lead");
      assert.equal(mine?.leadPhone, "+919766600001");
      assert.ok(body.data.every((entry) => entry.status === "open"));
    });

    it("marks a callback done (sets completedAt) and drops it from the open list", async () => {
      const res = await authed(`/lead-callbacks/${callbackId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" })
      });
      const body = (await res.json()) as { data: JsonObject };
      assert.equal(res.status, 200);
      assert.equal(body.data.status, "done");
      assert.ok(body.data.completedAt, "completedAt should be set when done");

      const open = (await (await authed("/lead-callbacks?status=open")).json()) as {
        data: Array<{ id: string }>;
      };
      assert.ok(!open.data.some((entry) => entry.id === callbackId), "done callback drops from open list");

      // The completed callback now appears in the lead's timeline.
      const detail = (await (await authed(`/leads/${crmLeadId}`)).json()) as {
        data: { timeline: Array<{ type: string }> };
      };
      assert.ok(detail.data.timeline.some((e) => e.type === "callback_done"));
    });
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
