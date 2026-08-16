# Running MedicentrIQ with Docker

A single `docker compose` stack builds and runs all seven services plus Postgres.

## Quick start

```bash
cp .env.example .env      # then edit the secrets marked "change me"
docker compose build      # builds all 7 images (first run is slow: npm ci ×7)
docker compose up -d
docker compose ps         # wait for core-api / postgres to show "healthy"
```

Then open:

All four frontends are served by **one** `web` service under path prefixes:

| Surface           | URL                                  |
|-------------------|--------------------------------------|
| Staff console     | http://localhost:3000/staff          |
| Patient link      | http://localhost:3000/care?token=…   |
| Platform console  | http://localhost:3000/console        |
| Clinician PWA     | http://localhost:3000/clinician      |
| core-api (health) | http://localhost:4100/health         |

`/` redirects to `/staff`. (If host port 3000 is taken, set `WEB_PORT` in `.env`.)

Useful commands:

```bash
docker compose logs -f core-api     # follow one service
docker compose up -d --build staff-web   # rebuild + restart one service
docker compose down                 # stop (keeps the Postgres + uploads volumes)
docker compose down -v              # stop AND wipe all data
```

## What's in the stack

- **postgres** — the datastore. Data persists in the `pgdata` named volume.
- **core-api** (:4100) — the primary API. On first boot it creates its table and
  seeds demo data. Reads/writes all state; runs the reminder/campaign schedulers.
- **workflow-worker** (:4104), **integration-gateway** (:4105) — service-edge helpers.
- **web** (:3000) — one Next.js app serving all four frontends under path prefixes
  (`/staff`, `/console`, `/clinician`, `/care`). It calls core-api **server-side**
  over the internal `core-api:4100` address, so nothing sensitive is exposed to the
  browser. Point one domain at this single service.

Uploaded documents land in the `core-uploads` volume unless you configure S3
(`S3_BUCKET` + `S3_REGION` + AWS creds in `.env`), which is recommended for prod.

## Critical constraint: core-api is a singleton

core-api keeps all application state in the memory of a single process (diffed to
Postgres) and runs its schedulers in-process. **Do not run more than one core-api
instance** — a second one causes split-brain lost updates and double-sent
reminders/campaigns. Never add `deploy.replicas > 1` or `docker compose up
--scale core-api=2`. Horizontal scale-out needs an architectural change first.

## Before exposing this to the internet

This compose file gets the stack **running**; it is not a hardened production
deployment. At minimum, first:

1. **Replace every secret** in `.env` (`STAFF_SESSION_SECRET`, `PLATFORM_API_KEY`,
   the service keys, `POSTGRES_PASSWORD`) with strong random values, and rotate the
   seeded demo staff/admin passwords on first login.
2. Put a **TLS-terminating reverse proxy** (Caddy / nginx / Traefik) in front —
   the app serves plain HTTP and has no built-in rate limiting or request-body cap.
3. Set `ALLOW_DEMO_AUTH_FALLBACK=false` and keep the `x-demo-*` auth headers off
   any public path.
4. Configure **S3** for documents and a **managed Postgres with backups/PITR**
   (or back up the `pgdata` volume) — a container-local DB is a single point of loss.
5. Point `STAFF_WEB_URL` / `PATIENT_WEB_URL` / `PLATFORM_CONSOLE_URL` at your real
   hostnames so email links and confirm deep-links resolve.

See the readiness notes in chat for the full go/no-go list (auth-bypass headers,
plaintext channel secrets, observability, and horizontal-scale limits).
