# HealthcareOS Service Architecture

## Principle

HealthcareOS should be organized as a parent folder containing independent services at the root.

It should not behave like a package monorepo. There should be no root workspace package, no root dependency graph, and no shared runtime package that services import from.

Each service should own its runtime, package manifest, environment configuration, tests, deployment artifact, and local contracts. Business logic and types should stay inside the owning service unless a contract is generated into that service as part of an explicit integration workflow.

## Service Layout

```text
docs/
staff-web/
patient-web/
core-api/
workflow-worker/
integration-gateway/
datacentriq-gateway/
```

The root should stay boring. It may contain documentation and future cross-cutting operational folders such as `infra`, `.github`, or `scripts`, but deployable products should live as first-class root folders.

## Deployable Services

### staff-web

The staff operations web application.

Owns:

- Unified Patient Inbox UI
- Staff Daily Workbench UI
- Patient 360 UI
- Appointment and access workflow UI
- Follow-up journey UI
- Admin and configuration UI

Deployment:

- Independent web deployment
- Talks to `core-api`

### patient-web

The lightweight patient and caregiver mobile web surface opened from WhatsApp, SMS, or secure links.

Owns:

- Appointment confirmation
- Report and prescription uploads
- Pre-visit forms
- Follow-up confirmation
- Consent and opt-out actions
- Payment-link handoff

Deployment:

- Independent web deployment
- Talks to `core-api`

### core-api

The primary HealthcareOS product API.

Owns:

- Patient identity
- Family and caregiver model
- Inbox domain
- Appointment and access orchestration
- Care journey state
- Staff task state
- Patient 360 timeline
- Consent and audit
- Role-based access
- Public APIs consumed by `staff-web` and `patient-web`

Deployment:

- Independent API deployment
- Owns the primary operational database

### workflow-worker

The durable workflow execution service.

Owns:

- Appointment reminders
- No-show recovery
- Post-visit follow-up journeys
- Chronic-care journey timers
- Pending diagnostics reminders
- SLA timers
- Retry-heavy workflow steps

Deployment:

- Independent worker deployment
- Uses Temporal or an equivalent durable workflow engine
- Receives workflow commands/events from `core-api`

### integration-gateway

The external integration adapter service.

Owns:

- WhatsApp provider integration
- Telephony integration
- Payment provider integration
- External webhook normalization
- Sync retries and reconciliation handoff

Deferred:

- HIS / EMR integration
- LIS / RIS integration

Deployment:

- Independent service deployment
- Publishes normalized events to `core-api`

### datacentriq-gateway

The HealthcareOS-facing adapter for DatacentrIQ intelligence APIs.

Owns:

- Copilot API calls
- Control Tower API calls
- Governed context payload construction
- Tenant and consent-aware data minimization
- Decision trace normalization
- AI failure and fallback behavior
- Outcome feedback to DatacentrIQ

Deployment:

- Independent service deployment
- Consumed by `core-api` and, where appropriate, `workflow-worker`

## Communication Pattern

MVP:

- `staff-web` -> `core-api` over HTTP
- `patient-web` -> `core-api` over HTTP
- `core-api` -> `datacentriq-gateway` over HTTP
- `core-api` -> `workflow-worker` through workflow commands
- `integration-gateway` -> `core-api` through webhooks or internal HTTP

Contract rule:

- Service APIs should be described through OpenAPI, AsyncAPI, or provider-specific webhook specs.
- If generated clients or DTOs are needed, generate or copy them into the consuming service.
- Do not create a shared package just to avoid duplication.
- Small duplication across services is acceptable when it preserves deployment independence.

Later:

- Event bus for high-volume events if needed
- Generated clients from OpenAPI contracts
- Service mesh only if deployment complexity justifies it

## Data Ownership

`core-api` owns the primary product database for MVP.

Other services should not directly write to the core database. They should call `core-api` or publish normalized events for `core-api` to validate and persist.

This keeps patient identity, consent, audit, and care journey state consistent.

## DatacentrIQ Boundary

DatacentrIQ intelligence must be accessed through `datacentriq-gateway`.

Product services should not scatter direct calls to Copilot API or Control Tower API. This keeps governance, context minimization, decision traces, retries, and fallback behavior centralized.
