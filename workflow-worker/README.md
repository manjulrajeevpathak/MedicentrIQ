# Workflow Worker

Simulated durable workflow worker for HealthcareOS patient journeys.

This service is independently deployable. It does not import shared runtime packages and does not require a root workspace.

## Purpose

The worker exposes MVP workflow families for:

- appointment reminders
- no-show recovery
- post-visit follow-up
- pending diagnostics reminders
- SLA timers

When `CORE_API_URL` is configured, each started workflow sends a service callback to:

```text
POST /service-events/workflow-callback
```

The callback includes `tenantId`, `patientId`, `workflowType`, `runId`, and `emittedEvents`.

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

The service listens on `PORT` or `4104`.

## Auth

- `SERVICE_API_KEY` unset: demo mode; `/health` reports `authMode: "demo"`.
- `SERVICE_API_KEY` set: every non-health endpoint requires `x-service-api-key`.
- The same key is sent to `CORE_API_URL` callbacks when configured.

## Endpoints

```text
GET  /health
GET  /workflows
GET  /runs
GET  /runs/:id
POST /workflows/:type/start
POST /simulate/all
```

## Example

```bash
curl -s http://localhost:4104/workflows/appointment-reminder/start \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tenant-demo-001","patientId":"pat-eye-001","trigger":"appointment.booked"}'
```
