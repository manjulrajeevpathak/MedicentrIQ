# Static / Mock Data Audit — MedicentrIQ portal (2026-06-27)

Audit of every portal surface: what is genuinely **LIVE** (from core-api) vs **STATIC** (hardcoded/mock in the frontend). Goal: eliminate fake data before real customers.

## Root cause (the one structural problem)

staff-web's `getDashboardData` (`staff-web/src/lib/core-api.ts:44-48`) does:

```js
{ ...mockDashboardData, ...data, source: "core-api" }
```

A **shallow merge that backfills every field core-api doesn't return with demo data** — silently. core-api's `getStaffDashboard` returns only: `metrics, workbench, inbox, patient360, accessQueue, followUpQueue, serviceStatus, auditEvents, entitlements, sessionUser`. Everything else (`daySummary, floorVitals, todayFlow, waitingRoom, needsPerson, directory, patientProfiles, matchCandidates`, and all nested timeline/slots/stages/protocol structures) is **mock-only**. A user cannot tell live from fake. Three surfaces (Campaigns, Leakage/ROI, Command) bypass core-api entirely and read hardcoded `analytics.ts / roi.ts / campaigns.ts` whose loaders just `return mockX` with no fetch.

## Verdict by surface

| Surface | Verdict | Detail |
|---|---|---|
| **platform-console** (superadmin) | ✅ **100% LIVE** | Every number/list from `/platform/*`. No mock module exists. Shows a real error banner on failure. |
| **staff-web → Admin** | ✅ **100% LIVE** | Rebuilt in P8: users/seats/MFA from `/users` + `/auth/me` via session. No mock. |
| **staff-web → Operations** | 🟡 **LIVE-capable** | serviceStatus, audit feed, risk signals are real *when core-api answers*; mock-merged fallback otherwise. |
| **staff-web → Inbox** | 🟡 **LIVE spine, fake depth** | Conversation list real (`inbox`); but message **threads** fall back to a fabricated 1-line stub, and patient-linking resolves against the mock `directory`. |
| **staff-web → Access** | 🟡 **LIVE queue, fake cockpit** | Request list real (`accessQueue`); but bookable **slots** are a sub-field core-api doesn't fill, and the "Access guidance" recommendation is a hardcoded `if/else` string. |
| **staff-web → Continuity** | 🟡 **LIVE queue, fake detail** | `followUpQueue` list is live-capable; stages/protocol/next-step/"analysis" are mock-shaped/client-generated. |
| **staff-web → Patients / Patient 360** | 🔴 **Mostly STATIC** | `directory, patientProfiles, timeline, household, matchCandidates` are **never returned by core-api** → mock even against a live API. |
| **staff-web → Today** | 🔴 **100% STATIC** | `daySummary, floorVitals` (142 expected / 6 waiting), `todayFlow` chart, `waitingRoom` (named patients), `needsPerson` — all mock. Only the staff member's name is real. |
| **staff-web → Journeys** | 🔴 **100% STATIC** | Standalone hardcoded `journeys.ts`; fake `getJourneyPacks()`; no API path. All actions are toasts/local state. |
| **staff-web → Campaigns** | 🔴 **100% STATIC** | `campaigns.ts`, no fetch. Delivery funnels, template usage, create/launch are local state. |
| **staff-web → Care recovery (Leakage)** | 🔴 **100% STATIC** | `analytics.ts`. Revenue-at-risk, worklist with rupee valuations, "+18%" delta is a hardcoded literal. |
| **staff-web → ROI + ROI Report** | 🔴 **100% STATIC** | `roi.ts`. **Board-facing, print-ready, "Confidential" report with fabricated attribution ledger & evidence chains** — and the printed report has NO "Modelled demo" badge. Highest-risk fake. |
| **staff-web → Command Center** | 🔴 **100% STATIC** | `analytics.ts`. Funnel, waterfall, retention, cohort heatmap, SLA grid, **named doctor-performance table** — all fabricated. Date-range selector is a no-op. |
| **patient-web** | 🔴 **Demo-first / mostly STATIC** | No `.env` → 100% mock by default. Even wired, provider/greeting/checklist/documents are always mock; identity/appointment/consent/actions are live-capable overlays on the mock scaffold. |

## Worst offenders (most misleading)

1. **ROI Board Report** (`/roi-report`) — fabricated financials + named attribution ledger, no demo badge on the printout.
2. **Command Center doctor-performance table** — five named doctors with fake bookings/conversion/₹revenue.
3. **Entire Today page** — the landing screen, 100% fake floor data.
4. **Hardcoded deltas** (`+18%`, `+4pt`, `-3pt`) — JSX string literals, never computed.
5. **Patient 360 timeline / identity-matching / household** — look like real clinical history; all canned.
6. **Inbox threads & Access slots** — the lists are real but the depth degrades to fabrication invisibly.

## Recommended remediation

**Step 0 — stop the silent backfill (highest leverage, ~1 change).** When `source === "core-api"`, do NOT merge `mockDashboardData`; render real values with proper empty states. This instantly makes a new empty tenant look correctly empty everywhere instead of fake-busy.

**Then, per fully-static surface — decide remove vs build:**
- **Remove/hide** (until real): ROI + ROI Report, Command Center, Campaigns, Leakage, Journeys, Today's floor widgets. Gate behind entitlements/"coming soon" or drop from nav so nothing fake ships.
- **Build real** (core-api endpoints + data models): the analytics/ROI/campaigns/journeys shapes are already typed (`AnalyticsData, RoiData, CampaignsData`) with a `source` discriminator and a single `getX()` seam — each needs a real endpoint and `source: "control-tower"`.

**Live-spine surfaces (Inbox/Access/Continuity/Patients):** extend `getStaffDashboard` to return the missing sub-fields (`directory, patientProfiles, threads, slots, stages, protocol, matchCandidates`) and remove the per-component mock fallbacks.

**Already clean:** platform-console, Admin. Leave as reference for "what real looks like."
