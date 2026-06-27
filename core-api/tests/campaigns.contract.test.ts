import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("campaigns contract", () => {
  let server: Server;
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
