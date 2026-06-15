# AI Patient Access and Continuity Platform: MVP PRD

## 1. Product Summary

The AI Patient Access and Continuity Platform is the flagship HealthcareOS product for Indian healthcare providers. It helps specialty clinics, hospitals, and provider networks manage the full patient lifecycle from first inquiry to appointment, visit preparation, follow-up, and care completion.

The MVP should prove that HealthcareOS can become the operational memory and action layer for patient-facing teams. It should capture fragmented demand from WhatsApp, calls, missed calls, walk-ins, web leads, and referrals; identify the right patient or caregiver; route the request; prepare the patient; prevent no-shows; and recover follow-up leakage after the visit.

This is not a generic CRM, appointment booking tool, chatbot, HIS, or EMR replacement. It is a healthcare-specific workflow platform with AI embedded inside daily work.

HealthcareOS owns the healthcare product surface: patient workflows, staff workbenches, domain models, integrations, consent, and operational UX.

DatacentrIQ powers the intelligence layer through:

- Copilot API for summaries, drafting, extraction, explanation, and staff assistance.
- Control Tower API for prioritization, leakage detection, next-best-action recommendations, risk scoring, anomaly detection, and outcome tracking.

Control Tower intelligence must appear inside HealthcareOS workflows and screens. It should not be presented as a standalone HealthcareOS application in this MVP.

## 2. Target Market

### Primary Launch Segments

- Specialty clinic chains.
- Mid-sized hospitals with strong OPD volume.
- Multi-branch specialty providers.
- Diagnostics-linked specialty networks.
- High-follow-up specialties such as eye care, fertility, oncology, diabetes, CKD, maternity, dialysis, cardiac care, dermatology, dental, and orthopedics.

### India-Specific Operating Realities

- WhatsApp and calls are the dominant patient communication channels.
- Many patients share one mobile number with family members.
- Caregivers often coordinate care for children, elderly patients, spouses, and outstation patients.
- Providers often run multiple branches with different doctors, schedules, and pricing.
- HIS, EMR, LIS, RIS, billing, telephony, and WhatsApp systems are often fragmented.
- Follow-up instructions may be verbal, handwritten, or captured inconsistently.
- Patients frequently ask for price, doctor availability, branch location, reports, insurance/TPA, and procedure guidance through informal channels.
- No-shows, unconfirmed appointments, missed reviews, incomplete diagnostics, and unconverted advised procedures create major patient and revenue leakage.
- Staff teams are overloaded and need prioritized action, not another passive database.

## 3. Target Users

### Primary Users

- Front desk staff handling appointments, walk-ins, patient questions, and branch-level coordination.
- Call center agents handling inbound calls, missed calls, campaign callbacks, confirmations, and follow-ups.
- Care coordinators handling post-visit journeys, chronic care, procedure conversion, and missed reviews.
- Nurses handling escalation queues, checklist-driven follow-up, abnormal symptom callbacks, and clinical handoff.
- Department administrators monitoring backlog, conversion, team performance, and escalations.

### Secondary Users

- Doctors reviewing pre-visit context, patient timelines, and follow-up visibility.
- Branch managers monitoring access pressure, appointment operations, and local leakage.
- Central operations teams tracking patient lifecycle performance across branches.
- Patients and caregivers interacting through WhatsApp, calls, and mobile web links.

## 4. Problem Statement

Indian healthcare providers lose patient trust, operational efficiency, and revenue because patient interactions are fragmented across informal channels and disconnected systems.

Common failure modes:

- A patient calls or messages but is never called back.
- A missed call is not assigned to anyone.
- A WhatsApp conversation is not linked to the correct patient.
- A caregiver messages from a shared family number, causing identity confusion.
- A patient books but does not receive preparation instructions.
- A patient no-shows and is not recovered.
- A doctor advises a lab test, procedure, or follow-up, but no one tracks completion.
- A patient with an abnormal report does not book a review.
- Front desk, call center, nurse, and doctor teams operate with different versions of the patient context.
- Admins see lagging reports but do not get a daily action surface.

The MVP must turn this messy patient lifecycle into a structured, prioritized, auditable workflow.

## 5. Product Goals

### MVP Goals

- Capture patient demand from WhatsApp, calls, missed calls, web leads, referrals, walk-ins, and manual entries.
- Match each interaction to the right patient, family member, caregiver, branch, and journey whenever possible.
- Route patients to the right doctor, specialty, department, branch, slot, or escalation path.
- Reduce first-response delays and missed-call leakage.
- Improve appointment confirmation and reduce no-shows.
- Prepare patients before visits using document collection, questionnaires, reminders, and consent.
- Convert visit outcomes into structured follow-up journeys.
- Surface missed follow-ups, pending diagnostics, unconverted advised procedures, and unresolved patient issues.
- Give staff a prioritized daily workbench with explainable next actions.
- Maintain a Patient 360 timeline that becomes the shared operational memory.
- Use DatacentrIQ APIs to make recommendations, summaries, drafts, and prioritization explainable and auditable.

### Business Goals

- Increase lead-to-appointment conversion.
- Improve appointment show-up rate.
- Recover missed reviews and procedure opportunities.
- Improve staff productivity and accountability.
- Improve patient experience through timely, personalized, local-language communication.
- Create a measurable ROI story for pilot customers.

## 6. Non-Goals

The MVP will not include:

- Full HIS replacement.
- Full EMR replacement.
- Autonomous clinical diagnosis.
- Autonomous prescribing.
- Custom diagnostic AI model development.
- Full claims automation.
- Full patient mobile app if WhatsApp and mobile web links are sufficient.
- Population health or community outreach workflows.
- Government, NGO, ASHA, ward, or village-level workflows.
- Complex ABDM dependency as a launch blocker.
- Fully autonomous patient communication without human review for sensitive or clinical messages.
- Open-ended AI medical advice to patients.

## 7. MVP Scope

### In Scope

- Unified Patient Inbox.
- Patient Identity and Matching.
- Appointment and Access Orchestration.
- Pre-Visit Preparation.
- Post-Visit Follow-Up Journeys.
- Staff Daily Workbench.
- Patient 360 Timeline.
- AI assistance through DatacentrIQ Copilot API.
- Workflow intelligence through DatacentrIQ Control Tower API.
- Role-based permissions.
- Audit trails for AI recommendations and staff actions.
- Basic integrations for WhatsApp, telephony metadata, web leads, manual entry, and lightweight payment events where available.

### Out of Scope for MVP

- Replacing source clinical systems.
- Building complete billing, claims, LIS, RIS, or pharmacy modules.
- Autonomous emergency triage.
- Patient-facing mobile app store release.
- Deep ABDM production integration.
- Multi-country localization.
- Large-scale public-health outreach.

## 8. Product Principles

- Workflow first: AI must reduce staff work inside real healthcare workflows.
- Human in control: AI recommends, drafts, summarizes, and prioritizes; staff approve important actions.
- Patient safety first: clinical risk language must escalate to humans.
- Family aware: identity and communication must support Indian family and caregiver patterns.
- WhatsApp and call first: the product must work with channels patients already use.
- Audit by default: key recommendations, approvals, edits, and communications must be traceable.
- Explainable enough: staff should see why a patient or task is prioritized.
- Integration tolerant: the product must work even when HIS/EMR data is incomplete or delayed.
- India ready: support local-language communication, branch networks, informal workflows, and operational variability.

## 9. Core Modules and Requirements

### 9.1 Unified Patient Inbox

#### Purpose

Centralize patient interactions across channels and convert them into structured, assignable work.

#### Functional Requirements

- Ingest inbound WhatsApp messages.
- Ingest missed-call events and call logs from telephony integrations.
- Capture web leads and referral form submissions.
- Allow manual creation of walk-in or front-desk inquiry records.
- Display patient conversations in a timeline with channel source, timestamp, assigned owner, and status.
- Use Copilot API to extract intent from messages and call notes.
- Use Copilot API to detect language and generate draft replies.
- Support intent categories including appointment request, reschedule, cancellation, report query, price query, insurance query, procedure query, follow-up, complaint, urgent symptom language, and general query.
- Allow staff to assign, reassign, tag, snooze, escalate, and close conversations.
- Maintain internal notes and handoff comments separate from patient-visible messages.
- Show SLA, aging, and priority indicators.
- Link each conversation to a patient, caregiver, or unresolved identity state.
- Prevent sensitive AI-drafted messages from being sent without staff approval.

#### DatacentrIQ Usage

- Copilot API extracts intent, language, sentiment, urgency, and structured entities from free text, voice-note transcripts, and call notes.
- Copilot API drafts patient responses in the preferred language.
- Control Tower API scores inbox items by urgency, leakage risk, SLA breach risk, and likely conversion value.

#### Acceptance Criteria

- Staff can view all inbound patient interactions in one inbox.
- Every inbox item has a channel, timestamp, status, owner state, and patient-link state.
- AI-extracted intent can be accepted, edited, or rejected by staff.
- AI-drafted replies are editable before sending.
- Urgent symptom language is visibly escalated and cannot be treated as a routine chatbot response.
- Closed conversations retain an audit trail of owner, disposition, and outcome.

### 9.2 Patient Identity and Matching

#### Purpose

Prevent unsafe or confusing workflows by matching interactions to the right patient, family member, caregiver, and provider context.

#### Functional Requirements

- Search patient records by name, phone number, UHID, age, gender, branch, doctor, and caregiver.
- Support one phone number linked to multiple household members.
- Support caregiver contacts distinct from patient contacts.
- Model household membership, shared phone context, caregiver permissions, and caregiver-led actions.
- Allow patient records to belong to one or more branches where appropriate.
- Display imported identifiers from HIS or branch systems.
- Use Copilot API to suggest patient matches from incomplete or messy data.
- Show confidence, matching evidence, and conflicting fields for suggested matches.
- Support manual link, create new patient, mark as caregiver, merge duplicate, and unmerge.
- Record who performed a merge or unmerge and why.
- Preserve source-system identifiers during merge.
- Flag low-confidence identity cases for staff review.

#### DatacentrIQ Usage

- Copilot API assists with fuzzy matching over names, phone numbers, family context, message content, and source identifiers.
- Control Tower API can flag high-risk identity ambiguity when a wrong match could affect follow-up, document access, or clinical escalation.

#### Acceptance Criteria

- A shared phone number can be linked to multiple patients without forcing duplicate conversations into one patient.
- Staff can mark a message as sent by a caregiver for another patient.
- The system does not auto-merge patient records without human confirmation.
- Wrong merges can be reversed.
- Every AI matching suggestion shows why it was suggested.
- Low-confidence identity states remain unresolved until staff review.

### 9.3 Appointment and Access Orchestration

#### Purpose

Help patients get routed, booked, confirmed, rescheduled, and prepared for the right care pathway.

#### Functional Requirements

- Create appointment requests from inbox items, missed calls, web leads, referrals, and manual entries.
- Support doctor, specialty, department, branch, slot, and appointment type selection.
- Support booking for self, child, spouse, parent, or other family member.
- Use Copilot API to suggest appointment intent and specialty routing from patient language.
- Use Control Tower API to prioritize missed calls, high-intent leads, no-show risk, and urgent access requests.
- Display doctor availability and branch availability from integrated source systems where available.
- Support reschedule, cancellation, confirmation, and waitlist states.
- Send staff-approved WhatsApp reminders and confirmation messages.
- Capture referral source, campaign source, and reason for visit.
- Support pre-visit checklist assignment by appointment type.
- Track no-show, completed, cancelled, rescheduled, and pending confirmation states.
- Detect conflicts where HIS appointment state differs from HealthcareOS state.

#### Safety Boundaries

- AI may suggest specialty routing but must not diagnose.
- Emergency-like or clinically risky language must trigger escalation instructions and staff review.
- If patient asks for clinical advice, the system should route to human review instead of giving definitive medical advice.

#### Acceptance Criteria

- Staff can create or update an appointment from an inbox item in a single workflow.
- Appointment requests can be linked to existing or newly created patients.
- The system can handle caregiver-led booking.
- AI routing suggestions are shown as suggestions, not final medical determinations.
- Confirmation and reminder messages are logged.
- No-show and reschedule outcomes are captured for reporting and future prioritization.

### 9.4 Pre-Visit Preparation

#### Purpose

Improve visit readiness by collecting required information and reducing avoidable day-of-visit friction.

#### Functional Requirements

- Generate pre-visit checklist by specialty, appointment type, branch, and provider preference.
- Send document upload links through WhatsApp or SMS.
- Capture prescriptions, lab reports, radiology reports, insurance/TPA documents, prior discharge summaries, and referral notes.
- Use Copilot API to summarize uploaded documents when text is available or OCR is integrated.
- Allow staff to mark uploaded documents as unreadable, wrong patient, duplicate, or accepted.
- Capture pre-visit questionnaire responses through mobile web forms.
- Capture communication consent and document-handling consent.
- Track missing items and send reminders.
- Generate doctor-facing pre-visit brief using Copilot API.
- Show document sensitivity and access restrictions by role.

#### Acceptance Criteria

- Staff can see which pre-visit items are complete, missing, rejected, or not applicable.
- Patient document uploads are linked to the correct patient and appointment.
- Unreadable or wrong-patient documents can be flagged without deleting the audit record.
- Doctor pre-visit brief cites source items such as prior visits, uploaded documents, questionnaire responses, and current appointment reason.
- Consent state is visible before staff sends document-related messages.

### 9.5 Post-Visit Follow-Up Journeys

#### Purpose

Convert visit outcomes into structured care-continuity workflows that prevent patient drop-off.

#### Functional Requirements

- Capture visit outcome from staff entry, imported visit data, doctor note summary, or structured follow-up form.
- Support follow-up journey templates by specialty and visit type.
- Initial journey types include review visit, lab advised, procedure advised, medication refill, post-procedure check-in, chronic care follow-up, and report review.
- Use Copilot API to convert visit notes or call notes into suggested follow-up tasks.
- Use Control Tower API to detect missed follow-ups, pending diagnostics, procedure drop-offs, high-risk delays, and patients needing escalation.
- Generate staff-reviewed patient messages in preferred language.
- Track journey state: active, waiting for patient, scheduled, completed, cancelled, deferred, escalated, closed.
- Support task ownership, due dates, SLAs, and closure reasons.
- Allow manual pause or closure with reason.
- Escalate clinically risky patient responses to nurse, coordinator, or doctor queue.

#### Acceptance Criteria

- A completed visit can create one or more follow-up journeys.
- Staff can view all active journeys for a patient from Patient 360.
- Missed follow-ups appear in daily workbench with priority and reason.
- Follow-up messages are not sent automatically when they include clinical interpretation unless configured and approved.
- Closure reason is required for clinically or financially significant journeys.
- Outcome of each journey is captured for measurement.

### 9.6 Staff Daily Workbench

#### Purpose

Give each user a prioritized daily action list instead of a passive CRM queue.

#### Functional Requirements

- Provide personal queue and team queue views.
- Show today, overdue, escalated, high priority, and snoozed tasks.
- Include tasks from inbox, missed calls, confirmations, no-show prevention, pre-visit missing items, follow-up journeys, pending diagnostics, and procedure conversion.
- Use Control Tower API to prioritize tasks based on urgency, SLA, risk, value, journey state, and patient context.
- Use Copilot API to summarize why the task matters and draft next action.
- Provide one-click actions: call, WhatsApp, assign, reassign, reschedule, escalate, close, defer, add note, and mark outcome.
- Prevent duplicate outreach by showing recent contact attempts and active owners.
- Track action outcome such as booked, confirmed, no answer, wrong number, patient declined, follow-up scheduled, escalated, completed, and closed.
- Show manager view for queue aging, overdue tasks, and staff workload.

#### Acceptance Criteria

- Staff can start their day from the workbench without separately checking inbox, appointment lists, and follow-up lists.
- Every task has owner, due date or SLA, priority, source, and recommended action.
- Priority recommendations include an explanation.
- Staff can capture outcome in less than two clicks after a call or message.
- Managers can audit why an overdue patient was not contacted.

### 9.7 Patient 360 Timeline

#### Purpose

Create a shared operational memory across front desk, call center, care coordination, nursing, doctors, and admins.

#### Functional Requirements

- Show patient demographics, phone numbers, caregiver details, family links, branch associations, UHIDs, consent, and communication preferences.
- Show timeline of messages, calls, appointments, visits, documents, tasks, journeys, escalations, and outcomes.
- Show current active journeys and next best action.
- Use Copilot API to summarize patient timeline and recent context.
- Use Control Tower API to surface open risks such as unresolved identity issue, missed review, no-show risk, pending diagnostics, or active escalation.
- Support role-based redaction of sensitive clinical, financial, and document data.
- Show source system for imported records.
- Show conflict warnings when imported and manually entered states disagree.
- Allow staff notes with visibility controls.

#### Acceptance Criteria

- Staff can understand the current patient state from Patient 360 without reading every message.
- Caregiver and family relationships are visible.
- Sensitive data access respects role permissions.
- AI summaries can be expanded to show source context.
- Conflicting source data is flagged rather than silently overwritten.

## 10. Role Permissions

### Permission Principles

- Access should be role-based and branch-aware.
- Staff should see only the data needed for their workflow.
- Sensitive clinical documents, financial data, and AI summaries should have stricter access controls.
- Actions that change patient identity, consent, or journey closure should be audited.

### MVP Roles

| Role | Core Access | Restricted Actions |
| --- | --- | --- |
| Front Desk | Inbox, appointment requests, Patient 360 basics, pre-visit checklist, reminders | Cannot view restricted clinical documents unless granted; cannot close clinical escalation |
| Call Center Agent | Inbox, missed calls, callbacks, campaign leads, appointment status, follow-up tasks assigned to call center | Cannot merge patients without permission; cannot view sensitive documents by default |
| Care Coordinator | Follow-up journeys, Patient 360, tasks, caregiver context, message drafting | Cannot prescribe or provide independent clinical advice |
| Nurse | Escalation queues, clinical checklist follow-up, Patient 360 clinical context, post-procedure tasks | Cannot override doctor instructions; cannot access financial data unless granted |
| Doctor | Patient timeline, pre-visit brief, documents, follow-up visibility, clinical escalations | Cannot change system configuration or staff queues by default |
| Department Admin | Department queues, metrics, backlog, escalations, staff workload | Cannot access unrelated departments unless granted |
| Branch Admin | Branch-level operations, staff queues, appointment flow, leakage metrics | Cannot access other branches unless granted |
| System Admin | Configuration, integrations, users, roles, audit exports | Should not edit clinical content except through audited admin workflows |

### Sensitive Actions Requiring Audit

- Patient merge or unmerge.
- Caregiver relationship change.
- Consent change.
- Sensitive document view or download.
- AI recommendation override for high-risk items.
- Clinical escalation closure.
- Journey closure without completed outcome.
- Message sent after patient opt-out.
- Manual correction to imported source-system data.

## 11. AI and DatacentrIQ Requirements

### Copilot API Use Cases

- Intent extraction from messages and call notes.
- Language detection and preferred language suggestions.
- Patient response drafting in Hindi, English, Hinglish, and future regional languages.
- Call-note structuring.
- Patient timeline summarization.
- Pre-visit doctor brief generation.
- Uploaded document summarization where source text is available.
- Follow-up task suggestion from visit outcome.
- Staff-facing explanation of recommended next action.

### Control Tower API Use Cases

- Inbox priority scoring.
- Missed-call recovery prioritization.
- No-show risk scoring.
- Follow-up leakage detection.
- Pending diagnostics detection.
- Procedure drop-off detection.
- SLA breach prediction.
- Escalation risk detection.
- Next-best-action recommendation.
- Outcome tracking after staff action.

### AI Output Requirements

- AI outputs must show confidence or certainty indicators where useful.
- AI outputs affecting patient identity, clinical escalation, or sensitive communication must show source evidence.
- Staff must be able to accept, edit, reject, or override AI outputs.
- Overrides and corrections should be captured for evaluation.
- AI should not provide definitive medical diagnosis or treatment instructions to patients.
- AI should escalate urgent symptom language instead of continuing routine conversation.

### Decision Trace Requirements

For recommendations generated through DatacentrIQ intelligence, HealthcareOS should store:

- Recommendation type.
- Patient or task context used.
- Source systems or source fields referenced.
- Confidence or priority score.
- Explanation shown to staff.
- Staff action taken.
- Outcome after action.
- Override reason if rejected.

## 12. Operational Edge Cases

### Identity and Family

- Parent uses one number for multiple children.
- Elderly patient is managed by son or daughter.
- Husband and wife use one shared mobile number.
- A caregiver messages about two patients in the same thread.
- Patient uses different numbers across branches.
- Walk-in patient later appears through WhatsApp.
- Imported HIS record has incomplete age, gender, or phone.
- Duplicate patients are created by different branches.
- Wrong merge creates unsafe context and must be reversible.

### Channels and Communication

- Patient sends only a voice note.
- Patient sends a prescription image without text.
- Patient switches between WhatsApp and phone calls.
- Patient asks not to be contacted again.
- Patient sends abusive, panicked, or repeated messages.
- WhatsApp template delivery fails.
- Call connects but patient is not available.
- Staff reaches a wrong number.
- Patient prefers calls over WhatsApp.
- Patient has no smartphone access.

### Appointment Operations

- Doctor becomes unavailable after booking.
- HIS sync delay causes slot conflict.
- Patient arrives without confirmation.
- Patient confirms and does not arrive.
- Patient does not confirm but arrives.
- Walk-in needs to be linked to a later digital record.
- Patient wants a specific doctor but available slot is too late.
- Patient asks for the cheapest option.
- Patient wants teleconsult when in-person visit is safer.
- Appointment is completed in HIS but not reflected in HealthcareOS.

### Pre-Visit

- Patient uploads unreadable images.
- Patient uploads someone else's report.
- Patient refuses digital document sharing.
- Consent is revoked after upload.
- Pre-visit questionnaire is partially completed.
- Insurance or TPA documents are incomplete.
- Document contains sensitive information in a general chat.

### Follow-Up

- Doctor gives verbal follow-up instructions only.
- Patient completes lab outside the provider network.
- Patient cannot afford procedure immediately.
- Patient wants a second opinion.
- Patient feels better and refuses follow-up.
- Patient deteriorates and messages front desk.
- Follow-up date falls on holiday or doctor leave.
- Patient death or case closure requires sensitive handling.
- Patient opt-out conflicts with clinically important follow-up.

### Staff Operations

- Multiple staff members contact the same patient.
- Staff marks task complete without meaningful outcome.
- Staff snoozes important tasks repeatedly.
- Manager needs to audit why a patient was not contacted.
- Branch teams and central call center both own the same patient.
- A task needs reassignment due to shift change.
- Data imported from HIS conflicts with staff-entered status.

## 13. Dependencies

### Product Dependencies

- HealthcareOS domain model for patient, caregiver, branch, provider, department, appointment, visit, document, journey, task, consent, escalation, and outcome.
- Role-based access control.
- Audit event store.
- Notification and template management.
- Patient communication preferences.
- Queue and task engine.

### Integration Dependencies

- WhatsApp Business API provider or partner integration.
- Telephony provider for missed calls, call logs, and optional call recordings/transcripts.
- Web lead capture forms.
- Document upload and secure storage.
- Optional OCR or document text extraction service.
- HIS/EMR and LIS/RIS integration are deferred from the first pilot scope.
- Optional SMS fallback.

### DatacentrIQ Dependencies

- Copilot API availability for extraction, summarization, drafting, and explanation.
- Control Tower API availability for prioritization, leakage detection, next-best-action recommendation, and outcome tracking.
- Healthcare ontology mapping between HealthcareOS entities and DatacentrIQ intelligence context.
- Decision trace contract.
- API latency and reliability targets suitable for staff workflows.
- Safe fallback behavior when DatacentrIQ APIs are unavailable.

## 14. Rollout Assumptions

- The first pilot customer is a specialty provider or multi-branch clinic/hospital network with high OPD and follow-up volume.
- WhatsApp and calls are the primary patient communication channels.
- The pilot has at least one existing system for appointments or HIS records, but data quality may be inconsistent.
- Initial deployment can begin with partial integration and manual imports if full integration is delayed.
- Staff will continue using existing HIS/EMR for clinical source-of-truth workflows.
- HealthcareOS will become the patient-facing workflow and follow-up layer.
- Initial patient communication will require staff review before sending sensitive or clinical messages.
- MVP success will be measured within 60 to 90 days using conversion, no-show, follow-up, and staff productivity metrics.

## 15. MVP Metrics

### Activation Metrics

- Percentage of inbound WhatsApp/call/web interactions captured.
- Percentage of interactions linked to patient, caregiver, or new patient record.
- Percentage of staff users active weekly.
- Number of tasks completed through daily workbench.

### Access Metrics

- Time to first response.
- Missed-call recovery rate.
- Lead-to-appointment conversion rate.
- Appointment confirmation rate.
- No-show rate.
- Reschedule completion rate.

### Continuity Metrics

- Follow-up journey creation rate after eligible visits.
- Follow-up completion rate.
- Missed review recovery rate.
- Pending diagnostics completion rate.
- Advised procedure conversion rate.
- Escalation response time.

### AI Metrics

- AI intent extraction acceptance rate.
- AI patient-match acceptance rate.
- AI draft usage rate.
- AI recommendation acceptance rate.
- AI correction rate.
- Unsafe or inappropriate output rate.
- Escalation precision for urgent language.

### Business Metrics

- Revenue recovered from missed follow-ups, diagnostics, or advised procedures.
- Staff actions completed per user per day.
- Reduction in unresolved queue aging.
- Patient opt-out rate.
- Patient complaint rate related to communication.

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Poor patient identity matching | Unsafe follow-up and wrong communication | Human approval for merges, confidence display, reversible merge, caregiver model |
| Staff adoption resistance | Low usage and duplicate work | Daily workbench as primary value, simple workflows, training, manager dashboards |
| HIS integration delays | Incomplete appointment or visit state | Support CSV/manual import, partial integration, conflict warnings |
| AI hallucination or unsafe advice | Patient safety and trust risk | Bounded prompts, no autonomous diagnosis, human approval, escalation rules, audit |
| WhatsApp delivery failures | Missed patient communication | Delivery status, retry, call fallback, SMS fallback where configured |
| Over-prioritization of revenue | Trust and clinical risk | Balance priority model with care, urgency, consent, and patient experience |
| Consent gaps | Compliance and trust risk | Consent states, opt-out handling, audit logs, restricted sends |
| Data overload in Patient 360 | Staff confusion | Summaries, active journeys, filters, source attribution |
| Multi-branch complexity | Wrong branch routing or ownership | Branch-aware permissions, routing rules, source identifiers |
| DatacentrIQ API unavailability | Degraded AI workflows | Graceful fallback to manual queues, cached context, retry logic |

## 17. Open Questions

- Which specialty should be the first pilot: eye, fertility, oncology, diabetes/CKD, maternity, dialysis, or another segment?
- What minimum HIS/appointment integration is required for the first pilot?
- Which WhatsApp provider or partner should be used first?
- Should call transcription be part of MVP, or should MVP begin with manual call disposition and notes?
- What languages should be supported at launch beyond English, Hindi, and Hinglish?
- Which follow-up journey templates should be built first?
- What clinical escalation language should be hard-coded in MVP before learning from customer-specific protocols?
- What messages can be sent automatically, and what must always require staff approval?
- How should HealthcareOS handle patient opt-out when the provider believes follow-up is clinically important?
- What is the first version of the HealthcareOS to DatacentrIQ ontology mapping?
- What latency target is acceptable for Copilot and Control Tower API calls inside staff workflows?
- What pilot ROI threshold will define success after 60 to 90 days?

## 18. Launch Readiness Checklist

- Unified inbox can ingest at least one live channel and one manual channel.
- Patient matching supports shared family numbers and caregiver workflows.
- Appointment workflow supports booking, reschedule, cancellation, confirmation, and no-show state.
- Pre-visit checklist supports document links, questionnaire, and missing-item reminders.
- Follow-up journeys can be created from visit outcomes.
- Daily workbench prioritizes tasks with explainable reasons.
- Patient 360 shows identity, timeline, journeys, consent, and open risks.
- Copilot API is integrated for at least extraction, drafting, and summarization.
- Control Tower API is integrated for at least task priority and follow-up leakage detection.
- Role permissions are enforced for sensitive data.
- Audit trails exist for identity, consent, AI recommendation, message send, and journey closure events.
- Staff can operate safely when AI APIs are unavailable.
- Pilot metrics dashboard is available for weekly review.
