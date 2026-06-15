# Integration Gateway

External integration gateway for HealthcareOS.

This service is independently deployable. It does not import shared runtime packages and does not require a root workspace.

## Purpose

The gateway currently normalizes communication-first events into HealthcareOS-shaped events:

- WhatsApp inbound messages
- telephony missed calls
- payment events

HIS/EMR and LIS/RIS adapters are intentionally deferred for the current pilot scope.

Events are always kept in the local in-memory event log. When `CORE_API_URL` is configured, normalized events are also forwarded to:

```text
POST /service-events/integration
```

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

The service listens on `PORT` or `4105`.

## Auth

- `SERVICE_API_KEY` unset: demo mode; `/health` reports `authMode: "demo"`.
- `SERVICE_API_KEY` set: every non-health endpoint requires `x-service-api-key`.
- The same key is sent to `CORE_API_URL` forwarding calls when configured.

## Endpoints

```text
GET  /health
GET  /adapters
GET  /events
GET  /events/:id
POST /webhooks/whatsapp
POST /webhooks/telephony/missed-call
POST /webhooks/payments/event
```

## Example

```bash
curl -s http://localhost:4105/webhooks/whatsapp \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tenant-demo-001","from":"+919999999999","text":"Need to book an appointment tomorrow"}'
```
