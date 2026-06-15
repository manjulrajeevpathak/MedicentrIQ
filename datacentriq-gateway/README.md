# DatacentrIQ Gateway

Mock-but-structured DatacentrIQ intelligence gateway for HealthcareOS.

This service is independently deployable. It does not import shared runtime packages and does not require a root workspace.

## Purpose

The gateway gives HealthcareOS services one stable internal API for DatacentrIQ intelligence:

- Copilot-style summarization, drafting, and intent extraction.
- Control Tower-style prioritization, leakage detection, and next-best-action recommendations.
- Decision trace, source attribution, confidence, and fallback behavior on every intelligence response.

There are no real DatacentrIQ network calls yet. Responses are deterministic mock logic over supplied patient signals and local seed cases.

## Run Locally

```bash
npm install
npm run dev
```

The service listens on `PORT` or `4305`.

Optional environment:

```bash
cp .env.example .env
```

- `SERVICE_API_KEY`: when set, every non-health endpoint requires `x-service-api-key`.
- When `SERVICE_API_KEY` is unset, `/health` reports `authMode: "demo"` and non-health endpoints are open for local demos.

## Endpoints

```text
GET  /health
GET  /v1/capabilities
GET  /v1/mock/seed-patients
POST /v1/copilot/summarize
POST /v1/copilot/draft
POST /v1/copilot/extract-intent
POST /v1/control-tower/prioritize
POST /v1/control-tower/detect-leakage
POST /v1/control-tower/next-best-actions
```

## Example Requests

Summarize a seeded patient:

```bash
curl -s http://localhost:4305/v1/copilot/summarize \
  -H 'content-type: application/json' \
  -d '{"tenantId":"tenant-demo-001","requestActor":"staff-demo-001","patient":{"patientId":"pat-dia-002"},"summaryType":"patient_brief"}'
```

Extract intent:

```bash
curl -s http://localhost:4305/v1/copilot/extract-intent \
  -H 'content-type: application/json' \
  -d '{"text":"I need to reschedule my appointment and upload my HbA1c report tomorrow"}'
```

Prioritize patient queue:

```bash
curl -s http://localhost:4305/v1/control-tower/prioritize \
  -H 'content-type: application/json' \
  -d '{"objective":"follow_up","items":[{"patientId":"pat-eye-001"},{"patientId":"pat-dia-002"},{"patientId":"pat-mat-003"}]}'
```

Detect leakage:

```bash
curl -s http://localhost:4305/v1/control-tower/detect-leakage \
  -H 'content-type: application/json' \
  -d '{"leakageType":"all","items":[{"patientId":"pat-eye-001"},{"patientId":"pat-dia-002"}]}'
```

Next best actions:

```bash
curl -s http://localhost:4305/v1/control-tower/next-best-actions \
  -H 'content-type: application/json' \
  -d '{"objective":"recover_leakage","patient":{"patientId":"pat-eye-001"}}'
```

## Response Shape

Every intelligence endpoint returns:

```json
{
  "requestId": "req_example",
  "status": "ok",
  "task": "summarize",
  "confidence": 0.81,
  "data": {},
  "result": {},
  "sources": [],
  "decisionTrace": {
    "traceId": "trace_example",
    "mode": "mock",
    "policyVersion": "mock-healthcareos-datacentriq-2026-06-11",
    "generatedAt": "2026-06-11T00:00:00.000Z",
    "tenantId": "tenant-demo-001",
    "requestActor": "staff-demo-001",
    "steps": []
  }
}
```

If the context is too thin, the service returns `status: "fallback"` with conservative output and a `fallback` explanation.
