# HealthcareOS Core API

Core API for the HealthcareOS flagship AI Patient Access and Continuity Platform.

This service is independently deployable. It does not import shared runtime packages, does not depend on a parent workspace, and keeps all domain types inside `core-api`.

## Current Scope

The MVP API supports the end-to-end flagship flow:

- Health check
- Demo staff auth and service API key auth
- Tenant-scoped organizations, branches, users, roles, and API keys
- RBAC permissions for staff and service actors
- Patients and Patient 360 timeline
- Interactions and unified inbox
- Staff workbench tasks
- Appointments and confirmation
- Patient mobile-link session lookup
- Document upload metadata capture
- Follow-up confirmation
- DatacentrIQ-style AI recommendation intake
- Audit event capture for sensitive staff, patient-link, AI, and service actions
- Service event intake from integration-gateway and workflow-worker
- Optional outbound calls to DatacentrIQ gateway and workflow-worker

PostgreSQL persistence is available when `DATABASE_URL` is set. When `DATABASE_URL` is not set, the service falls back to in-memory seed data for quick local development.

Real identity-provider auth, real external integrations, and file storage are not wired yet.

## Run

```bash
npm install
npm run dev
```

Default URL:

```text
http://localhost:4100
```

Set a custom port:

```bash
PORT=4200 npm run dev
```

## PostgreSQL

Set `DATABASE_URL` to enable persistence:

```bash
DATABASE_URL=postgres:///healthcareos_core npm run dev
```

Or use a full connection string:

```bash
DATABASE_URL=postgres://user:password@127.0.0.1:5432/healthcareos_core npm run dev
```

The service runs its lightweight schema migration on startup. If the database is empty, it seeds the demo records.

The migration file is also checked in:

```text
migrations/001_core_records.sql
```

Current storage model:

- `healthcareos_core_records`
- One row per product record
- `collection` identifies the domain collection
- `record_id` identifies the domain object
- `tenant_id`, `patient_id`, and `status` are indexed for common filtering
- `payload` stores the service-local domain object as JSONB

This gives the MVP durable persistence while keeping schema evolution flexible during early product discovery.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

## Seed IDs

Useful demo records:

```text
patient_demo_001
patient_demo_002
appointment_demo_001
appointment_demo_002
followup_demo_001
followup_demo_002
task_demo_001
task_demo_002
mls_demo_anita
mls_demo_rahul
org_demo_healthcare
user_demo_frontdesk
user_demo_coordinator
user_demo_doctor
user_demo_admin
core_demo_service_key
```

## Demo Auth

Every non-health route creates a request context. In local demo mode, omitted headers default to:

```text
x-demo-tenant-id: org_demo_healthcare
x-demo-user-id: user_demo_frontdesk
```

You can switch demo users per request:

```bash
curl http://localhost:4100/auth/me \
  -H "x-demo-user-id: user_demo_admin" \
  -H "x-demo-tenant-id: org_demo_healthcare"
```

Service-to-service calls use:

```text
x-service-api-key: core_demo_service_key
```

Seeded service keys represent integration-gateway, DatacentrIQ gateway, and workflow-worker actors. `CORE_API_SERVICE_KEY` can also be used for an environment-managed integration service key.

## RBAC

Roles are defined inside this service only:

```text
front_desk
call_center
care_coordinator
nurse
doctor
admin
org_admin
integration_service
datacentriq_service
workflow_service
```

Route guards check explicit permissions before handlers run. Patient-facing data is tenant-scoped by `tenantId`.

## API Notes

All responses are JSON wrapped as:

```json
{
  "data": {}
}
```

Errors are JSON wrapped as:

```json
{
  "error": {
    "message": "..."
  }
}
```

## Endpoints

### Health

```bash
curl http://localhost:4100/health
```

### Auth and Audit

```bash
curl http://localhost:4100/auth/me
curl http://localhost:4100/audit/events \
  -H "x-demo-user-id: user_demo_admin"
curl "http://localhost:4100/audit/events?patientId=patient_demo_001" \
  -H "x-demo-user-id: user_demo_admin"
```

### Patients

```bash
curl http://localhost:4100/patients
curl http://localhost:4100/patients/patient_demo_001
curl http://localhost:4100/patients/patient_demo_001/timeline
```

Create patient:

```bash
curl -X POST http://localhost:4100/patients \
  -H "content-type: application/json" \
  -d '{"displayName":"Meera Iyer","primaryPhone":"+919800000001","preferredLanguage":"Tamil","branchId":"chn-adyar","tags":["new_lead"]}'
```

### Interactions and Inbox

```bash
curl http://localhost:4100/inbox
curl http://localhost:4100/interactions
curl "http://localhost:4100/interactions?patientId=patient_demo_001"
```

Create an interaction and optional workbench task:

```bash
curl -X POST http://localhost:4100/interactions \
  -H "content-type: application/json" \
  -d '{"patientId":"patient_demo_001","channel":"whatsapp","direction":"inbound","subject":"Eye redness","body":"Patient reports mild redness after surgery.","intent":"post_op_symptom_check","urgency":"high","createTask":true}'
```

### Workbench Tasks

```bash
curl http://localhost:4100/workbench/tasks
curl "http://localhost:4100/workbench/tasks?status=open&ownerRole=care_coordinator"
```

Complete a task:

```bash
curl -X PATCH http://localhost:4100/workbench/tasks/task_demo_001 \
  -H "content-type: application/json" \
  -d '{"status":"completed","outcome":"Caregiver reached. Patient confirmed visit."}'
```

### Appointments

```bash
curl http://localhost:4100/appointments
curl "http://localhost:4100/appointments?patientId=patient_demo_001"
```

Create appointment:

```bash
curl -X POST http://localhost:4100/appointments \
  -H "content-type: application/json" \
  -d '{"patientId":"patient_demo_001","doctorName":"Dr. Neha Rao","specialty":"Ophthalmology","scheduledAt":"2026-06-15T10:00:00.000Z","reason":"Post-op review"}'
```

Staff confirmation:

```bash
curl -X POST http://localhost:4100/appointments/appointment_demo_001/confirm \
  -H "content-type: application/json" \
  -d '{"confirmedBy":"staff","notes":"Confirmed by phone."}'
```

### Patient Mobile-Link Flow

Lookup session:

```bash
curl http://localhost:4100/mobile-link-sessions/mls_demo_anita
```

Patient confirms appointment:

```bash
curl -X POST http://localhost:4100/mobile-link-sessions/mls_demo_anita/appointments/appointment_demo_001/confirm \
  -H "content-type: application/json" \
  -d '{"confirmedBy":"caregiver","notes":"Son confirmed the visit."}'
```

Capture document upload metadata:

```bash
curl -X POST http://localhost:4100/mobile-link-sessions/mls_demo_anita/document-metadata \
  -H "content-type: application/json" \
  -d '{"appointmentId":"appointment_demo_001","documentType":"prescription","fileName":"eye-drops-prescription.jpg","mimeType":"image/jpeg","sizeBytes":248000}'
```

Confirm follow-up:

```bash
curl -X POST http://localhost:4100/mobile-link-sessions/mls_demo_anita/follow-ups/followup_demo_001/confirm \
  -H "content-type: application/json" \
  -d '{"patientResponse":"No pain. Mild redness only."}'
```

### AI Recommendation Intake

This endpoint accepts DatacentrIQ-gateway style responses. Control Tower and Copilot intelligence are represented as embedded recommendations and optional task creation.

```bash
curl -X POST http://localhost:4100/ai/recommendations \
  -H "content-type: application/json" \
  -H "x-demo-user-id: user_demo_admin" \
  -d '{"source":"control_tower","patientId":"patient_demo_001","appointmentId":"appointment_demo_001","title":"High no-show risk","summary":"Patient has missed one callback and has an upcoming post-op review.","priority":"high","recommendedAction":"Call caregiver before sending WhatsApp reminder.","confidence":0.86,"traceId":"dciq_trace_demo_001","createTask":true,"ownerRole":"care_coordinator"}'
```

List recommendations:

```bash
curl http://localhost:4100/ai/recommendations
curl "http://localhost:4100/ai/recommendations?patientId=patient_demo_001"
```

### Service Event Intake

Integration gateway event:

```bash
curl -X POST http://localhost:4100/service-events/integration \
  -H "content-type: application/json" \
  -H "x-service-api-key: core_demo_service_key" \
  -d '{"type":"whatsapp.message_received","source":"integration-gateway","payload":{"patientId":"patient_demo_001","subject":"Post-op question","body":"Patient asks if mild redness is normal.","from":"+919812340001","language":"Hinglish","createTask":true}}'
```

Workflow callback:

```bash
curl -X POST http://localhost:4100/service-events/workflow-callback \
  -H "content-type: application/json" \
  -H "x-service-api-key: workflow_demo_service_key" \
  -d '{"type":"sla_timer.expired","taskId":"task_demo_001","status":"in_progress","outcome":"Workflow marked task for escalation review."}'
```

## Optional Outbound Service Wiring

When `DATACENTRIQ_GATEWAY_URL` is set, interaction creation can ask DatacentrIQ gateway for intent extraction if the interaction does not already include intent.

When `WORKFLOW_WORKER_URL` is set, appointment confirmation and follow-up confirmation make best-effort workflow start calls. If these services are unavailable or unset, the core API continues to operate normally.
