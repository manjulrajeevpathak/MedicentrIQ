# HealthOS Clinician PWA

An installable, mobile-first PWA for doctors and clinic staff to find a patient,
view and add clinical history, upload documents (prescriptions / discharge
summaries / labs), and record a visit disposition.

Independent app (own `package.json` / deps / tsconfig) — it does **not** import
from sibling services. It talks to `core-api` over HTTP.

## Run locally

```bash
export PATH="/Users/maverick/.nvm/versions/node/v22.14.0/bin:$PATH"   # Node 22
npm install
npm run dev            # http://localhost:3203
```

`core-api` must be reachable at `NEXT_PUBLIC_CORE_API_URL` (default
`http://localhost:4100`). See `.env.local`.

## Auth

Login posts to `POST /auth/login`. On the simple `{token}` path the bearer is
stored in an httpOnly cookie `hcos_clinician_session`; the `{mfaRequired}` path
shows an OTP field that posts to `POST /auth/login/verify-otp`. `middleware.ts`
redirects signed-out users to `/login`. All core-api calls run server-side and
attach the cookie bearer.

## PWA

`public/manifest.webmanifest` + `public/sw.js` (cached app shell, network-first;
API calls never cached) registered from `src/components/sw-register.tsx`.
