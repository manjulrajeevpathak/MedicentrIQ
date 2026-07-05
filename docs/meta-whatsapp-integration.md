# Meta WhatsApp Cloud API — Integration Guide

How to connect a hospital's WhatsApp Business Account (WABA) directly to
MedicentrIQ via Meta's Cloud API — no BSP, no per-message middleman tax.

**Two tracks run in parallel:**

- **Track 1 (per hospital, works today):** the hospital creates its own Meta
  app + WABA and pastes four values into *Admin → Integrations*. 30–60 minutes
  guided. This is the path documented in detail below.
- **Track 2 (platform, one-time):** MedicentrIQ becomes a **Meta Tech Provider**
  so hospitals can later connect with one OAuth click (Embedded Signup) instead
  of pasting credentials. Checklist at the end. Nothing in Track 1 is throwaway —
  the API calls are identical; only credential acquisition changes.

> **Security rule:** credentials are always entered by the hospital operator in
> the Admin UI. They are stored per-tenant in core-api, never committed to files,
> never displayed back (only redacted tails like `…9876`).

---

## Part 1 — What you end up with

| Value | What it is | Where it comes from |
|---|---|---|
| **Phone Number ID** | Graph API ID of the WhatsApp business number (not the number itself) | Meta app → WhatsApp → API Setup |
| **WABA ID** | WhatsApp Business Account ID (templates live here) | Same screen |
| **Access Token** | Permanent system-user token with WhatsApp scopes | Business Settings → System Users |
| **App Secret** | Verifies webhook signatures (`X-Hub-Signature-256`) | App Settings → Basic |
| **Verify Token** | Any string you invent; entered in both Meta and MedicentrIQ | You choose it |
| **Webhook URL** | `https://<gateway-host>/webhooks/meta/whatsapp/<tenantId>` | Shown in Admin → Integrations |

---

## Part 2 — Step by step (per hospital)

### Stage A — Meta Business Portfolio (~10 min, hospital owner)

1. Go to **business.facebook.com** → log in with the hospital's Facebook account
   (create one if needed — use an owner/admin's real account; Meta dislikes
   throwaway accounts).
2. **Create a Business Portfolio** if the hospital doesn't have one: business
   name exactly as legally registered, business email on the hospital's domain
   if possible.
3. (Strongly recommended, required for volume) **Start Business Verification**:
   *Business Settings → Security Centre → Start Verification*. Upload
   incorporation/registration proof (GST certificate, certificate of
   incorporation, utility bill matching the legal name + address). Takes days to
   ~2 weeks — **start it now**, everything else can proceed while it's pending.

### Stage B — Meta App (~10 min, developer/operator)

4. Go to **developers.facebook.com** → *My Apps → Create App*.
5. Choose use case **"Other"** → type **Business** → name it e.g.
   `<Hospital> WhatsApp` → link it to the Business Portfolio from Stage A.
6. On the app dashboard, find **WhatsApp** → *Set up*. This auto-creates a
   **test WhatsApp Business Account** with a free **test phone number**.
7. Open **WhatsApp → API Setup**. Note the **Phone Number ID** and
   **WhatsApp Business Account ID** shown there — with the test number you can
   already message up to **5 verified test recipients** (add them on that page;
   each confirms via OTP). This is your day-one sandbox.

### Stage C — The real phone number (~15 min)

8. Requirements for the number that becomes the hospital's WhatsApp line:
   - It must **not** be registered on the WhatsApp consumer app or the small
     business (WhatsApp Business) app. If it is, delete that account first
     (WhatsApp app → Settings → Account → Delete account — this only removes
     WhatsApp registration, not the SIM/number).
   - It must be able to receive an **SMS or voice call OTP** once (a landline
     with voice works).
9. In **WhatsApp → API Setup → Add phone number**: enter display name (shown to
   patients — e.g. "Trayajyoti Eye Hospital"), category *Medical & Health*,
   the number, and complete the OTP. Meta reviews the **display name** (usually
   quick; it must plausibly match the business).
10. Select the new number in API Setup — note its **Phone Number ID** (this
    replaces the test number's ID in MedicentrIQ later). The **WABA ID** stays
    the same screen, top dropdown.

### Stage D — Permanent access token (~10 min) ⚠ most-skipped step

The token shown on the API Setup page is **temporary (24h)** — do not use it.
Create a permanent **System User** token instead:

11. **business.facebook.com → Settings (gear) → Users → System users → Add.**
    Name e.g. `medicentriq-integration`, role **Admin**.
12. On the system user → **Add Assets**: assign the **App** (full control) and
    the **WhatsApp Account (WABA)** (full control).
13. **Generate New Token** → pick the app → token expiration **Never** →
    permissions: check **`whatsapp_business_messaging`** and
    **`whatsapp_business_management`** → Generate.
14. Copy the token **once** — Meta never shows it again. The operator pastes it
    directly into MedicentrIQ (next stage); do not email/WhatsApp it around.

### Stage E — App Secret

15. App dashboard → **App settings → Basic** → **App Secret → Show** (asks for
    the Facebook password). Copy it.

### Stage F — Enter everything in MedicentrIQ (~5 min)

16. Staff console → **Admin → Integrations → WhatsApp Business (Meta)**:
    - Phone Number ID (from Stage C, step 10)
    - WABA ID
    - Access Token (Stage D)
    - App Secret (Stage E)
    - **Verify Token**: invent any string, e.g. `trayajyoti-wa-2026` — you'll
      type the same string into Meta in the next stage
    - Enabled: on → **Save**.
17. The card now shows the **Webhook callback URL** for this hospital:
    `https://<gateway-host>/webhooks/meta/whatsapp/<tenantId>` — copy it.

### Stage G — Webhook (inbound messages + delivery receipts) (~5 min)

18. Meta app dashboard → **WhatsApp → Configuration → Webhook → Edit**:
    - **Callback URL**: paste the URL from step 17
    - **Verify token**: the exact string from step 16
    - Save. Meta immediately sends a GET handshake; MedicentrIQ answers it if
      the verify tokens match. If Meta says "couldn't validate": check the
      gateway is publicly reachable and the token matches character-for-character.
19. Still on that page, under **Webhook fields → Manage**: **Subscribe** to
    **`messages`** (this one field carries inbound messages *and* sent/delivered/
    read status callbacks).

### Stage H — First sends (verify end to end)

20. **Inbound + bot:** from any phone, WhatsApp the hospital's number, e.g.
    "What are your OPD timings?" → it should appear in the message log; if the
    Assistant is enabled it replies, otherwise it lands in **Unified Inbox**.
21. **Session send:** replying from MedicentrIQ within 24h of an inbound message
    works free-form (no template needed).
22. **Template send:** out of the box every WABA has the pre-approved
    `hello_world` template — create a campaign with provider *WhatsApp Cloud*,
    template `hello_world`, language `en_US`, and send to yourself.
23. **Opt-out:** reply **STOP** from your phone → you should get the
    unsubscribe confirmation, and the phone appears under opt-outs. Reply
    **START** to clear it.

### Stage I — Real marketing templates

24. There is ONE template library (**Communications → Templates**). Write the
    body with normal MedicentrIQ tokens (`{{patientName}}`, `{{branch}}`,
    `{{date}}` …) — the same template serves free-form session sends AND, once
    approved, out-of-window sends.
25. In the template editor, click **Submit to Meta** (pick MARKETING or
    UTILITY + language). Your named tokens are converted to Meta's positional
    `{{1}}/{{2}}` format automatically, with sample values attached for review.
    Approval is usually minutes-to-hours; **Sync Meta** refreshes statuses.
    Rejected → reword (common causes: vague placeholder-only bodies, prohibited
    claims, category mismatch) and re-submit.
26. Templates created directly in Meta's WhatsApp Manager (or the stock
    `hello_world`) appear under "On your WABA only" after a sync — import them
    into the library so everything stays in one list.
27. In a **Campaign**, pick provider *WhatsApp Cloud* and the approved
    template — params auto-personalize per recipient from the recorded token
    mapping (imported/positional templates ask for manual values).

### Volume & quality (what governs your 5–10k/month)

- **Unverified business:** ~250 business-initiated conversations/day.
- **Business verified (Stage A step 3):** 1,000/day, then auto-scales
  (10k → 100k) with good quality. 10k/month ≈ 330/day → verified tier is ample.
- **Quality rating** (WhatsApp Manager → phone number): drops when users block/
  report. Protecting it = real opt-in lists + honoring STOP (MedicentrIQ enforces
  the suppression list automatically) + useful content. A "Flagged" number gets
  its tier cut — treat quality as a first-class metric.
- **Cost:** Meta bills the hospital's WABA per marketing/utility message
  (marketing ≈ ₹0.78–0.88 in India; utility much cheaper; service replies inside
  the 24h window are free). Attach a payment method: WhatsApp Manager →
  Billing & payments.

---

## Part 3 — Platform prerequisites (MedicentrIQ side, one-time)

| Item | Why | Status |
|---|---|---|
| **Public HTTPS gateway** | Meta must reach `/webhooks/meta/whatsapp/:tenantId` | integration-gateway is built; deploy it (or `cloudflared tunnel --url http://localhost:4105` for dev) and set `NEXT_PUBLIC_GATEWAY_URL` in staff-web so the Admin card shows real URLs |
| Gateway env | forwards to core-api | `CORE_API_URL=http://<core-api>:4100`, `SERVICE_API_KEY=<matches core-api CORE_API_SERVICE_KEY>` |
| `ANTHROPIC_API_KEY` in core-api env | powers the WhatsApp Assistant | optional — without it, inbound messages go to the Inbox (`ASSISTANT_MODEL` overrides the default Haiku model) |

## Part 4 — Track 2: Direct Tech Provider (parallel paperwork)

Goal: replace Stage A–E with a "Connect WhatsApp" button (Embedded Signup).

1. **Verify MedicentrIQ's own business** in its Business Manager (same as
   Stage A step 3, for us).
2. Create the **platform Meta app** (Business type) owned by MedicentrIQ.
3. **App Review → Advanced Access** for `whatsapp_business_messaging` and
   `whatsapp_business_management` (screen recordings of the integration,
   privacy policy URL, data-handling answers).
4. Enroll as a **Tech Provider** (WhatsApp → Become a Tech Provider flow) —
   Meta reviews the business + use case.
5. Implement **Embedded Signup** (Facebook JS SDK popup in Admin → Integrations)
   → exchange the returned code for a business token → store the SAME four
   fields per tenant. The rest of the system is untouched.

## Part 5 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook "couldn't be validated" | Gateway not public / verify token mismatch / tenantId typo in URL | `curl https://<gateway>/health`; re-copy URL + token |
| Events arrive but rejected (`invalid_signature` in gateway logs) | App Secret wrong or from a different app | Re-copy App Settings → Basic → App Secret for the SAME app as the webhook |
| `(#131030) Recipient phone number not in allowed list` | Still on the test number | Add the recipient as test recipient, or switch to the real number |
| Template send fails `(#132001) template does not exist` | Name/language mismatch | Language must match exactly (`en` ≠ `en_US`); sync templates and re-pick |
| Free-form message never delivers | Outside the 24h service window | Use an approved template |
| Token suddenly invalid | Used the 24h temporary token | Do Stage D (system user, never-expiring) |
| `(#10) permission denied` on templates | Token missing `whatsapp_business_management` or WABA asset not assigned to system user | Regenerate token with both scopes after assigning assets |
| Sends capped at ~250/day | Business verification pending | Finish Security Centre verification |
| Number shows "Pending" | Display-name review | Wait/edit the display name to match the business |

---
*Written for the interim manual-credentials path (Variant A). When Embedded
Signup ships, Stages A–E collapse into one click and this doc shrinks to Stage
F–I.*
