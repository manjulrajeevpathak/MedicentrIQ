# MedicentrIQ Intelligence Reference

> Capture document for the AI / DatacentrIQ intelligence layer, written **before** it is
> stripped out of the codebase. Use this to rebuild a meaningful AI feature set later.

## 1. Purpose & status

This document captures the AI/intelligence feature set that existed in MedicentrIQ
(HealthcareOS) before the **clinical-baseline refactor (2026-06)** removed it. The AI
layer is being stripped so the platform can ship a clean clinical baseline first; the
intelligence is intended to be **re-added later behind the same interfaces**.

Two facts to keep front of mind:

- **All intelligence was a deterministic mock.** There was no real LLM, no model call,
  no network egress. The `datacentriq-gateway` service explicitly advertised
  `mode: "mock"` and `networkCalls: false`
  (`datacentriq-gateway/src/main.ts:57-58`). Every output came from hand-written
  heuristics over supplied patient signals plus three local seed cases
  (`datacentriq-gateway/src/seed.ts`).
- **The reusable value is the contract, not the heuristics.** The governance envelope
  (decision trace + confidence + sources + fallback), the workflow-embedded UX, and the
  single clean integration seam are the parts worth preserving. The keyword tables and
  scoring constants are placeholders that a real model should replace.

The design intent (workflow-first, human-in-the-loop, explainable, India-native) is
spelled out in `docs/product/flagship/ai-datacentriq-architecture.md`. That spec is the
"north star"; this document is the "as-built" record of what actually shipped against it.

### Service topology

```
staff-web (Next.js)                core-api (HTTP)                 datacentriq-gateway
─────────────────────              ───────────────                 ───────────────────
AI Workbench, Copilot dock,        /ai/recommendations*            /v1/copilot/*
inbox triage, day-summary    ──►   DatacentrIQClient        ──►    /v1/control-tower/*
(consume recommendations)          (one outbound client)           (deterministic mock)
```

- `datacentriq-gateway` is independently deployable, imports no shared packages, listens
  on `PORT` / `4305`, and optionally enforces `x-service-api-key`
  (`datacentriq-gateway/src/main.ts:28-35,138-146`).
- `core-api` consumed it through exactly one class, `DatacentrIQClient`
  (`core-api/src/integrations/outbound-clients.ts:39`), wired by
  `DATACENTRIQ_GATEWAY_URL` / `DATACENTRIQ_SERVICE_API_KEY`.

---

## 2. Capability catalog

Nine intelligence capabilities, split into **Copilot** (assistive, per-item) and
**Control Tower** (decisioning over queues/risk). All gateway routes are `POST` and
return the `IntelligenceResponse<T>` envelope (§3).

| Capability | Type | Endpoint | Inputs | Outputs | UI surface |
|---|---|---|---|---|---|
| **summarize** | Copilot | `/v1/copilot/summarize` | `patient: PatientSignal`, `summaryType` (`patient_brief`/`visit_brief`/`handoff`/`timeline`) | `SummaryResult` — title, summary, highlights[], risks[], recommendedFollowUps[] | Patient 360 brief, Copilot dock "Summarize" |
| **draft** | Copilot | `/v1/copilot/draft` | `patient`, `channel` (`whatsapp`/`sms`/`call_script`), `language`, `intent`, `tone` (`warm`/`formal`/`urgent`) | `DraftResult` — message, language, channel, `approvalRequired: true`, guardrails[] | Inbox reply draft, Copilot "Draft a Hindi reminder" |
| **extract-intent** | Copilot | `/v1/copilot/extract-intent` | `text: string`, optional `patient` | `ExtractIntentResult` — primaryIntent, secondaryIntents[], urgency, specialtyHint, entities, suggestedQueue | Inbox "DatacentrIQ triage" panel; called server-side by core-api on interaction intake |
| **explain-identity-match** | Copilot | `/v1/copilot/explain-identity-match` | `requester{phone,name,relationship,message}`, `candidates: IdentityCandidate[]` | `ExplainIdentityMatchResult` — requesterType, per-candidate confidence/recommendation/reasons/warnings | Identity resolution (designed; not a dedicated shipped screen) |
| **prioritize** | Control Tower | `/v1/control-tower/prioritize` | `items: PatientSignal[]`, `objective` (`follow_up`/`access`/`revenue`/`clinical_risk`) | `PrioritizeResult` — orderedItems[] with score, urgency, reasons[], recommendedOwnerRole | AI Workbench queue, daily workbench ranking |
| **detect-leakage** | Control Tower | `/v1/control-tower/detect-leakage` | `items: PatientSignal[]`, `leakageType` (`follow_up`/`diagnostics`/`procedure`/`payment`/`all`) | `LeakageResult` — items[] with leakageType, severity, evidence[], suggestedAction; totalDetected | Continuity workspace, Command Center leakage model |
| **next-best-actions** | Control Tower | `/v1/control-tower/next-best-actions` | `patient`, `objective` (`continue_care`/`convert_visit`/`recover_leakage`/`prepare_visit`) | `NextBestActionResult` — actions[] with ownerRole, urgency, rationale, draftAvailable | AI Workbench "Recommended action", Patient 360 |
| **access-next-actions** | Control Tower | `/v1/control-tower/access-next-actions` | `patient`, `accessRequest{specialty,preferredDoctor,preferredBranch,preferredDate,status,source}` | `AccessNextActionResult` — noShowRisk, recommendedQueue, slotStrategy, actions[] | Access workspace |
| **follow-up-leakage** | Control Tower | `/v1/control-tower/follow-up-leakage` | `patient`, `journey{type,stage,dueAt,lastContactAt,status}` | `FollowUpLeakageResult` — leakageDetected, severity, reasons[], recommendedOwnerRole, nextAction | Continuity / journey drop-off detection |

Two non-intelligence helper routes existed: `GET /v1/capabilities` (self-description)
and `GET /v1/mock/seed-patients` (`main.ts:111-126`).

`PatientSignal` (`types.ts:51-74`) is the shared input contract for almost every
capability: demographics, `messages[]`, `callNotes[]`, `appointmentStatus`,
`nextFollowUpAt`, `diagnoses[]`, `reports[]` (with `status: normal|abnormal|critical`),
`openTasks[]` (with `priority`), and `payments[]` (with `status: pending|paid|failed|waived`).

---

## 3. The governance contract (the part worth keeping)

Every intelligence endpoint returns the **same envelope**, regardless of capability. This
is the reusable design: it standardizes explainability, confidence, provenance, and
graceful degradation across all AI features. From `datacentriq-gateway/src/types.ts`:

```ts
export interface IntelligenceResponse<T> {
  requestId: string;                       // echoes caller's id or generates one
  status: "ok" | "fallback";               // fallback = thin context, conservative output
  task: CopilotTask | ControlTowerTask;    // which capability produced this
  confidence: number;                      // 0..1 (Copilot) or 0..100 (identity match)
  data: T;                                 // capability-specific result
  result?: T;                              // duplicate of `data` for caller compatibility
  sources: SourceRef[];                    // provenance: what signals were read
  decisionTrace: DecisionTrace;            // why this output was produced
  fallback?: { reason: string; behavior: string };
}

export interface SourceRef {
  id: string;
  type: "message" | "call_note" | "appointment" | "visit"
      | "report" | "task" | "payment" | "profile";
  label: string;
  excerpt?: string;
}

export interface DecisionTraceStep {
  id: string;
  label: string;       // plain-language step name shown to staff
  rationale: string;   // operational reason, NOT raw model reasoning
  weight?: number;
}

export interface DecisionTrace {
  traceId: string;
  mode: "mock";                 // engine/version marker — becomes real model id later
  policyVersion: string;        // "mock-healthcareos-datacentriq-2026-06-11"
  generatedAt: string;
  tenantId?: string;            // injected from request context
  requestActor?: string;        // injected from request context
  steps: DecisionTraceStep[];
}
```

Key behaviours of the envelope:

- **`data` and `result` are both populated** with the same object so downstream readers
  using either key keep working (`mock-intelligence.ts:480-491`). `DatacentrIQClient`
  read `result.data?.intent ?? result.data?.primaryIntent`
  (`outbound-clients.ts:62`).
- **Trace context is injected at the edge.** The gateway's `withTraceContext` merges
  `tenantId` and `requestActor` from the request body into `decisionTrace` only when the
  result already carries a trace (`main.ts:148-168`). Keep this pattern — the engine
  produces the trace, the transport layer stamps tenancy/actor.
- **Fallback is first-class.** When structured context is too thin (no sources, empty
  items, sub-3-char text), the capability returns `status: "fallback"`, a depressed
  confidence constant, conservative output, and a `fallback{reason, behavior}` block
  (`mock-intelligence.ts:993-1002`). Staff are told to verify rather than trust.

A future real implementation should keep this envelope verbatim and only swap `mode`
for the real model id, `policyVersion` for the real policy/prompt version, and the
`rationale` strings for model-grounded (but still non-raw) explanations.

### How core-api persisted it

`core-api` mapped intelligence output into a stored `AiRecommendation`
(`core-api/src/domain/types.ts:435-452`): `source: "copilot" | "control_tower"`,
`title`, `summary`, `priority`, `recommendedAction`, `confidence`, `traceId`,
`status: "received" | "accepted" | "dismissed" | "converted_to_task"`, `createdTaskId`,
`rawPayload`. Accepting a recommendation spawned a real task; dismissing recorded a
reason. All transitions were audited and reversible
(`core-service.ts:1809-1936`).

---

## 4. The `.ai-surface` convention (a UX principle to preserve)

staff-web enforces **one** distinctive visual treatment, reserved exclusively for
machine-generated content, so staff can always tell AI output from human output at a
glance. From `staff-web/src/app/globals.css:164-195`:

```css
/* AI signature material — the ONE distinctive treatment, reserved
   exclusively for AI-generated surfaces: a hairline iridescent border. */
.ai-surface { position: relative; background-color: var(--color-surface); }
.ai-surface::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg, #5f8ef7, #8b5cf6 55%, #06b6d4);   /* iridescent */
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none; opacity: 0.5;   /* 0.65 in dark mode */
}
.bg-ai-gradient { background: linear-gradient(135deg, #5f8ef7, #8b5cf6 55%, #06b6d4); }
```

**The principle:** AI content gets a hairline iridescent (blue→violet→cyan) border;
nothing human-authored uses it. The gradient also marks AI affordances
(`bg-ai-gradient` on the "Ask AI" button and Copilot dock header). Applied at:
inbox triage panel (`inbox-workspace.tsx:314`), Copilot answer bubbles
(`copilot-dock.tsx:155`), `/today` day summary (`today-dashboard.tsx:182`), continuity
and access workspaces. Preserve this rule when rebuilding — it is a trust and
disclosure mechanism, not decoration.

---

## 5. Mock heuristics reference (what signals mattered)

These are the deterministic rules in `datacentriq-gateway/src/mock-intelligence.ts`. A
real implementation should treat them as a **feature spec** — the signals that mattered —
not as logic to keep. Patients are hydrated by merging the request over a seed case when
`patientId` matches (`hydratePatient`, line 461).

**Shared signal predicates** (lines 957-967):
- `hasAbnormalReport` — any report `status` is `abnormal` or `critical`.
- `hasCriticalReport` — any report `status` is `critical`.
- `hasPendingPayment` — any payment `status` is `pending` or `failed`.

**`scorePatient` (prioritize)** — additive score from a base of **20** (lines 615-658):
no-show **+25**; critical report **+35** else abnormal report **+22**; pending payment
**+16** (**+28** when objective is `revenue`); high-priority open task **+18**;
`nextFollowUpAt` present **+10**; `clinical_risk` objective with any abnormal/critical
report **+18**. Score clamps to 0–100, then maps to urgency via `urgencyFromScore`
(lines 1012-1026): **≥85 critical, ≥65 high, ≥40 medium, else low**. Owner role is
chosen by `ownerForPatient` (lines 937-955): critical → doctor; abnormal report → nurse;
pending payment → care_coordinator; booked/no-show → front_desk; else call_center.

**`detectPatientLeakage` (detect-leakage / follow-up-leakage)** (lines 660-708) — emits
a `LeakageItem` per matched rule: no-show → `follow_up` severity **high**; abnormal
report → `diagnostics` severity **critical if critical-report else high**; pending
payment → `payment` severity **medium**; the substring `"surgery"` anywhere in patient
text → `procedure` severity **high**. Each item carries `evidence[]` and a
`suggestedAction`.

**`followUpLeakage`** (lines 419-459) layers journey state on top: overdue `dueAt` or
`journey.status === "missed"` or any leakage signal sets `leakageDetected`; severity
escalates to critical if any leakage item is critical, else high if overdue/high.
Confidence **0.82** when detected, **0.48** (fallback) when not.

**`inferIntentFromText` (extract-intent)** — first-match keyword table (lines 815-841):
post-op (`"after surgery"`, `"post-op"`, `"operation"…`) → `post_op_concern`;
booking words → `appointment_request`; report/test words (`"hba1c"`, `"scan"`, `"mri"…`)
→ `report_or_diagnostics_query`; risk words (`"pain"`, `"bleeding"`, `"breath"`,
`"emergency"…`) → `clinical_escalation`; payment words → `payment_or_insurance_query`;
medication words → `medication_query`; else `general_query`. Secondary intents add
doctor/language/caregiver context (lines 843-859).

**`inferUrgency`** (lines 861-875): `emergency|cannot breathe|chest pain|unconscious|critical`
→ **critical**; `pain|bleeding|fever|urgent|high sugar` → **high**;
`reschedule|report|payment|insurance` → **medium**; else **low**.

**`inferSpecialty`** (lines 877-899): patient specialty wins; else keyword map
(eye/cataract → Ophthalmology, sugar/hba1c → Diabetes, pregnancy/antenatal → Maternity,
kidney/dialysis → Nephrology). **`extractEntities`** (lines 901-915) regex-pulls Indian
mobile numbers (`\b[6-9]\d{9}\b`) and day/time-preference words.
**`queueForIntent`** (lines 917-935) routes critical → `clinical_escalation`,
appointment → `front_desk`, report/clinical → `nurse_review`, payment/insurance →
`billing_or_tpa`, else `general_patient_support`.

**`explainIdentityMatch`** (lines 274-360) — classifies requester as caregiver if
relationship words appear, else patient/unknown. Per candidate, base score **42**,
**+32** exact normalized phone match (last 10 digits), **+18** name-in-patient-name,
**+16** name-in-caregiver-name; warns on missing UHID and caregiver mismatch.
Confidence capped at 94; **≥78 → link, ≥55 → manual_review, else create_patient**.

**`accessNextActions`** (lines 362-417) — urgent if access text matches
`pain|urgent|emergency|post-?op|bleeding|breath|critical`; no-show risk high if
appointment is `no_show` or text says reschedule/missed/not confirm. Urgent requests
prepend a "route to nurse before booking" action and set queue `nurse_escalation`.

**Confidence constants** (the placeholder calibration to replace): summarize 0.46
fallback / `0.45 + 0.06·sourceCount` capped 0.88 otherwise; draft 0.42 / 0.76;
extract-intent 0.35 / 0.72; prioritize 0.38 / 0.79; detect-leakage 0.36 / 0.81;
next-best-actions 0.44 / 0.82; identity 0.34 / 0.78; access fixed 0.8.

A persistent **safety boundary** runs through all of it: drafts always set
`approvalRequired: true` with guardrails ("does not diagnose, prescribe, or replace
clinician advice"), and clinical-risk language always routes to a human, never to
autonomous action.

---

## 6. UI surfaces removed

staff-web surfaces that consumed AI output (all to be removed in the refactor):

- **AI Workbench** (`components/ai/ai-workbench.tsx`, route `/ai-workbench`) — the
  governance hub. Recommendation queue filterable by All / Approval / Auto-safe, stat
  tiles (open count, need-approval, auto-safe, avg confidence), and a detail pane showing
  recommended action, evidence, **Decision trace** (numbered timeline), **Sources &
  governance**, an Accept-&-create-task button gated on `ai:approve` permission, a
  Dismiss-with-reason menu (reasons feed "AI calibration"), and an **Outcome & feedback
  loop** tracking each recommendation through generated→shown→accepted→converted→observed
  with realised ₹ value.
- **Copilot dock** (`components/shell/copilot-dock.tsx`), opened via **⌘J / Ctrl-J**
  (`components/shell/app-shell.tsx:42`) — a right-side conversational panel branded
  "DatacentrIQ Copilot". Canned-answer matching by keyword overlap (`lib/copilot.ts`,
  `answerFor`) with seeded prompts ("Who is likely to drop off this week?", "Summarize
  Anita Sharma", "Draft a Hindi no-show reminder"). Answers render in `.ai-surface`
  bubbles with bullets, a suggested action, and citation badges. Footer disclaimer:
  "Copilot drafts and explains — actions still need staff approval."
- **Inbox triage / draft** (`components/inbox/inbox-workspace.tsx:312-337`) — per-thread
  "DatacentrIQ triage" `.ai-surface` panel showing `aiSummary`, detected intent,
  language, a confidence meter, and a "Routed by Copilot" badge. AI-authored internal
  notes render with a dashed brand border + Sparkles marker (line 349).
- **`/today` AI day-summary** (`components/today/today-dashboard.tsx:34,182`) — a natural
  day-summary line and an `.ai-surface` panel on the daily dashboard.
- **"Ask AI" button** (`components/shell/topbar.tsx:67-71`) — `bg-ai-gradient` topbar
  button (tooltip "Ask HealthcareOS Copilot (⌘J)") that opens the Copilot dock.
- **Command palette AI entries** (`components/shell/command-palette.tsx:24`,
  `app-shell.tsx:61`) — recommendations surfaced as ⌘K results linking into the Workbench.

core-api routes removed alongside these: `GET /ai/recommendations`,
`POST /ai/recommendations`, `POST /ai/recommendations/:id/actions`
(`core-api/src/http/router.ts:218-228`), plus the inline `extractIntent` enrichment of
inbound interactions (`core-service.ts:955-959`).

---

## 7. Rebuild guidance

**Keep (high-value, model-agnostic):**

1. **The `IntelligenceResponse<T>` envelope** (§3) — `requestId`, `status` ok/fallback,
   `task`, `confidence`, `data`/`result`, `sources[]`, `decisionTrace`, `fallback`. This
   is the contract every AI feature should still honour.
2. **The decision trace + sources** — explainability and provenance. A real model emits
   the same plain-language `steps[]` and `SourceRef[]`; never expose raw model reasoning,
   only operational rationale and the signals used.
3. **Fallback behaviour** — graceful degradation on thin context (conservative output +
   "verify with a human"). The same logic covers gateway-unavailable: hide AI, keep core
   workflows usable.
4. **The `.ai-surface` UX rule** (§4) — preserve the iridescent treatment as the
   exclusive marker of machine-generated content.
5. **Human-in-the-loop guardrails** — `approvalRequired` on every patient-facing draft,
   `ai:approve` permission gating, dismiss-with-reason, and the audited/reversible
   recommendation lifecycle.

**Replace:**

- The deterministic heuristics in `mock-intelligence.ts` with a real LLM (Claude) behind
  the **same** capability functions and the **same** envelope. Treat §5's keyword tables,
  scoring weights, and confidence constants as the labelled signal set the model should
  reason over and (for confidence) be calibrated against.
- `decisionTrace.mode` (`"mock"`) → real model id; `policyVersion` → real prompt/policy
  version; the per-capability confidence constants → model-derived, calibrated scores.

**The integration seam (single file):**

The clean re-add point is `core-api/src/integrations/outbound-clients.ts` — the entire
consumer side was **one class, `DatacentrIQClient`**, configured by env
(`DATACENTRIQ_GATEWAY_URL`, `DATACENTRIQ_SERVICE_API_KEY`) and feature-flagged by
`isConfigured` (truthy base URL). Every call already failed soft (returns `undefined` on
error; `core-service.ts:955` only enriches "when configured"). To restore AI, point that
client at a real intelligence service (gateway swapped from mock to LLM-backed, same
routes and envelope), re-expose the `/ai/recommendations*` routes, and re-mount the
staff-web surfaces from §6. No other module needs to know whether intelligence is mock,
LLM, or absent.

**Reference scenarios** to validate a rebuild (from the seed cases and the architecture
spec): Hinglish/regional appointment requests, shared family phone numbers,
patient/caregiver ambiguity, urgent-symptom escalation (optimise recall), no-show
recovery, abnormal-report-without-follow-up, and duplicate patient matching.
