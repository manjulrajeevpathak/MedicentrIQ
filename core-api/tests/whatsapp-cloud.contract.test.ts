import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService, type CoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

/**
 * WhatsApp Cloud API contract: channel config redaction, webhook verification
 * handshake, signed inbound processing (message log + STOP opt-outs + inbox
 * handoff + status upgrades), and opt-out enforcement on sends. No live Meta
 * calls are made for the assertions below (replies to inbound messages are
 * attempted and tallied as failed with the fake creds, which is expected).
 */
describe("whatsapp cloud contract", () => {
  let server: Server;
  let service: CoreService;
  let baseUrl: string;
  let token: string;
  const TENANT = "org_demo_healthcare";
  const APP_SECRET = "test_app_secret_123";
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.ANTHROPIC_API_KEY; // assistant unavailable → handoff path
    process.env.STAFF_SESSION_SECRET = "whatsapp_cloud_contract_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";
    service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);

    const res = await fetch(`${baseUrl}/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT, userId: "user_demo_admin", expiresInSeconds: 900 })
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

  const sign = (rawBody: string) => `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;

  const inboundPayload = (wamid: string, from: string, text: string) =>
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "911140000000", phone_number_id: "pn_123" },
                contacts: [{ profile: { name: "Test Patient" }, wa_id: from }],
                messages: [{ id: wamid, from, timestamp: "1700000000", type: "text", text: { body: text } }]
              }
            }
          ]
        }
      ]
    });

  it("PATCH /tenant/channels stores WhatsApp Cloud creds and redacts them on read", async () => {
    const res = await authed("/tenant/channels", {
      method: "PATCH",
      body: JSON.stringify({
        whatsappCloud: {
          phoneNumberId: "pn_123",
          wabaId: "waba_1",
          accessToken: "EAAG_very_secret_token_9876",
          appSecret: APP_SECRET,
          verifyToken: "verify_me_42",
          enabled: true
        }
      })
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: JsonObject };
    const wc = body.data.whatsappCloud as JsonObject;
    assert.equal(wc.configured, true);
    assert.equal(wc.enabled, true);
    assert.equal(wc.phoneNumberId, "pn_123");
    assert.equal(wc.wabaId, "waba_1");
    // Secrets never round-trip — only tails.
    assert.equal(wc.accessTokenTail, "…9876");
    assert.equal(String(wc.appSecretTail).startsWith("…"), true);
    assert.equal(JSON.stringify(body).includes("EAAG_very_secret_token_9876"), false);
    assert.equal(wc.webhookPath, `/webhooks/meta/whatsapp/${TENANT}`);
  });

  it("verifies the webhook subscription handshake by verify token", () => {
    assert.equal(service.verifyWhatsAppWebhook(TENANT, "subscribe", "verify_me_42", "challenge_1"), "challenge_1");
    assert.equal(service.verifyWhatsAppWebhook(TENANT, "subscribe", "wrong_token", "challenge_1"), null);
    assert.equal(service.verifyWhatsAppWebhook(TENANT, "unsubscribe", "verify_me_42", "challenge_1"), null);
  });

  it("rejects webhook posts with a bad signature", async () => {
    const raw = inboundPayload("wamid.bad_sig", "919812340001", "hello");
    const result = await service.processWhatsAppWebhook(TENANT, raw, "sha256=deadbeef");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "invalid_signature");
  });

  it("processes a signed inbound message: logs it and hands off to the inbox", async () => {
    const raw = inboundPayload("wamid.msg_001", "919812340001", "What are your OPD timings?");
    const result = await service.processWhatsAppWebhook(TENANT, raw, sign(raw));
    assert.equal(result.ok, true);
    assert.ok(result.handled >= 1);

    // Inbound row in the message log, deduped by wamid on redelivery.
    const context = service.authenticate({ authorization: `Bearer ${token}` });
    const messages = service.listMessages(context, 50);
    const inbound = messages.find((m) => m.providerId === "wamid.msg_001");
    assert.ok(inbound);
    assert.equal(inbound?.direction, "inbound");
    assert.equal(inbound?.status, "received");
    assert.equal(inbound?.body, "What are your OPD timings?");

    const again = await service.processWhatsAppWebhook(TENANT, raw, sign(raw));
    assert.equal(again.ok, true);
    const duplicates = service.listMessages(context, 100).filter((m) => m.providerId === "wamid.msg_001");
    assert.equal(duplicates.length, 1);

    // Assistant is unavailable (no API key) → a WhatsApp interaction lands in the inbox.
    const interactions = (await (await authed("/interactions")).json()) as { data: JsonObject[] };
    const handoff = interactions.data.find(
      (i) => i.channel === "whatsapp" && String(i.from ?? "") === "919812340001"
    );
    assert.ok(handoff, "expected an inbox interaction for the inbound WhatsApp message");
  });

  it("STOP creates an opt-out; campaigns then skip that phone; START clears it", async () => {
    const stopRaw = inboundPayload("wamid.msg_stop", "919812340002", "STOP");
    const result = await service.processWhatsAppWebhook(TENANT, stopRaw, sign(stopRaw));
    assert.equal(result.ok, true);

    const optOuts = (await (await authed("/tenant/opt-outs")).json()) as { data: JsonObject[] };
    const entry = optOuts.data.find((o) => o.phone === "9812340002");
    assert.ok(entry, "expected an opt-out for the STOP sender");
    assert.equal(entry?.reason, "stop_message");

    // A campaign targeting a lead with that phone skips it entirely.
    const lead = await authed("/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Opted Out", phone: "+919812340002", source: "meta_ads" })
    });
    assert.equal(lead.status, 200);
    const create = await authed("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Optout check",
        channelType: "marketing",
        provider: "ultramsg",
        audience: { include: "leads", leadSources: ["meta_ads"] },
        body: "Hi {{name}}"
      })
    });
    const campaignId = String(((await create.json()) as { data: JsonObject }).data.id);
    const send = await authed(`/campaigns/${campaignId}/send`, { method: "POST" });
    const sendBody = (await send.json()) as { data: { sent: number; failed: number; skipped: number } };
    assert.equal(send.status, 200);
    assert.ok(sendBody.data.skipped >= 1, "opted-out recipient should be skipped, not attempted");

    // START clears the suppression.
    const startRaw = inboundPayload("wamid.msg_start", "919812340002", "START");
    await service.processWhatsAppWebhook(TENANT, startRaw, sign(startRaw));
    const after = (await (await authed("/tenant/opt-outs")).json()) as { data: JsonObject[] };
    assert.equal(after.data.some((o) => o.phone === "9812340002"), false);
  });

  it("status callbacks upgrade an outbound message sent→delivered→read (never downgrade)", async () => {
    // Seed an outbound log row by hand via the service's data path: send will fail
    // against fake creds, so instead simulate the sent row through a status flow.
    const context = service.authenticate({ authorization: `Bearer ${token}` });
    const seeded = await service.processWhatsAppWebhook(
      TENANT,
      inboundPayload("wamid.msg_seed", "919812340003", "hi"),
      sign(inboundPayload("wamid.msg_seed", "919812340003", "hi"))
    );
    assert.equal(seeded.ok, true);
    // The auto-reply attempt above logged an OUTBOUND row (failed, fake creds) —
    // give it a providerId so the status callback can find it.
    const outbound = service
      .listMessages(context, 50)
      .find((m) => m.direction === "outbound" && m.channel === "whatsapp_cloud");
    assert.ok(outbound, "expected an outbound reply attempt to be logged");
    outbound!.status = "sent";
    outbound!.providerId = "wamid.out_001";

    const statusPayload = (status: string) =>
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: { display_phone_number: "911140000000", phone_number_id: "pn_123" },
                  statuses: [{ id: "wamid.out_001", status, timestamp: "1700000100", recipient_id: "919812340003" }]
                }
              }
            ]
          }
        ]
      });

    let raw = statusPayload("delivered");
    await service.processWhatsAppWebhook(TENANT, raw, sign(raw));
    assert.equal(service.listMessages(context, 50).find((m) => m.providerId === "wamid.out_001")?.status, "delivered");

    raw = statusPayload("read");
    await service.processWhatsAppWebhook(TENANT, raw, sign(raw));
    assert.equal(service.listMessages(context, 50).find((m) => m.providerId === "wamid.out_001")?.status, "read");

    // A late "delivered" must not downgrade "read".
    raw = statusPayload("delivered");
    await service.processWhatsAppWebhook(TENANT, raw, sign(raw));
    assert.equal(service.listMessages(context, 50).find((m) => m.providerId === "wamid.out_001")?.status, "read");
  });

  it("blocks direct marketing sends to opted-out phones", async () => {
    const context = service.authenticate({ authorization: `Bearer ${token}` });
    await service.addOptOut(context, { phone: "+919812340009", reason: "manual" });
    const res = await authed("/messages/send", {
      method: "POST",
      body: JSON.stringify({ to: "+919812340009", type: "marketing", provider: "ultramsg", body: "promo" })
    });
    assert.equal(res.status, 400);
  });

  it("manages the assistant config (disabled by default, hospital-editable)", async () => {
    const initial = (await (await authed("/tenant/assistant")).json()) as { data: JsonObject };
    assert.equal(initial.data.enabled, false);

    const res = await authed("/tenant/assistant", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        instructions: "Be brief. OPD hours 9-5.",
        knowledge: [{ title: "Timings", content: "OPD Mon-Sat 9am-5pm" }],
        handoffKeywords: ["complaint"],
        handoffMessage: "Connecting you to our team."
      })
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(body.data.enabled, true);
    assert.equal((body.data.knowledge as JsonObject[]).length, 1);
    // No ANTHROPIC_API_KEY in this test env → runtime reports unavailable.
    assert.equal(body.data.available, false);
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
