#!/usr/bin/env node
/**
 * Simulate Meta WhatsApp Cloud webhooks against the LOCAL stack — no Meta
 * account, no deploy. Sends a correctly-signed webhook through the real path
 * (integration-gateway → core-api HMAC verify → inbound pipeline) and prints
 * what happened (message log, assistant/inbox handoff, opt-outs).
 *
 * Prereqs: core-api (:4100) and integration-gateway (:4105) running locally.
 *
 * Usage:
 *   node scripts/simulate-whatsapp.mjs --text "What are your OPD timings?"
 *   node scripts/simulate-whatsapp.mjs --text STOP --from 919812340002
 *   node scripts/simulate-whatsapp.mjs --status delivered --wamid wamid.out_001
 *   node scripts/simulate-whatsapp.mjs --tenant org_x --user user_x_admin --secret <appSecret> --text "hi"
 *
 * Defaults target the demo tenant. If WhatsApp Cloud isn't configured for the
 * tenant, the script provisions FAKE placeholder creds (clearly non-real) with
 * a local signing secret so the pipeline can run. If REAL creds are already
 * configured, pass --secret with the App secret you entered in Admin →
 * Channels (we can't read it back — reads are redacted).
 */
import { createHmac } from "node:crypto";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const CORE = arg("core", "http://127.0.0.1:4100");
const GATEWAY = arg("gateway", "http://127.0.0.1:4105");
const TENANT = arg("tenant", "org_demo_healthcare");
const USER = arg("user", "user_demo_admin");
const FROM = arg("from", "919990001234");
const TEXT = arg("text", "");
const STATUS = arg("status", ""); // delivered | read | failed
const WAMID = arg("wamid", "");
let SECRET = arg("secret", "");

const LOCAL_SIM_SECRET = "local_sim_secret";
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

// -- health -------------------------------------------------------------------
for (const [name, url] of [["core-api", `${CORE}/health`], ["gateway", `${GATEWAY}/health`]]) {
  const ok = await fetch(url, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
  if (!ok) die(`${name} is not reachable at ${url}. Start it first.`);
}

// -- admin session (dev-only demo issuer) --------------------------------------
const sessionRes = await fetch(`${CORE}/auth/sessions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ tenantId: TENANT, userId: USER, expiresInSeconds: 600 })
});
if (!sessionRes.ok) die(`Could not mint a dev session for ${USER}@${TENANT} (is this a non-prod core-api?).`);
const token = (await json(sessionRes)).data.accessToken;
const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };

// -- ensure a signable channel config ------------------------------------------
const channels = (await json(await fetch(`${CORE}/tenant/channels`, { headers: H }))).data;
const wa = channels.whatsappCloud;
if (wa.configured && wa.enabled) {
  if (!SECRET) {
    if (wa.appSecretTail) {
      die(
        "WhatsApp Cloud is already configured with a real App secret. Pass --secret <the App secret you entered> so the simulated webhook signs correctly."
      );
    }
    SECRET = ""; // configured but no secret stored → core-api skips signature check
    console.log("• Channel configured without an App secret — signature check is skipped.");
  }
} else if (!wa.configured) {
  console.log("• WhatsApp Cloud not configured for this tenant — provisioning FAKE local-sim creds.");
  const res = await fetch(`${CORE}/tenant/channels`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({
      whatsappCloud: {
        phoneNumberId: "pn_local_sim",
        wabaId: "waba_local_sim",
        accessToken: "FAKE_local_sim_token",
        appSecret: LOCAL_SIM_SECRET,
        verifyToken: "local_sim_verify",
        enabled: true
      }
    })
  });
  if (!res.ok) die("Could not provision local-sim channel config.");
  SECRET = LOCAL_SIM_SECRET;
} else {
  // configured but disabled
  die("WhatsApp Cloud is configured but DISABLED for this tenant — enable it in Admin → Channels first.");
}
if (!SECRET && wa.configured && wa.appSecretTail) SECRET = LOCAL_SIM_SECRET;

// -- build the Meta payload -----------------------------------------------------
const now = Math.floor(Date.now() / 1000).toString();
const mkId = () => `wamid.sim.${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
let payload;
if (STATUS) {
  if (!WAMID) die("--status needs --wamid <providerId of an outbound message>.");
  payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "waba_local_sim", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "911140000000", phone_number_id: "pn_local_sim" },
      statuses: [{ id: WAMID, status: STATUS, timestamp: now, recipient_id: FROM }]
    } }] }]
  };
} else {
  if (!TEXT) die('Pass --text "…" (an inbound patient message) or --status/--wamid (a delivery receipt).');
  payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "waba_local_sim", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "911140000000", phone_number_id: "pn_local_sim" },
      contacts: [{ profile: { name: "Simulated Patient" }, wa_id: FROM }],
      messages: [{ id: mkId(), from: FROM, timestamp: now, type: "text", text: { body: TEXT } }]
    } }] }]
  };
}

// -- sign + send through the gateway (the REAL path Meta uses) -------------------
const raw = JSON.stringify(payload);
const headers = { "content-type": "application/json" };
if (SECRET) {
  headers["x-hub-signature-256"] = `sha256=${createHmac("sha256", SECRET).update(raw, "utf8").digest("hex")}`;
}
const hook = await fetch(`${GATEWAY}/webhooks/meta/whatsapp/${encodeURIComponent(TENANT)}`, {
  method: "POST",
  headers,
  body: raw
});
console.log(`• Webhook POST → gateway: HTTP ${hook.status}`);

// -- show what happened ----------------------------------------------------------
await new Promise((r) => setTimeout(r, 500));
const messages = (await json(await fetch(`${CORE}/messages?limit=6`, { headers: H }))).data ?? [];
console.log("\nMessage log (latest whatsapp_cloud rows):");
for (const m of messages.filter((m) => m.channel === "whatsapp_cloud").slice(0, 5)) {
  const dir = m.direction === "inbound" ? "⟵ inbound " : "⟶ outbound";
  console.log(`  ${dir} [${m.status}] ${m.to}: ${String(m.body ?? m.waTemplate ?? "").slice(0, 90)}`);
}
if (!STATUS) {
  const optouts = (await json(await fetch(`${CORE}/tenant/opt-outs`, { headers: H }))).data ?? [];
  const suppressed = optouts.find((o) => FROM.endsWith(o.phone));
  if (suppressed) console.log(`\nOpt-out: ${suppressed.phone} (${suppressed.reason}) — campaigns will skip this number.`);
  const interactions = (await json(await fetch(`${CORE}/interactions`, { headers: H }))).data ?? [];
  const handoff = interactions.find((i) => i.channel === "whatsapp" && String(i.from ?? "").includes(FROM.slice(-10)));
  if (handoff) console.log(`Inbox handoff: "${handoff.subject}" (status: ${handoff.status}) — visible in Unified Inbox.`);
}
console.log(
  "\nNotes: outbound replies show [failed] when creds are the local-sim fakes (no real Graph API behind them) — the reply TEXT above is still exactly what would be sent. Add ANTHROPIC_API_KEY to core-api/.env and enable the Assistant to see real bot replies."
);
