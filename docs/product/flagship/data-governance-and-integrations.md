# AI Patient Access and Continuity Platform: Data, Governance, and Integrations

## Purpose

This document defines the data foundation, governance model, and integration approach for the HealthcareOS flagship product: the AI Patient Access and Continuity Platform for the Indian market.

The platform should help healthcare providers capture patient demand, identify the right patient or caregiver, coordinate appointments, prepare visits, manage follow-ups, and prevent drop-offs. It should use DatacentrIQ Copilot API and Control Tower API as underlying intelligence services, while HealthcareOS remains the product surface that owns healthcare workflows, patient experience, domain models, consent, audit, and integrations.

The product should not depend on replacing existing HIS, EMR, LIS, RIS, telephony, payments, or messaging systems at launch. It should sit above and around those systems, reconcile fragmented operational data, and turn it into governed action.

## Design Principles

- HealthcareOS owns the healthcare workflow and user experience.
- DatacentrIQ provides intelligence through APIs: summarization, drafts, prioritization, recommendations, explanations, risk signals, and outcome feedback.
- Patient identity must be treated as a safety-critical capability.
- Consent, audit, and role-based access are product features, not back-office details.
- AI should assist, prioritize, summarize, draft, and explain. It should not independently diagnose, prescribe, or override clinicians.
- ABDM-readiness is strategically important, but ABDM integration should not be a launch blocker.
- Integrations should degrade gracefully when upstream or downstream systems are incomplete, delayed, or wrong.

## Domain Model

The flagship platform needs a healthcare-specific domain model that supports patient access, care continuity, operational follow-up, and auditable AI recommendations.

### Core Entities

#### Organization

Represents the healthcare provider group using HealthcareOS.

Key fields:

- Organization ID
- Legal name
- Brand name
- Organization type: clinic chain, hospital, diagnostics provider, specialty center
- Time zone
- Supported languages
- Data retention policy
- Integration configuration

Relationships:

- Has many branches
- Has many departments
- Has many providers
- Has many users
- Has many patients

#### Branch

Represents a physical or virtual care location.

Key fields:

- Branch ID
- Organization ID
- Branch name
- Address
- Contact numbers
- Working hours
- Supported departments
- HIS or EMR location identifiers

Relationships:

- Belongs to organization
- Has many departments
- Has many appointments
- Has many staff users
- May have branch-specific patient identifiers

Edge cases:

- Same patient visits multiple branches.
- Same UHID format is reused across branches.
- Appointment is booked in one branch but completed in another.
- Branch is temporarily unavailable because of doctor leave, holiday, renovation, or emergency.

#### Patient

Represents the person receiving care.

Key fields:

- HealthcareOS patient ID
- Organization ID
- Primary phone number
- Alternate phone numbers
- Name
- Age or date of birth
- Gender where captured
- Preferred language
- Preferred communication channel
- Branch affiliations
- External patient identifiers: UHID, MRN, HIS ID, EMR ID, ABHA number if voluntarily provided
- Consent status
- Deceased or inactive status
- Identity confidence metadata

Relationships:

- May have many caregivers
- May belong to a family group
- Has many appointments
- Has many visits
- Has many interactions
- Has many documents
- Has many journeys
- Has many tasks

Edge cases:

- Patient has no phone number and relies on a caregiver.
- Patient has multiple phone numbers.
- Phone number is shared by a family.
- Patient is a minor.
- Patient identity is incomplete at first contact.
- Patient has different UHIDs across branches.
- Patient record is duplicated across HIS, EMR, and HealthcareOS.
- Patient record was incorrectly merged and must be unmerged.

#### Caregiver

Represents a person who communicates or acts on behalf of a patient.

Key fields:

- Caregiver ID
- Name
- Phone number
- Relationship to patient: parent, spouse, child, sibling, attendant, friend, other
- Communication permissions
- Consent authority where applicable
- Preferred language

Relationships:

- May be linked to one or more patients
- May be primary contact for a patient
- May belong to a family group

Edge cases:

- Same caregiver manages multiple family members.
- Caregiver books an appointment but does not attend the visit.
- Caregiver should receive logistics messages but not clinical documents.
- Patient revokes caregiver access.
- A divorced spouse, estranged family member, or former attendant should no longer receive updates.

#### Family Group

Represents a household or related patient cluster. This is important in India because phone numbers, payments, and care coordination are often family-mediated.

Key fields:

- Family group ID
- Organization ID
- Primary family contact
- Members
- Shared phone numbers
- Notes on preferred coordination

Relationships:

- Has many patients
- Has many caregivers
- May have shared payment references

Edge cases:

- One mobile number maps to multiple patients.
- A parent manages children and elderly parents from the same number.
- A patient wants private communication separate from the family number.
- Family member tries to access another member's sensitive records without permission.

#### Provider

Represents doctors, nurses, care coordinators, technicians, or other care team members.

Key fields:

- Provider ID
- Name
- Role
- Specialty
- Department
- Branch associations
- Availability metadata
- External system IDs

Relationships:

- Has many appointments
- Has many visits
- Owns or reviews tasks
- May receive escalations

#### Appointment

Represents a scheduled patient interaction.

Key fields:

- Appointment ID
- Patient ID
- Caregiver ID if booked by caregiver
- Provider ID
- Department
- Branch
- Appointment type
- Date and time
- Status: requested, tentative, booked, confirmed, rescheduled, cancelled, no-show, arrived, completed
- Source: WhatsApp, call, web, walk-in, referral, HIS, EMR, staff-created
- External appointment ID
- No-show risk
- Pre-visit checklist state

Relationships:

- Belongs to patient
- May be linked to visit
- May trigger tasks, reminders, and journeys

Edge cases:

- Appointment exists in HIS but not in HealthcareOS.
- Appointment exists in HealthcareOS but failed to sync to HIS.
- Doctor becomes unavailable after confirmation.
- Slot is double-booked because of sync delay.
- Patient arrives without appointment.
- Appointment status differs across systems.

#### Visit

Represents an actual care encounter.

Key fields:

- Visit ID
- Patient ID
- Appointment ID where available
- Branch
- Department
- Provider
- Visit date
- Visit status
- Visit outcome summary
- Follow-up needed
- External visit ID

Relationships:

- Belongs to patient
- May create follow-up journey
- May create documents, reports, tasks, or payment events

#### Interaction

Represents a patient or caregiver communication.

Key fields:

- Interaction ID
- Patient ID if matched
- Caregiver ID if known
- Channel: WhatsApp, call, missed call, SMS, web, email, walk-in note
- Direction: inbound or outbound
- Content metadata
- Message text where available
- Media references
- Language
- AI-extracted intent
- Staff owner
- Consent and sensitivity flags
- Delivery status

Relationships:

- Belongs to patient, caregiver, family group, or unmatched contact
- May create appointment, task, escalation, or document

Edge cases:

- Unknown sender.
- Patient sends only an image or voice note.
- Message belongs to the wrong patient in a shared-phone family.
- Message delivery fails.
- WhatsApp template is rejected.
- Patient asks for diagnosis or urgent clinical help.

#### Document

Represents uploaded, imported, or generated files and structured records.

Key fields:

- Document ID
- Patient ID
- Document type: prescription, lab report, radiology report, discharge summary, insurance card, ID proof, referral note, consent artifact, other
- Source
- File reference
- OCR status
- Sensitivity level
- Owner system
- Access restrictions
- Retention category

Relationships:

- Belongs to patient
- May be linked to visit, appointment, journey, or task
- May be summarized by Copilot API

Edge cases:

- Document is unreadable.
- Document belongs to another patient.
- Document is inaccessible because of expired link or storage failure.
- Staff member lacks permission to view sensitive document.
- Patient revokes consent after upload.
- OCR extraction is wrong or incomplete.

#### Care Journey

Represents a structured follow-up path.

Key fields:

- Journey ID
- Patient ID
- Journey type: post-visit, post-procedure, chronic care, diagnostic follow-up, procedure conversion, medication refill, review reminder
- Specialty
- Start date
- Current state
- Next milestone
- Responsible team
- Risk level
- Completion criteria

Relationships:

- Belongs to patient
- Has many tasks
- Has many interactions
- May be linked to appointment, visit, report, or procedure recommendation

Edge cases:

- Patient pauses care because of cost.
- Patient moves to another branch.
- Patient completes care outside the provider network.
- Patient opts out of reminders.
- Doctor changes follow-up plan verbally but system is not updated.

#### Task

Represents a unit of staff work.

Key fields:

- Task ID
- Patient ID
- Assigned user or team
- Task type: call, message, schedule, collect document, escalate, follow-up, verify, close loop
- Priority
- Due date
- Status
- SLA
- Closure reason
- Source: rule, staff, Copilot API, Control Tower API, integration event
- Recommendation trace ID where applicable

Relationships:

- Belongs to patient or unmatched contact
- May belong to journey
- May be generated from interaction, appointment, visit, report, or payment event

Edge cases:

- Two staff members work the same task.
- Task is closed without useful outcome.
- Patient cannot be reached after repeated attempts.
- Task becomes invalid because appointment was cancelled in HIS.
- Task was created from an incorrect patient match.

#### Recommendation

Represents an AI-assisted or rule-assisted suggestion shown inside HealthcareOS.

Key fields:

- Recommendation ID
- Patient ID or cohort context
- Recommendation type: next best action, priority, risk, leakage, summary, draft, routing suggestion
- Source: DatacentrIQ Copilot API, DatacentrIQ Control Tower API, HealthcareOS rule
- Input references
- Confidence
- Explanation
- Suggested action
- Human decision: accepted, edited, rejected, ignored
- Outcome

Relationships:

- May create task, message draft, appointment suggestion, escalation, or journey update
- Has decision trace

Edge cases:

- Recommendation uses stale data.
- Recommendation conflicts with staff knowledge.
- Recommendation has low confidence.
- Recommendation is clinically sensitive and requires clinician review.

## Patient Identity Model

Patient identity is central to safety and trust. The platform should treat identity matching as a managed workflow, not a hidden background process.

### Identity Inputs

HealthcareOS should support matching with:

- Phone number
- Alternate phone numbers
- Caregiver phone
- Name
- Age or date of birth
- Gender where captured
- Branch
- Doctor
- Department
- UHID or MRN
- HIS or EMR ID
- ABHA number if voluntarily provided
- Appointment history
- Document metadata
- Family group

### Identity States

Patient records should move through explicit identity states:

- Unmatched contact: interaction received but no patient match.
- Candidate match: system suggests one or more patients.
- Provisional patient: record created with limited identity data.
- Confirmed patient: staff or trusted integration confirms the identity.
- Linked external patient: mapped to HIS, EMR, or branch UHID.
- Duplicate candidate: likely duplicate requiring review.
- Merged patient: records merged with trace.
- Unmerged patient: previous merge reversed with trace.

### Matching Rules

The system should:

- Never silently merge high-risk duplicates.
- Show why a match was suggested.
- Allow staff to choose the correct patient when a phone number maps to a family.
- Keep source-system IDs visible.
- Preserve original source records after merge.
- Support reversible merge and unmerge.
- Log who confirmed, merged, unmerged, or rejected a match.

### Wrong Patient Prevention

Before showing sensitive data, sending documents, or booking against an existing record, the platform should verify enough context for the workflow:

- For appointment booking, phone plus patient name may be enough.
- For document sharing, require stronger confirmation.
- For caregiver access, verify relationship and permission.
- For sensitive specialties or sensitive documents, apply stricter access checks.

## Family and Caregiver Model

India-specific care workflows often involve a family member, not only the patient. HealthcareOS should model this directly.

### Supported Patterns

- Parent managing child.
- Adult child managing elderly parent.
- Spouse coordinating appointments.
- Attendant or assistant coordinating logistics.
- Shared family phone number.
- Patient privately managing some parts of care while family handles logistics.

### Caregiver Permissions

Caregiver permissions should be purpose-specific:

- Can book or reschedule appointment.
- Can receive logistics reminders.
- Can upload documents.
- Can view reports.
- Can receive payment links.
- Can receive follow-up instructions.
- Can approve communication on behalf of minor or dependent patient where legally and operationally appropriate.

The product should avoid treating "has the phone number" as equivalent to "can see everything."

### Caregiver Edge Cases

- Patient revokes caregiver permission.
- Caregiver number is reused for another patient.
- Caregiver leaves employment or family role.
- Caregiver asks for records after access is revoked.
- Staff accidentally sends clinical details to a logistics-only caregiver.
- Minor becomes adult and consent/permissions need review.

## Consent Model

Consent should be tracked at a practical workflow level. The launch product should be DPDP-aware and designed for privacy review, while keeping consent flows usable for real front-desk and care-coordination teams.

### Consent Types

HealthcareOS should track:

- Communication consent: WhatsApp, SMS, calls, email.
- Transactional communication consent: appointment, payment, logistics, reports available.
- Care-continuity consent: follow-up reminders, care journey nudges, medication refill reminders.
- Marketing or promotional consent: health packages, campaigns, offers.
- Document handling consent: upload, store, OCR, summarize, share with care team.
- AI processing consent where required by policy: summarize, classify, route, generate drafts, recommend follow-up.
- Caregiver communication permission.
- ABDM-related consent where ABDM flows are enabled.

### Consent States

Consent should have explicit states:

- Not requested
- Requested
- Granted
- Partially granted
- Denied
- Revoked
- Expired
- Unknown from imported system

### Consent Rules

The system should:

- Separate transactional messages from marketing messages.
- Stop non-essential outreach when consent is revoked.
- Preserve necessary audit records even after communication opt-out, subject to legal and retention policy.
- Show staff what communication is allowed before sending.
- Prevent AI-generated patient messages from being sent where consent does not allow outreach.
- Allow patient or caregiver preferences by channel and language.

### Revoked Consent Edge Cases

- Patient revokes WhatsApp consent but still wants calls.
- Patient opts out of marketing but still needs appointment reminders.
- Patient revokes document handling after files were uploaded.
- Caregiver consent remains but patient consent is revoked.
- Imported HIS record has no consent metadata.
- Staff manually sends message outside system after opt-out.

## Audit Model

HealthcareOS should maintain an audit trail for patient safety, compliance, AI governance, and operational accountability.

### Audit Events

The platform should log:

- Patient record created, updated, merged, unmerged, or deleted.
- External identifiers linked or unlinked.
- Consent requested, granted, denied, revoked, or expired.
- Document uploaded, viewed, downloaded, summarized, shared, or deleted.
- Message drafted, edited, approved, sent, delivered, failed, or read where available.
- Appointment created, updated, cancelled, rescheduled, confirmed, marked no-show, arrived, or completed.
- Task created, assigned, reassigned, escalated, closed, reopened, or overdue.
- AI recommendation generated, shown, accepted, edited, rejected, or ignored.
- User viewed sensitive patient data.
- Role, permission, or team assignment changed.
- Integration sync succeeded, failed, retried, or produced conflict.

### AI Decision Trace

For important AI-assisted actions, HealthcareOS should store:

- Recommendation ID
- Source: Copilot API, Control Tower API, or HealthcareOS rule
- Input data references
- Timestamp
- User or system context
- Confidence where available
- Explanation shown to staff
- Suggested action
- Human action taken
- Outcome

Staff should experience this as simple explanation: what matters, why it matters, and what to do next. The underlying trace should support audit and improvement.

### Audit Edge Cases

- Staff changes patient identity after AI recommendation was generated.
- AI draft is edited before send.
- Message is sent outside HealthcareOS.
- Integration overwrites a field previously edited by staff.
- User views a document but does not take action.
- Admin needs to know why a high-priority follow-up was not contacted.

## Role-Based Access

Role-based access should reflect real healthcare operations. A small clinic may use broad roles, while a large provider network may need branch, department, and specialty restrictions.

### Baseline Roles

#### Front Desk

Can:

- View basic patient demographics.
- Manage appointments.
- View allowed communication history.
- Send approved logistics messages.
- Collect pre-visit information.

Should usually not:

- View highly sensitive clinical documents unless required.
- Send clinical advice.
- Override consent restrictions.

#### Call Center

Can:

- View assigned queues.
- Call or message patients within allowed purpose.
- Capture call dispositions.
- Book or reschedule appointments.
- Update contact preferences.

Should usually not:

- Access sensitive documents without purpose.
- Change clinical follow-up plans.

#### Care Coordinator

Can:

- Manage follow-up journeys.
- View relevant visit outcomes and instructions.
- Escalate to nurse or doctor.
- Track adherence and missed reviews.
- Send approved follow-up messages.

#### Nurse

Can:

- View assigned clinical escalation queues.
- Review relevant symptoms, reports, and care plans.
- Update checklist status.
- Escalate to doctor.

Should not:

- Send final diagnosis or prescription unless this is permitted by provider policy and clinician workflow.

#### Doctor

Can:

- View patient timeline relevant to care.
- Review documents and summaries.
- Approve or modify clinical follow-up plans.
- Review escalations.
- Use Copilot-supported summaries and drafts.

#### Department Admin

Can:

- View operational dashboards for assigned department.
- Monitor queues, backlogs, no-shows, and follow-up performance.
- Reassign work.
- Review audit for operational actions.

Should not:

- Access sensitive patient documents unless role and purpose allow.

#### Organization Admin

Can:

- Manage users, roles, branches, integration settings, and organization policies.
- View organization-wide operational reporting.
- Configure retention and consent policies.

#### Integration Service Account

Can:

- Read and write only the data required for the integration.
- Use scoped API credentials.
- Rotate credentials.

Should not:

- Have human-user privileges.
- Bypass audit logging.

### Access Control Dimensions

Permissions should be evaluated by:

- Organization
- Branch
- Department
- Role
- Patient relationship
- Data sensitivity
- Consent status
- Purpose of use
- Workflow state
- Source system restrictions

## Data Retention and Deletion Considerations

HealthcareOS should support configurable retention policies by organization and data category. Final legal requirements should be validated with counsel, but the product should be designed for practical privacy operations from day one.

### Retention Categories

- Patient demographic data
- Contact and communication history
- Appointment and visit metadata
- Care journey and task history
- Documents and media
- Audit logs
- AI recommendation traces
- Integration sync logs
- Consent records
- Payment metadata

### Deletion and Suppression

The platform should distinguish:

- Deletion: remove data according to policy and legal constraints.
- Suppression: stop outreach while retaining minimum operational records.
- Anonymization: remove identifiers while preserving aggregate analytics.
- Archival: move inactive records out of active workflows.

### Retention Edge Cases

- Patient requests deletion but provider has legal or medical record retention obligations.
- Patient opts out of communication but care team still needs to retain visit history.
- Document must be deleted but audit record must remain.
- Patient is incorrectly merged and deletion request affects another patient.
- Integration re-imports deleted data from HIS.
- Staff downloads document before deletion.

## Integration Architecture

The flagship platform should integrate with existing systems without making any one integration a launch blocker. The product should support both real-time APIs and pragmatic batch or semi-manual ingestion where the customer environment is immature.

### Integration Principles

- Use HealthcareOS IDs as internal stable identifiers.
- Store external IDs from every source system.
- Keep source-of-truth metadata per field where needed.
- Support idempotent sync.
- Detect and surface conflicts instead of silently overwriting.
- Queue retries for transient failures.
- Provide integration health dashboards for admins.
- Allow staff to continue critical workflows during integration outages.

### Sync Patterns

Supported patterns for the current pilot:

- Real-time API integration.
- Webhook event ingestion.
- CSV import for launch or low-maturity customers.
- Manual reconciliation queues.

Data should be marked by source:

- User-entered
- Patient-entered
- WhatsApp imported
- Telephony imported
- Payment imported
- DatacentrIQ intelligence output

Deferred source labels:

- HIS imported
- EMR imported
- LIS imported
- RIS imported

## HIS and EMR Integration

HIS and EMR integrations are important for appointment, patient, visit, provider, and clinical context. They are intentionally deferred from the first pilot so HealthcareOS can prove patient access, household identity, WhatsApp, telephony, and mobile-link workflows first.

### Inbound Data

HealthcareOS should ingest:

- Patient demographics
- UHID or MRN
- Branch and department identifiers
- Doctor schedules
- Appointment records
- Appointment status updates
- Visit completion status
- Visit outcome metadata where available
- Follow-up date or review instructions where available
- Basic prescription or discharge references where permitted

### Outbound Data

HealthcareOS may send:

- Appointment booking requests
- Reschedule or cancellation requests
- Pre-visit forms
- Document availability references
- Updated patient contact information where permitted
- Follow-up task metadata where the HIS supports it

### Source of Truth

Recommended launch posture:

- HIS/EMR remains source of truth for official appointments, visits, and medical records.
- HealthcareOS is source of truth for patient communications, access workflows, follow-up journeys, operational tasks, AI recommendations, and lifecycle state.
- Patient demographics can be co-managed with clear conflict resolution.

### Failure Modes

- Bad sync creates duplicate patient.
- HIS appointment update is delayed.
- Slot is booked in HealthcareOS but rejected by HIS.
- Visit is completed in HIS but not reflected in HealthcareOS.
- HIS sends incomplete patient demographics.
- External IDs change after migration.
- Staff edits data in both systems and fields conflict.
- Branch mapping is wrong.

### Product Responses

- Show integration status on affected records.
- Put conflicts into reconciliation queue.
- Prevent duplicate outbound booking retries through idempotency keys.
- Allow staff to manually mark appointment as operationally handled.
- Log every sync failure and retry.
- Alert admins when sync failure rate crosses threshold.

## WhatsApp Integration

WhatsApp is likely the primary patient-facing channel for the Indian market. The platform should support both structured templates and open-session conversations.

### Capabilities

- Inbound message ingestion.
- Outbound template messages.
- Session messages where allowed.
- Message delivery status.
- Media capture: images, PDFs, voice notes where supported.
- Language detection.
- Consent and opt-out handling.
- AI draft generation with human approval.
- Patient or caregiver matching by phone number.

### Message Types

- Appointment reminders.
- Confirmation requests.
- Reschedule links.
- Pre-visit document requests.
- Payment links.
- Follow-up reminders.
- Lab or report availability notices.
- Patient education.
- Care coordinator messages.

### Failure Modes

- Template rejected or not approved.
- Message delivery fails.
- Patient number is not on WhatsApp.
- Media fails to download.
- Patient sends message from caregiver number.
- Patient replies in a different language.
- Patient shares sensitive information in a general chat.
- Patient opts out.
- Message is sent to wrong family member.

### Product Responses

- Fall back to call, SMS, or staff task where permitted.
- Show failed delivery in the workbench.
- Block non-essential messages after opt-out.
- Require stronger confirmation before sharing sensitive documents.
- Route urgent or risky messages to human escalation.
- Keep patient-facing AI drafts approval-driven in MVP.

## Telephony Integration

Telephony is critical because many Indian healthcare workflows start with missed calls, callback requests, and call-center operations.

### Capabilities

- Missed-call ingestion.
- Inbound and outbound call logs.
- Call disposition capture.
- Staff assignment.
- Call recording references where permitted.
- Call transcription where available and consented.
- AI structuring of call notes through Copilot API.
- Callback queues and SLA tracking.

### Failure Modes

- Caller ID is masked or missing.
- Same number belongs to multiple patients.
- Call recording unavailable.
- Transcription quality is poor because of language, accent, noise, or code switching.
- Staff forgets to disposition call.
- Patient requests no further calls.
- Multiple agents call same patient.

### Product Responses

- Create unmatched contact when identity is unclear.
- Ask staff to select patient from family group.
- Show transcription confidence and source audio reference where available.
- Require disposition before closing high-value or high-risk calls.
- Suppress further call tasks after opt-out except permitted transactional cases.
- Lock or warn on active duplicate outreach.

## LIS and RIS Integration

Lab and radiology integrations help HealthcareOS close the gap between diagnostics and follow-up.

### Inbound Data

HealthcareOS should ingest:

- Test orders where available.
- Report availability.
- Report metadata.
- Structured lab values where available.
- Report documents.
- Critical or abnormal flags where source system provides them.
- Radiology report status and document references.

### Use Cases

- Notify patient that report is available.
- Create follow-up task for abnormal or critical result.
- Summarize report for doctor or care coordinator.
- Identify patients with report completed but no follow-up booked.
- Trigger care journey step after diagnostic completion.

### Failure Modes

- Report belongs to wrong patient.
- Report is delayed or cancelled.
- Lab values arrive without reference range.
- Abnormal flag differs between systems.
- PDF is inaccessible.
- Structured values and PDF disagree.
- Patient did test outside provider network.

### Product Responses

- Require identity checks before attaching report.
- Show source and timestamp for report data.
- Avoid patient-facing interpretation without approved template or human review.
- Escalate critical flags according to provider policy.
- Allow manual upload of outside reports.
- Put inaccessible reports into document issue queue.

## Payments Integration

Payments are part of access and continuity because payment friction can block appointments, diagnostics, procedures, and follow-ups.

### Capabilities

- Payment link generation.
- UPI and card payment status where provider supports it.
- Pending payment reminders.
- Package or estimate reference.
- Refund or failed payment status where available.
- Payment metadata on patient timeline.

### Data Boundaries

HealthcareOS should store payment metadata, not sensitive payment credentials.

Recommended stored fields:

- Payment request ID
- Amount
- Currency
- Purpose
- Status
- Provider reference
- Timestamp
- Associated appointment, journey, or task

### Failure Modes

- Payment link fails.
- Patient pays but status is delayed.
- Patient pays against wrong appointment.
- Caregiver pays for patient.
- Partial payment is accepted offline.
- Refund occurs outside system.
- Payment reminder sent after payment completed in another system.

### Product Responses

- Reconcile payment status before sending reminders.
- Allow manual payment confirmation with audit.
- Link caregiver payment to patient with clear payer metadata.
- Show payment sync uncertainty to staff.
- Avoid blocking care workflows solely because payment sync is delayed unless provider policy requires it.

## ABDM Readiness

ABDM and ABHA are important for India's digital health ecosystem, but they should not be a launch blocker for the flagship product.

### Launch Position

HealthcareOS should be designed as ABDM-ready:

- Store ABHA number or address only when voluntarily provided and permitted.
- Keep patient identity model flexible enough to link ABDM identifiers later.
- Design consent artifacts to support ABDM consent flows in future.
- Keep health record references structured enough for future exchange.
- Avoid hard dependency on ABDM integration for appointment, follow-up, and communication workflows.

### Future ABDM Capabilities

Potential future capabilities:

- ABHA discovery and linking.
- Consent-based health record access.
- Consent manager integration.
- Health information provider and health information user workflows where applicable.
- ABDM-compliant audit and data exchange flows.

### ABDM Edge Cases

- Patient does not have ABHA.
- Patient refuses ABHA linking.
- ABHA details do not match local patient record.
- ABDM service is unavailable.
- Consent is granted for one purpose but not another.
- Patient revokes ABDM consent after records were accessed.

## DatacentrIQ Integration Perspective

DatacentrIQ should power intelligence inside HealthcareOS workflows through APIs. HealthcareOS should not expose Control Towers as standalone HealthcareOS apps in the flagship experience.

### Copilot API Uses

The Copilot API can support:

- Patient timeline summaries.
- Call-note structuring.
- WhatsApp reply drafts.
- Pre-visit doctor briefs.
- Follow-up instruction drafts.
- Local-language patient education drafts.
- Document summary drafts where permitted.
- Staff explanations of why a task matters.

### Control Tower API Uses

The Control Tower API can support:

- Prioritized daily work queues.
- Missed follow-up detection.
- No-show risk signals.
- Pending diagnostics detection.
- Procedure conversion leakage detection.
- Operational anomaly explanation.
- Next-best-action recommendations.
- Outcome tracking after staff action.

These outputs should appear in HealthcareOS as task priority, recommended action, explanation, queue ordering, escalation reason, or admin insight.

### Governance Requirements for DatacentrIQ Outputs

HealthcareOS should store:

- API request context metadata.
- Output shown to user.
- Source references.
- Confidence and explanation where available.
- Human action taken.
- Outcome feedback.

HealthcareOS should enforce:

- Consent checks before sending patient-facing content.
- Role checks before showing sensitive summaries.
- Human approval for patient-facing clinical or sensitive messages in MVP.
- Escalation for urgent or clinically risky content.

## Cross-System Edge Cases and Failure Modes

### Bad Sync

Symptoms:

- Appointments missing or duplicated.
- Visit status stale.
- Patient demographic mismatch.
- Payment or report status delayed.

Controls:

- Integration health page.
- Sync logs with retry status.
- Conflict queue.
- Field-level source metadata where needed.
- Staff-visible warnings on affected records.

### Duplicate Records

Symptoms:

- Same patient appears multiple times.
- Follow-up tasks split across records.
- Wrong history shown to staff.

Controls:

- Duplicate detection.
- Manual merge and unmerge.
- Merge audit.
- High-risk duplicate review before sensitive communication.

### Revoked Consent

Symptoms:

- Patient should no longer receive messages.
- Caregiver access removed.
- Document handling permission withdrawn.

Controls:

- Consent-aware send controls.
- Communication suppression.
- Staff warning before outreach.
- Audit of consent change.
- Retain minimum records according to policy.

### Inaccessible Documents

Symptoms:

- Broken file link.
- Expired signed URL.
- Storage permission error.
- Corrupt file.

Controls:

- Document issue queue.
- Retry or regenerate access link.
- Ask patient to re-upload only when necessary.
- Avoid generating AI summary from inaccessible file.

### Wrong Patient

Symptoms:

- Shared family phone number caused mismatch.
- Staff selected wrong record.
- HIS mapping incorrect.

Controls:

- Stronger confirmation for sensitive actions.
- Show identity confidence.
- Reversible merge.
- Audit all identity changes.
- Stop outbound sensitive message when match confidence is low.

### Multiple Branches

Symptoms:

- Branch-specific UHIDs conflict.
- Patient history fragmented.
- Appointment booked at wrong location.
- Staff lacks branch access.

Controls:

- Organization-wide patient identity with branch-specific external IDs.
- Branch-aware permissions.
- Branch clearly displayed in appointment and task surfaces.
- Cross-branch patient timeline where permitted.

### Message Delivery Failures

Symptoms:

- WhatsApp failure.
- Template rejection.
- Patient changed number.
- SMS or call fallback unavailable.

Controls:

- Delivery state in timeline.
- Failed-message queue.
- Channel fallback rules.
- Staff callback task.
- Consent-aware retry logic.

## Launch Readiness Checklist

Before launch with a provider network, validate:

- Patient identity workflow supports family numbers and duplicate review.
- Consent states are visible before outreach.
- Sensitive document access is role-restricted.
- Audit logs capture identity, consent, message, task, document, recommendation, and integration events.
- HIS or EMR sync failures produce visible reconciliation work, not silent data loss.
- WhatsApp delivery failures create staff-visible tasks.
- Telephony missed calls become trackable work items.
- Lab and radiology reports are attached only after identity checks.
- Payment reminders check latest known payment state.
- ABDM fields are optional and do not block core workflows.
- DatacentrIQ outputs are stored with trace and human outcome feedback.

## Open Product Questions

- What is the minimum identity verification required before sending reports or clinical instructions?
- Which specialties require stricter privacy defaults?
- Which patient-facing messages can be sent automatically in MVP, and which require approval?
- Should caregiver permissions expire automatically after a configurable period?
- Which system is source of truth for patient demographic updates in each customer deployment?
- How long should AI recommendation traces be retained?
- What is the first supported integration maturity level: API-first, CSV-first, or hybrid?
- Which ABDM capabilities should be planned for the first post-MVP phase?
