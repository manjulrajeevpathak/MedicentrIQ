# HealthcareOS

HealthcareOS is a parent folder containing independent deployable services for the AI-first healthcare platform.

This is intentionally not a package monorepo. There is no root package manager workspace, no shared runtime package, and no cross-service imports. Each service owns its dependencies, scripts, types, runtime, tests, and deployment artifact.

## Root Layout

```text
docs/
staff-web/
patient-web/
core-api/
workflow-worker/
integration-gateway/
datacentriq-gateway/
```

## Flagship Product

The first product is the AI Patient Access and Continuity Platform.

It should prove an end-to-end patient lifecycle flow:

1. Patient request enters through WhatsApp, call, missed call, web, referral, or walk-in.
2. `core-api` identifies the patient or caregiver and creates an interaction.
3. `datacentriq-gateway` provides embedded intelligence: intent, summary, priority, leakage risk, and next-best action.
4. Staff handles the work in `staff-web`.
5. Patient or caregiver completes lightweight actions through `patient-web`.
6. `workflow-worker` manages reminders, no-show recovery, follow-up journeys, and SLA timers.
7. `integration-gateway` normalizes communication-first events from WhatsApp, telephony, and payment sources. HIS/EMR and LIS/RIS adapters are deferred for now.

## Independent Services

### staff-web

Staff operations UI for workbench, inbox, Patient 360, access, follow-up, and admin workflows.

### patient-web

Mobile-first patient and caregiver link flows for appointment confirmation, pre-visit preparation, report upload, consent, and follow-up confirmation.

### core-api

Primary product API and owner of patient identity, inbox, appointments, care journeys, staff tasks, consent, audit, and Patient 360.

### workflow-worker

Durable workflow service for reminders, no-show recovery, follow-up journeys, pending diagnostics, and SLA timers.

### integration-gateway

External adapter service for WhatsApp, telephony, and payments. HIS/EMR and LIS/RIS integration is intentionally deferred for the current pilot scope.

### datacentriq-gateway

HealthcareOS-facing adapter for DatacentrIQ Copilot API and Control Tower API.

## Development Rule

Run commands from inside each service folder.

Do not add:

- root `package.json`
- package workspace files
- shared contracts package
- shared runtime package
- cross-service TypeScript imports

If one service needs to call another, use HTTP contracts, webhooks, generated clients copied into the consuming service, or service-specific local DTOs.
