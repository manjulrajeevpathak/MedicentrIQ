# Testing WhatsApp Cloud locally — no deploy needed

Two tiers. Both run against your laptop; nothing is deployed.

## Prereqs (both tiers)

- core-api on :4100 and integration-gateway on :4105 running locally.
  Gateway env: `CORE_API_URL=http://127.0.0.1:4100`, `SERVICE_API_KEY=<core-api's CORE_API_SERVICE_KEY>`.

## Tier 1 — simulated Meta (no Meta account at all)

`scripts/simulate-whatsapp.mjs` fires **correctly-signed** webhooks through the
real path (public route on the gateway → HMAC verify in core-api → inbound
pipeline), then prints the message log, inbox handoff, and opt-out effects.

```bash
# Patient question → assistant reply (or Inbox handoff if assistant off/no key)
node scripts/simulate-whatsapp.mjs --text "What are your OPD timings?"

# Opt-out / opt-in flows
node scripts/simulate-whatsapp.mjs --text STOP --from 919812340002
node scripts/simulate-whatsapp.mjs --text START --from 919812340002

# Delivery receipt: upgrade an outbound message sent→delivered→read
node scripts/simulate-whatsapp.mjs --status delivered --wamid <providerId>

# Another tenant (real App secret required if one is configured)
node scripts/simulate-whatsapp.mjs --tenant org_x --user user_x_admin --secret <appSecret> --text "hi"
```

Defaults: demo tenant. If WhatsApp Cloud isn't configured it provisions
clearly-fake local-sim creds (signing secret `local_sim_secret`) so the
pipeline runs. Outbound replies log as **failed** with fake creds — the reply
*text* is still exactly what would be sent.

**To test the chatbot's actual answers:** add `ANTHROPIC_API_KEY=` to
core-api/.env (operator does this), enable + configure the Assistant page,
then simulate questions — the assistant's replies appear in the message log.

What this tier covers: signature verification, inbound logging + dedupe,
STOP/START suppression, assistant replies + Inbox handoff, receipt upgrades,
campaign opt-out skipping. What it can't: real delivery to a phone, template
approval, the 24h window.

## Tier 2 — real Meta from your laptop (tunnel + free test number)

Meta needs a public HTTPS callback URL; a tunnel makes your laptop that URL.

1. **Tunnel** (in order of reliability):
   - **cloudflared (recommended)** — installed at `~/.local/bin/cloudflared`
     (official binary; Homebrew on this machine predates macOS 26 and can't
     install it):
     `~/.local/bin/cloudflared tunnel --url http://localhost:4105 --no-autoupdate`
     → prints `https://<random>.trycloudflare.com`. Free, no account, stable
     for a whole session; new URL on each restart.
   - `npx localtunnel --port 4105` → `https://<x>.loca.lt`. Works but flaky in
     practice (sessions die silently with 408s, `--subdomain` pins aren't
     honored) — fallback only.
   - ngrok: this machine's free account/static domain is already used by
     another project's tunnel (port 3030) — don't reuse it for the gateway
     without coordinating; free plan = one domain.
2. Set `NEXT_PUBLIC_GATEWAY_URL=<tunnel URL>` in staff-web/.env.local and
   restart staff-web — the Channels card + setup guide then show the real
   copy-ready webhook URL per hospital.
3. Follow the in-app **Setup guide** (Channels → WhatsApp Business (Meta)) —
   with Meta's **free test number** you skip business verification entirely:
   add up to 5 test recipients (your own phones) and go straight to webhook
   config + sends.
4. Now everything is REAL: message the number from your phone → chatbot
   answers on WhatsApp; send `hello_world` template campaigns; STOP/START;
   delivered/read receipts tick up in the message log.

Caveats: keep the tunnel process running while testing; a restarted
localtunnel gets a NEW URL → update Meta's webhook config + .env.local.
Tunnels are for testing — production still needs the gateway deployed.

## Quick health checks

```bash
curl http://127.0.0.1:4105/health                # gateway up
curl "<tunnel>/health"                            # public path up
curl "<tunnel>/webhooks/meta/whatsapp/<tenantId>?hub.mode=subscribe&hub.verify_token=<verifyToken>&hub.challenge=ping"
# → prints "ping" when the verify token matches (what Meta checks on save)
```
