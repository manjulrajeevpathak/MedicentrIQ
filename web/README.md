# staff-web

Next-generation staff operations console for HealthcareOS — a polished, production-grade
front end for the Patient Access & Continuity Platform.

Built as an independent, deployable service (no monorepo coupling), wired to `core-api`
with a rich demo-data fallback so it looks complete standalone.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with a hand-built design system (`globals.css` `@theme` tokens)
- **lucide-react** icons
- No runtime UI dependencies beyond `clsx` + `tailwind-merge`

## Run

```bash
npm install
npm run dev        # http://localhost:3200
```

Without a backend it serves the rich demo dataset. To connect to `core-api`:

```bash
NEXT_PUBLIC_CORE_API_URL=http://localhost:3000 npm run dev
```

Optional environment:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CORE_API_URL` | Base URL of `core-api`. Unset → demo mode. |
| `NEXT_PUBLIC_CORE_API_STAFF_SESSION_TOKEN` | Signed staff bearer session. |
| `NEXT_PUBLIC_DEMO_USER_ID` / `_TENANT_ID` / `_BRANCH_ID` | Demo auth headers. |

## Surfaces

| Route | Surface |
| --- | --- |
| `/today` | Daily briefing, metrics, priority work queue, patient focus |
| `/inbox` | Unified multi-channel conversation console with composer |
| `/patients` | Directory, Patient 360 timeline, household & identity matching |
| `/access` | Scheduling cockpit — slots, holds, mobile links, no-show risk |
| `/continuity` | Follow-up journeys, protocol checklists, leakage analysis |
| `/command` | Operations & care-impact analytics dashboard |
| `/operations` | Service health, control-tower signals, audit feed |
| `/admin` | Tenant, role & permission matrix, governance policy |

## Design system — "refined clinical"

- Tokens live in [`src/app/globals.css`](src/app/globals.css) (`@theme`): warm bone
  neutrals, deep ink, one blue brand family, semantic state colors. The `.dark`
  block re-points the same variables, so every utility themes automatically.
- **Dark mode** is a cookie (`hcos-theme`) read by the root layout (server-rendered
  `<html class="dark">`, no FOUC). Toggle lives in the topbar.
- Color discipline: decorative chips/charts are neutral or a blue ramp; saturated
  color is reserved for semantic state (critical/high/good). Severity also reads
  as a 3px left rail on queue rows.
- Primitives in [`src/components/ui`](src/components/ui): `Button`, `Badge`,
  `Avatar`, `Meter`, `Sparkline`, `Segmented`, `Panel`, `StatTile`, charts kit,
  `EmptyState`, `Toast`. Motion: `.stagger` entrance cascade, `.hover-lift`,
  `prefers-reduced-motion` respected.
- App shell (sidebar, topbar, ⌘K command palette, context
  switcher, theme toggle) in [`src/components/shell`](src/components/shell).

## Notes

- Permission-aware: actions the active role cannot perform render restricted with a
  visible reason. Switch roles via the avatar menu ("view as") — it flows through to
  server reads via a cookie.
- All staff actions route through `submitStaffAction`; in demo mode they resolve
  optimistically with a toast.
