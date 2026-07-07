import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService, type CoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("campaigns contract", () => {
  let server: Server;
  let service: CoreService;
  let baseUrl: string;
  let token: string;
  let campaignId: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "campaigns_contract_secret";
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

  it("lists the seeded demo campaign", async () => {
    const body = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((c) => c.id === "campaign_demo_001"));
  });

  it("creates a campaign", async () => {
    const res = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "New leads welcome",
        channelType: "transactional",
        audience: { include: "leads", leadStages: ["new", "contacted"] },
        body: "Hi {{name}}, thanks for your interest!",
        trigger: "manual"
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    campaignId = String(body.data.id);
    assert.ok(campaignId.startsWith("campaign_"));
    assert.equal(body.data.status, "draft");
    assert.equal(body.data.channelType, "transactional");
  });

  it("patches a campaign", async () => {
    const res = await authed(`/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New leads welcome v2", channelType: "marketing", aisensyCampaign: "welcome_tpl" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.name, "New leads welcome v2");
    assert.equal(body.data.channelType, "marketing");
    assert.equal(body.data.aisensyCampaign, "welcome_tpl");
  });

  it("previews a lead audience and returns a size from seeded leads", async () => {
    const res = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({ audience: { include: "leads", leadStages: ["new", "contacted"] } })
    });
    const body = (await res.json()) as { data: { size: number; sample: JsonObject[] } };
    assert.equal(res.status, 200);
    // Seeded leads include "new" (Sunita) and "contacted" (Imran).
    assert.ok(body.data.size >= 2);
    assert.ok(body.data.sample.length <= 5);
    assert.ok(body.data.sample.every((r) => r.kind === "lead"));
  });

  it("targets patients by recent OPD visit outcome (retargeting)", async () => {
    // Register + complete a visit for patient_demo_001 with outcome surgery_advised.
    const create = await authed("/visits", {
      method: "POST",
      body: JSON.stringify({ patientId: "patient_demo_001", chiefComplaint: "Cataract" })
    });
    const visitId = String(((await create.json()) as { data: JsonObject }).data.id);
    await authed(`/visits/${visitId}/clinical`, {
      method: "PATCH",
      body: JSON.stringify({ outcome: "surgery_advised" })
    });

    // A campaign audience of "surgery advised in the last 30 days" includes them.
    const hit = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({
        audience: { include: "patients", visitOutcomes: ["surgery_advised"], visitWithinDays: 30 }
      })
    });
    const hitBody = (await hit.json()) as { data: { size: number } };
    assert.ok(hitBody.data.size >= 1);

    // A different outcome excludes them.
    const miss = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({
        audience: { include: "patients", visitOutcomes: ["discharged"], visitWithinDays: 30 }
      })
    });
    const missBody = (await miss.json()) as { data: { size: number } };
    assert.equal(missBody.data.size, 0);
  });

  it("previews a patient audience filtered by tag", async () => {
    const res = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({ audience: { include: "patients", tags: ["cataract"] } })
    });
    const body = (await res.json()) as { data: { size: number; sample: JsonObject[] } };
    assert.equal(res.status, 200);
    // patient_demo_001 (Anita Sharma) is tagged "cataract".
    assert.ok(body.data.size >= 1);
    assert.ok(body.data.sample.every((r) => r.kind === "patient"));
  });

  it("de-dupes by phone across leads and patients", async () => {
    // lead_demo_004 (Anita Sharma) shares phone +919876543210 with patient_demo_001.
    const both = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({ audience: { include: "both" } })
    });
    const leadsOnly = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({ audience: { include: "leads" } })
    });
    const patientsOnly = await authed("/campaigns/preview-audience", {
      method: "POST",
      body: JSON.stringify({ audience: { include: "patients" } })
    });
    const bothSize = ((await both.json()) as { data: { size: number } }).data.size;
    const leadsSize = ((await leadsOnly.json()) as { data: { size: number } }).data.size;
    const patientsSize = ((await patientsOnly.json()) as { data: { size: number } }).data.size;
    // The shared phone collapses, so "both" is strictly fewer than the naive sum.
    assert.ok(bothSize < leadsSize + patientsSize);
  });

  it("sends a campaign with no channel configured — recipients fail gracefully", async () => {
    // The demo tenant has no UltraMsg/AISensy config, so every send fails per-recipient
    // but the campaign still completes (not a 500), tallying failed.
    const res = await authed(`/campaigns/${campaignId}/send`, { method: "POST" });
    const body = (await res.json()) as { data: { sent: number; failed: number; audienceSize: number } };
    assert.equal(res.status, 200);
    assert.ok(body.data.audienceSize >= 2);
    assert.equal(body.data.sent, 0);
    assert.ok(body.data.failed > 0);

    // The campaign is now marked sent with stats reflecting the failures.
    const list = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    const updated = list.data.find((c) => c.id === campaignId);
    assert.ok(updated);
    assert.equal(updated?.status, "sent");
    const stats = updated?.stats as JsonObject;
    assert.ok((stats.failed as number) > 0);
    assert.equal(stats.sent, 0);
    assert.ok(typeof stats.lastRunAt === "string");
  });

  it("previews an existing campaign's live recipients (ledger-aware)", async () => {
    const res = await authed(`/campaigns/${campaignId}/recipients`);
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    // The "New leads welcome" campaign targets new/contacted leads → matches seeded leads.
    assert.ok((body.data.audienceSize as number) >= 2);
    // Not a once-per-contact campaign, so everyone is eligible and nobody is skipped.
    assert.equal(body.data.sendOncePerContact, false);
    assert.equal(body.data.eligible, body.data.audienceSize);
    assert.equal(body.data.alreadyContacted, 0);
    assert.ok(Array.isArray(body.data.sample));
    assert.ok((body.data.sample as JsonObject[]).every((r) => typeof r.name === "string" && "alreadyContacted" in r));
  });

  it("returns campaign detail with effectiveness metrics", async () => {
    const res = await authed(`/campaigns/${campaignId}/detail`);
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    const d = body.data;
    assert.equal((d.campaign as JsonObject).id, campaignId);
    // delivery reflects the earlier failed send (no channel configured).
    const delivery = d.delivery as JsonObject;
    assert.ok((delivery.failed as number) > 0);
    assert.equal(delivery.sent, 0);
    assert.equal(delivery.deliveryRate, 0); // 0 / (0 + failed)
    // audience is broken down by lead stage/source.
    const audience = d.audience as JsonObject;
    assert.ok((audience.size as number) >= 2);
    assert.ok(Array.isArray(audience.byStage));
    assert.ok(Array.isArray(audience.bySource));
    // conversion proxy is present.
    const conversion = d.conversion as JsonObject;
    assert.ok(typeof conversion.leads === "number");
    assert.ok(typeof conversion.converted === "number");
  });

  it("creates a recurring campaign with a contact-once ledger", async () => {
    const res = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Weekly camp nurture",
        channelType: "marketing",
        provider: "ultramsg",
        audience: { include: "leads", leadSources: ["camp_self"] },
        body: "Hi {{name}}, a note from the camp team.",
        trigger: "manual",
        sendOncePerContact: true,
        schedule: { everyDays: 7, enabled: true }
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    // A live schedule surfaces as "scheduled"; the ledger starts empty.
    assert.equal(body.data.status, "scheduled");
    assert.equal(body.data.sendOncePerContact, true);
    assert.deepEqual(body.data.contactedPhones, []);
    const schedule = body.data.schedule as JsonObject;
    assert.equal(schedule.everyDays, 7);
    assert.equal(schedule.enabled, true);
    assert.ok(typeof schedule.nextRunAt === "string");
  });

  it("does NOT mark failed recipients in the contact-once ledger", async () => {
    // A once-per-contact campaign whose sends all fail (no channel) must leave the
    // ledger empty, so those recipients are retried next run rather than dropped.
    const create = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Once-per-contact",
        channelType: "transactional",
        audience: { include: "leads" },
        body: "Hi {{name}}",
        sendOncePerContact: true
      })
    });
    const id = String(((await create.json()) as { data: JsonObject }).data.id);
    const send = await authed(`/campaigns/${id}/send`, { method: "POST" });
    const result = (await send.json()) as { data: { sent: number; failed: number; skipped: number } };
    assert.equal(send.status, 200);
    assert.equal(result.data.sent, 0);
    assert.equal(result.data.skipped, 0); // ledger empty → nothing skipped this run
    assert.ok(result.data.failed > 0);

    const list = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    const updated = list.data.find((c) => c.id === id);
    // Nothing succeeded, so no phone was recorded.
    assert.deepEqual(updated?.contactedPhones, []);
  });

  it("runCampaignScheduler runs a due campaign and advances nextRunAt", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const create = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Due recurring",
        channelType: "transactional",
        audience: { include: "leads" },
        body: "Hi {{name}}",
        schedule: { everyDays: 3, enabled: true, nextRunAt: past }
      })
    });
    const id = String(((await create.json()) as { data: JsonObject }).data.id);

    const tally = await service.runCampaignScheduler();
    assert.ok(tally.ran >= 1);

    const list = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    const updated = list.data.find((c) => c.id === id);
    const schedule = updated?.schedule as JsonObject;
    // nextRunAt has been pushed into the future (advanced by everyDays from now).
    assert.ok(Date.parse(schedule.nextRunAt as string) > Date.now());
    assert.ok(typeof (updated?.stats as JsonObject)?.lastRunAt === "string");
  });

  it("fires an automated new_lead campaign when a matching lead is created", async () => {
    const create = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Auto welcome meta leads",
        channelType: "marketing",
        provider: "ultramsg",
        audience: { include: "leads", leadSources: ["meta_ads"] },
        body: "Hi {{name}}, welcome!",
        trigger: "automated",
        automatedOn: "new_lead"
      })
    });
    const campaign = ((await create.json()) as { data: JsonObject }).data;
    const id = String(campaign.id);
    // Automated campaigns are armed ("scheduled") by default so they fire.
    assert.equal(campaign.status, "scheduled");

    // Creating a matching lead should fire the campaign for that one lead.
    const lead = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Meta Lead", phone: "+919812300011", source: "meta_ads" })
    });
    assert.equal(lead.status, 200); // lead creation succeeds despite the send failing

    let list = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    let updated = list.data.find((c) => c.id === id);
    const stats = updated?.stats as JsonObject;
    assert.equal(stats.audienceSize, 1); // just the new lead
    assert.ok((stats.failed as number) >= 1); // no channel → send failed but was attempted
    const firedAt = stats.lastRunAt as string;
    assert.ok(typeof firedAt === "string");

    // A NON-matching lead (different source) must NOT re-fire the campaign.
    const other = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Google Lead", phone: "+919812300022", source: "google_ads" })
    });
    assert.equal(other.status, 200);
    list = (await (await authed("/campaigns")).json()) as { data: JsonObject[] };
    updated = list.data.find((c) => c.id === id);
    assert.equal((updated?.stats as JsonObject).lastRunAt, firedAt); // unchanged → did not fire
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
