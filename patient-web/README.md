# patient-web

Next-generation patient and caregiver mobile web surface for HealthcareOS — the
secure-link journey patients open from WhatsApp/SMS, rebuilt on the refined-clinical
design system (light-only, large type, big tap targets).

Independent deployable service; design tokens are copied from staff-web, not
imported (services share no code by architecture rule).

## Run

```bash
npm install
npm run dev        # http://localhost:3201/?token=mls_demo_anita
```

Without a backend it renders the rich demo session (caregiver Rohit acting for
post-op patient Anita Sharma — same household as the staff console demo).
To connect live:

```bash
NEXT_PUBLIC_CORE_API_URL=http://localhost:3000 npm run dev
```

Uses the same governed `mobile-link-sessions` endpoints as patient-web v1
(load session, confirm appointment, reschedule request, checklist, document
metadata, follow-up response, consent, opt-out).

## Surface

One mobile-first journey: trust header → caregiver banner → vernacular greeting →
progress steps → appointment confirm/reschedule → recovery (follow-up) check →
pre-visit checklist → document requests → consent & opt-out → secure-link
details → sticky call-the-care-team footer. Expired/revoked links render a safe
fallback with a call CTA.
