# AI and DatacentrIQ Architecture Spec

## Product Context

This document defines how AI and DatacentrIQ intelligence should work inside the HealthcareOS flagship product: the AI Patient Access and Continuity Platform for the Indian market.

The platform owns the patient lifecycle from first contact to appointment, visit preparation, post-visit follow-up, journey adherence, and recovery of missed care. DatacentrIQ powers the intelligence layer through Copilot API and Control Tower API capabilities.

Control Tower intelligence must be embedded inside HealthcareOS workflows. It should not be presented as a set of standalone HealthcareOS applications.

## Architecture Thesis

HealthcareOS should be the healthcare product surface. DatacentrIQ should be the governed AI and decisioning spine.

HealthcareOS is responsible for the operational experience: patient inboxes, appointment workflows, care journeys, staff workbenches, patient timelines, integrations, consent capture, and healthcare-specific policy enforcement.

DatacentrIQ is responsible for the intelligence patterns: context understanding, copilots, priority scoring, decision traces, leakage detection, recommendations, outcome tracking, prompt and model governance, and enterprise-data reasoning.

The staff experience should feel simple:

- What is happening with this patient?
- What needs action now?
- Who should act?
- Why does the system recommend this?
- What happens if we do nothing?
- What outcome happened after action?

## AI Product Principles

### 1. Workflow-First AI

AI should appear at the point of work. It should not require staff to leave the inbox, appointment screen, patient timeline, or daily workbench to use intelligence.

Examples:

- Draft a reply inside the patient conversation.
- Explain why a patient is high priority inside the task card.
- Summarize a patient before booking or escalation.
- Generate follow-up tasks after a visit outcome is captured.

### 2. Human-in-the-Loop by Default

In the MVP, AI may suggest, draft, summarize, classify, prioritize, and route. Humans approve sensitive actions, clinical escalations, outbound patient messages, merges, journey closures, and high-impact workflow decisions.

### 3. Operational AI, Not Autonomous Clinical Care

The flagship platform should not position AI as an independent doctor. AI supports access, coordination, preparation, follow-up, documentation, escalation, and operational decisioning.

AI must not independently diagnose, prescribe, advise treatment changes, or replace clinician judgment.

### 4. India-Native Patient Context

AI should understand common Indian healthcare patterns:

- WhatsApp-first communication
- missed calls as intent
- shared family phone numbers
- caregiver-led communication
- Hinglish and regional-language messages
- branch and doctor preference
- price sensitivity
- insurance and TPA queries
- patients moving between walk-in, call, WhatsApp, and HIS records

### 5. Explainable Recommendations

Important AI suggestions must include a short explanation, key source signals, confidence, and next action. Staff should never have to trust an unexplained priority score.

### 6. Auditability and Reversibility

AI-influenced decisions must be traceable. Human approvals, overrides, edits, dismissals, and outcomes should be captured. Risky actions such as patient merge, journey closure, or clinical escalation classification must be reversible where possible.

### 7. Consent-Aware Intelligence

AI should respect communication consent, document access rules, role permissions, opt-outs, and data minimization policies. Lack of consent or unclear consent should degrade capability gracefully.

### 8. Outcome Learning

The system should learn from what happened after a recommendation:

- Was the task completed?
- Did the patient respond?
- Did the patient show up?
- Was the follow-up completed?
- Was an escalation valid?
- Did staff accept, edit, or reject the suggestion?

This feedback should improve future prioritization, workflow design, and evaluation.

## Responsibility Split

### HealthcareOS Owns

- Patient-facing and staff-facing healthcare workflows
- Product navigation, screens, states, and interaction model
- Unified patient inbox
- Patient identity and family/caregiver model
- Appointment and access orchestration
- Pre-visit preparation workflows
- Post-visit follow-up journeys
- Staff daily workbench
- Patient 360 timeline
- Healthcare-specific consent and communication preferences
- Role-based healthcare access rules
- HIS, EMR, LIS, RIS, telephony, WhatsApp, payment, and document integrations
- Source-system reconciliation and user-visible data conflicts
- Staff action capture and workflow outcomes
- Provider-specific configuration and journey templates

### DatacentrIQ Owns

- Copilot responses, summaries, drafts, and structured extraction
- Control Tower API intelligence embedded inside workflows
- Priority scoring and next-best-action recommendations
- Leakage, anomaly, and risk detection
- Decision trace generation
- Healthcare ontology reasoning
- Outcome feedback loops
- Model, prompt, and policy governance
- AI observability and evaluation signals
- Explainability patterns
- Confidence, uncertainty, and fallback behavior

### Shared Boundary

HealthcareOS sends governed context to DatacentrIQ. DatacentrIQ returns structured intelligence. HealthcareOS decides how that intelligence appears in the product, which actions require approval, and what workflow state changes occur after human action.

## Embedded AI Use Cases

### Unified Patient Inbox

Copilot API use cases:

- Extract patient intent from WhatsApp messages, call notes, web leads, and staff notes.
- Detect language and preferred response language.
- Draft replies in English, Hindi, Hinglish, or configured local languages.
- Summarize long conversation threads.
- Convert free-text call notes into structured tasks.
- Identify whether the sender is likely a patient, caregiver, referring doctor, or unknown contact.

Control Tower API intelligence embedded in the workflow:

- Prioritize inbox items by urgency, age, value, risk, and SLA.
- Flag repeated unanswered messages.
- Detect possible complaints or service recovery needs.
- Detect emergency-like language that requires immediate escalation.
- Identify high-value opportunities such as procedure interest or pending diagnostics.

Product behavior:

- AI drafts should be editable before sending.
- Clinical questions should trigger safe response templates and escalation.
- Emergency-like language should move the conversation into an urgent queue.
- Low-confidence intent extraction should be shown as a suggestion, not an automatic classification.

### Patient Identity and Matching

Copilot API use cases:

- Suggest possible patient matches from partial names, phone numbers, branch, age, gender, UHID, caregiver details, and conversation context.
- Summarize why two records may or may not be the same patient.
- Extract demographics from uploaded forms, referral slips, or prior prescriptions when allowed.

Control Tower API intelligence embedded in the workflow:

- Flag duplicate-risk clusters.
- Flag unsafe merge candidates where demographics, branch history, or clinical context conflict.
- Identify high-impact identity issues blocking follow-up or appointment conversion.

Product behavior:

- AI may suggest matches but must not auto-merge patient records.
- Merge and unmerge must be auditable.
- Family-shared phone numbers should be first-class, not treated as data errors.
- When identity is uncertain, workflows should proceed with "unverified patient" status and clear warnings.

### Appointment and Access Orchestration

Copilot API use cases:

- Translate patient request into appointment intent.
- Suggest specialty, doctor, branch, appointment type, and preparation needs.
- Draft confirmation, reminder, reschedule, and direction messages.
- Summarize patient constraints such as preferred day, location, budget concern, or doctor preference.

Control Tower API intelligence embedded in the workflow:

- Score no-show risk.
- Prioritize missed-call callbacks.
- Detect front-desk bottlenecks and aging appointment requests.
- Recommend next action for unconfirmed appointments.
- Flag cases where urgency conflicts with patient preference for a specific doctor or later date.

Product behavior:

- Staff can accept, modify, or reject routing suggestions.
- Urgent or clinically risky routing should escalate to a nurse or clinician.
- AI should not reassure the patient that a delay is medically safe.
- HIS sync conflicts should be visible before final confirmation when possible.

### Pre-Visit Preparation

Copilot API use cases:

- Summarize uploaded documents and prior reports for staff.
- Draft missing-document reminders.
- Generate doctor-facing pre-visit briefs.
- Extract key fields from insurance, TPA, referral, prescription, and lab documents when permitted.
- Identify unreadable or mismatched uploads.

Control Tower API intelligence embedded in the workflow:

- Prioritize appointments with missing critical documents.
- Detect high-risk pre-visit gaps that may cause visit failure.
- Flag patients likely to arrive unprepared.
- Identify branch or department patterns causing repeated preparation failures.

Product behavior:

- AI summaries should cite source documents or source events.
- Unreadable images should trigger a request for better upload or staff review.
- Sensitive documents should be hidden from roles without permission.
- Consent revocation should block further AI use of relevant documents where required by policy.

### Post-Visit Follow-Up Journeys

Copilot API use cases:

- Convert visit outcomes into follow-up task suggestions.
- Draft patient-friendly instructions in the preferred language.
- Summarize doctor notes into operational follow-up steps.
- Generate journey tasks for lab completion, report review, medicine refill, procedure readiness, or next review.
- Explain a follow-up plan to staff or patient in non-diagnostic language.

Control Tower API intelligence embedded in the workflow:

- Detect missed review risk.
- Prioritize patients with abnormal reports and no booked follow-up.
- Flag advised procedures that have not converted.
- Detect chronic care adherence gaps.
- Surface patients who need nurse or doctor escalation.
- Identify patients at risk of dropping out after first visit.

Product behavior:

- AI may propose a journey but humans approve journey start, modification, and closure.
- Clinical red flags should escalate instead of generating routine reminders.
- The system should distinguish "patient declined," "patient unreachable," "patient completed elsewhere," and "not clinically needed" rather than treating all as failures.

### Staff Daily Workbench

Copilot API use cases:

- Explain why a task is on today's list.
- Summarize patient context before staff calls.
- Draft follow-up notes after staff action.
- Suggest next step after a failed contact attempt.

Control Tower API intelligence embedded in the workflow:

- Rank tasks by urgency, patient risk, SLA, revenue leakage, care continuity impact, and operational backlog.
- Detect duplicate outreach risk when multiple staff are assigned.
- Identify tasks that are repeatedly deferred or closed without meaningful outcome.
- Recommend queue balancing across staff.

Product behavior:

- Staff should see "why this is priority" in plain language.
- Managers should be able to audit old priorities and actions.
- The system should prevent multiple staff from contacting the same patient at the same time when possible.
- Opt-out and do-not-contact preferences must override routine outreach.

### Patient 360 Timeline

Copilot API use cases:

- Generate concise patient summaries by role.
- Summarize timeline changes since last visit.
- Answer staff questions grounded in the patient timeline.
- Produce handoff summaries between front desk, nurse, care coordinator, and doctor.

Control Tower API intelligence embedded in the workflow:

- Surface open risks, overdue tasks, unresolved identity issues, consent gaps, and pending follow-ups.
- Highlight next-best action for the current role.
- Detect conflicting records from different source systems.

Product behavior:

- Summaries must be role-aware.
- Financial, clinical, and sensitive records should respect permissions.
- AI should show uncertainty when the timeline has conflicting or stale data.

## Healthcare Ontology Mapping

The HealthcareOS ontology should map product entities into DatacentrIQ concepts so that Copilot and Control Tower intelligence can reason consistently.

### Core Entities

| HealthcareOS Entity | DatacentrIQ Concept | Notes |
| --- | --- | --- |
| Patient | Person / subject | May have multiple identifiers, phone numbers, branches, and source systems. |
| Caregiver | Related person / proxy actor | May be primary communication contact. |
| Family group | Relationship cluster | Important for shared numbers and dependent patients. |
| Provider organization | Enterprise / tenant | Hospital, clinic chain, diagnostics chain, or specialty network. |
| Branch | Operating location | Used for routing, capacity, and local workflows. |
| Department | Service line | Used for access routing and reporting. |
| Doctor | Provider actor | Owns clinical context and visit decisions. |
| Nurse | Care actor | Handles triage, escalation, and checklist follow-up. |
| Front desk / call center user | Operations actor | Handles access and patient communication. |
| Appointment | Scheduled event | Has slot, doctor, branch, status, source, and confirmation state. |
| Visit | Care event | May come from HIS or manual outcome capture. |
| Journey | Long-running workflow | Post-op, chronic care, procedure conversion, diagnostics completion, review follow-up. |
| Task | Action unit | Owned by user/team, priority, SLA, status, outcome. |
| Conversation | Interaction stream | WhatsApp, call note, missed call, web lead, walk-in note. |
| Document | Evidence artifact | Report, prescription, referral, insurance, consent, upload. |
| Report | Diagnostic evidence | Lab/radiology/pathology artifact and structured observations where available. |
| Consent | Policy grant | Communication, document handling, AI processing, opt-out state. |
| Escalation | Risk workflow | Urgent symptom, complaint, clinical risk, identity risk, operational blockage. |
| Recommendation | Decision artifact | Suggested next action with trace, confidence, source signals. |
| Outcome | Result signal | Contacted, booked, showed up, completed follow-up, declined, unreachable, escalated, closed. |

### Relationship Patterns

- A patient may have many caregivers.
- A phone number may map to multiple patients.
- A patient may have many UHIDs across branches or source systems.
- A journey may contain many tasks, messages, appointments, reports, and outcomes.
- A recommendation should link to source events and downstream staff actions.
- A document may be attached to a patient, appointment, visit, journey, or claim-like workflow.
- A consent state may govern which users and AI processes can access specific records.

## Context Payload Patterns

HealthcareOS should send DatacentrIQ only the context needed for the requested intelligence task. Payloads should be structured, scoped, consent-aware, and role-aware.

### Common Context Envelope

Every AI request should include:

- tenant_id
- user_id and role
- facility or branch context where relevant
- patient_id or unverified contact_id where relevant
- workflow surface, such as inbox, appointment, workbench, or timeline
- requested action type
- consent and access scope
- source event IDs
- locale and preferred language
- urgency markers already known to HealthcareOS
- redaction or masking requirements

### Patient Summary Context

Use for timeline summaries, doctor briefs, nurse handoffs, and staff call preparation.

Include:

- patient demographics allowed for the role
- caregiver and communication preference
- recent appointments and visits
- active journeys
- open tasks and escalations
- recent conversations
- relevant documents or report summaries
- consent state
- source-system freshness

Avoid:

- unrelated old records
- financial data for clinical-only roles unless necessary
- sensitive documents outside the user's permission
- unsupported clinical inference

### Inbox Intent Context

Use for message classification and reply drafting.

Include:

- recent thread messages
- channel metadata
- sender identity confidence
- possible patient matches
- appointment history summary
- branch and specialty context
- available safe response templates
- escalation policies

Return:

- detected intent
- confidence
- suggested patient match if any
- urgency level
- suggested reply draft
- recommended staff action
- reason and source snippets

### Queue Prioritization Context

Use for daily workbench, missed follow-up, pending diagnostics, and no-show risk.

Include:

- candidate tasks or patients
- age and SLA
- journey state
- appointment status
- prior contact attempts
- clinical-risk markers already captured
- revenue or leakage markers where allowed
- staff capacity or team ownership when available

Return:

- priority score
- priority band
- recommended owner or queue
- recommended next action
- explanation
- key source signals
- confidence and uncertainty

### Follow-Up Journey Context

Use for journey generation and journey action suggestions.

Include:

- visit outcome
- doctor-entered follow-up instruction if available
- advised lab, report, medication, procedure, or next review
- specialty and appointment type
- journey template candidates
- patient communication preferences
- consent and do-not-contact status
- known constraints such as affordability, travel, or caregiver dependency

Return:

- proposed journey type
- tasks and due dates
- patient message drafts
- escalation rules
- required approvals
- closure criteria
- explanation

## Decision Trace Spec

Every material AI recommendation should have a decision trace.

### Trace Contents

- recommendation_id
- recommendation type
- workflow surface
- timestamp
- source event IDs
- source systems used
- policy version
- prompt or workflow version
- model or engine version
- key signals
- confidence
- uncertainty notes
- recommended action
- alternatives considered where useful
- required approval state
- staff action taken
- final outcome

### User-Facing Explanation

Staff should see a plain-language explanation such as:

"High priority because the patient missed a post-procedure review, has not responded to two reminders, and the follow-up is now three days overdue."

Avoid exposing raw model reasoning. Show the relevant source signals and operational rationale.

### Audit Use

Decision traces should support:

- manager review
- clinical safety review
- complaint investigation
- AI quality evaluation
- customer success ROI reporting
- governance and compliance checks

## Human Approval Rules

### Always Require Human Approval

- Sending patient-facing messages in the MVP
- Starting, changing, or closing clinical follow-up journeys
- Merging or unmerging patient records
- Closing urgent escalations
- Marking a patient as do-not-contact
- Communicating sensitive clinical, financial, or insurance information
- Changing appointment priority based on clinical urgency
- Escalating to a doctor or nurse in a way that changes care operations
- Using uploaded documents that have unclear consent

### May Be Automated After Trust Is Established

These may move from approval-required to supervised automation after evaluation and customer configuration:

- routine appointment reminders
- routine confirmation messages
- missing-document reminders
- low-risk follow-up reminders from approved templates
- task creation from structured HIS events
- queue ranking and assignment suggestions

### Never Fully Automate

- diagnosis
- prescribing
- treatment changes
- clinical reassurance about urgent symptoms
- denial of escalation when patient reports concerning symptoms
- irreversible patient identity actions
- suppression of patient complaints
- overriding consent or opt-out status

## Urgent Escalation Rules

Urgent escalation is a safety workflow, not a clinical diagnosis.

### Escalation Triggers

HealthcareOS should escalate when messages, call notes, or staff inputs contain:

- chest pain, severe breathlessness, stroke-like symptoms, loss of consciousness, seizure-like language, severe bleeding, severe allergic reaction, or other emergency-like descriptions
- post-procedure deterioration
- severe pain after surgery or treatment
- abnormal report concern marked urgent by source system or staff
- patient panic, repeated distress, or inability to reach responsible caregiver
- self-harm language or severe mental distress
- infant, pregnancy, elderly, or high-risk patient context with concerning symptoms
- angry or threatening complaint requiring service recovery

### Escalation Behavior

- Stop routine automation.
- Mark the conversation or task as urgent.
- Notify the configured human queue, such as nurse, doctor, emergency desk, or manager.
- Draft a safe response directing the patient to immediate human support or emergency services according to provider policy.
- Record the trigger and source text in the decision trace.
- Track time to acknowledgement and closure.

### Safety Constraints

AI must not determine that emergency-like symptoms are safe to wait. It may classify the interaction as needing human review and route it according to configured policy.

## Safety Boundaries

### Clinical Boundaries

AI must not:

- diagnose independently
- prescribe medication
- recommend dosage changes
- tell patients to stop or start medication
- interpret urgent symptoms as non-urgent without clinician review
- replace doctor or nurse triage
- claim certainty where data is incomplete

AI may:

- summarize source information
- identify operational follow-up needs
- draft patient education from approved templates
- ask the patient to contact the provider
- escalate to humans
- explain administrative steps

### Communication Boundaries

AI must not:

- send sensitive messages without approval in the MVP
- disclose information to an unverified caregiver if policy does not allow it
- ignore opt-out status
- use disrespectful, alarming, or overconfident language
- promise outcomes or availability without source confirmation

### Data Boundaries

AI must not:

- use records outside the user's permission
- use revoked-consent documents
- expose raw internal notes to patients
- infer protected or sensitive attributes beyond workflow need
- retain unnecessary context in downstream systems

## AI Evaluation Plan

Evaluation should measure safety, utility, and workflow value.

### Offline Evaluation

Test before release using curated Indian healthcare scenarios:

- Hinglish and regional-language appointment requests
- shared family phone number cases
- patient/caregiver ambiguity
- urgent symptom messages
- prescription image and report upload flows
- missed follow-up recovery
- no-show risk explanations
- complaint detection
- document consent edge cases
- duplicate patient matching

Metrics:

- intent extraction precision and recall
- urgent escalation recall
- unsafe advice rate
- patient matching accuracy
- message draft acceptance rate
- message edit distance
- summary factuality
- source citation coverage
- routing suggestion acceptance
- hallucination rate

### Online Evaluation

Measure in production:

- staff acceptance, edit, rejection, and override rates
- patient response rate
- follow-up completion lift
- no-show reduction
- missed-call recovery
- time to first response
- escalation acknowledgement time
- duplicate outreach reduction
- complaint rate
- opt-out rate
- adverse event review flags

### Human Review Sampling

Customer success, clinical operations, and product teams should review samples by workflow:

- AI-drafted messages
- urgent escalations
- low-confidence patient matches
- rejected recommendations
- closed follow-up journeys
- high-priority tasks that were not acted on

## Observability

HealthcareOS and DatacentrIQ should share observability signals.

### Product Observability

Track:

- inbox volume by source
- AI-classified intent distribution
- task creation volume
- queue aging
- priority bands
- SLA misses
- staff action outcomes
- journey starts, completions, closures, and drop-offs
- appointment confirmations, no-shows, and reschedules
- follow-up completion
- pending diagnostics recovery

### AI Observability

Track:

- request type and workflow surface
- model and prompt version
- latency
- failure rate
- confidence distribution
- low-confidence fallback rate
- human acceptance rate
- human edit rate
- human rejection rate
- escalation precision and recall proxies
- safety filter triggers
- policy-blocked outputs
- hallucination or factuality review flags

### Governance Observability

Track:

- consent-blocked AI requests
- permission-blocked context access
- patient-facing message approvals
- overrides of AI suggestions
- urgent escalation acknowledgement time
- data-source freshness
- source-system sync conflicts
- audit log completeness

## Model and Prompt Governance

### Versioning

Every AI response that affects workflow state should be associated with:

- model version
- prompt or workflow version
- policy version
- ontology mapping version
- evaluation suite version where applicable

### Change Management

Prompt, model, and policy changes should have:

- owner
- change reason
- affected workflows
- expected behavior change
- evaluation results
- rollout plan
- rollback plan

### Rollout Pattern

Recommended rollout stages:

1. Internal evaluation
2. shadow mode without staff-visible recommendations
3. staff-visible suggestions with approval
4. limited supervised automation for low-risk tasks
5. broader rollout after quality and safety thresholds are met

### Customer Configuration

Provider organizations should be able to configure:

- escalation destinations
- message approval policies
- language preferences
- follow-up journey templates
- SLA thresholds
- consent and opt-out policy settings
- role permissions
- branch and department routing rules

Configuration should be governed. Customer-level overrides must be auditable.

## Failure Modes and Product Behavior

### DatacentrIQ API Unavailable

Behavior:

- HealthcareOS core workflows continue.
- Inbox, appointment, task, and timeline screens remain usable.
- AI suggestions are hidden or marked temporarily unavailable.
- Existing human-created tasks and journeys continue.
- Staff can use manual workflows.

User message:

"AI suggestions are temporarily unavailable. You can continue manually."

### Low Confidence AI Output

Behavior:

- Show suggestion as low confidence.
- Require human review.
- Offer source signals.
- Avoid automatic state changes.
- Capture staff correction for evaluation.

### Conflicting Source Data

Behavior:

- Surface the conflict.
- Show source system and timestamp.
- Avoid confident summary.
- Ask staff to choose or verify.
- Record the resolution.

Examples:

- Appointment completed in HIS but open in HealthcareOS.
- Different ages or names across HIS and WhatsApp intake.
- Two UHIDs for the same patient.

### Consent Missing or Revoked

Behavior:

- Block AI use of restricted context.
- Show consent-required state.
- Allow staff to request consent through approved workflow.
- Avoid patient-facing drafts that reference restricted data.

### Patient Identity Uncertain

Behavior:

- Use unverified contact state.
- Restrict sensitive summaries.
- Avoid attaching documents to a confirmed patient until reviewed.
- Offer match suggestions with confidence and evidence.
- Require human approval before merge.

### Urgent Escalation Miss Risk

Behavior:

- Optimize urgent-language detection for recall over precision.
- Allow staff to manually mark urgent.
- Review false negatives through sampling and incident review.
- Keep routine automation from closing urgent-like messages silently.

### Unsafe or Out-of-Policy AI Draft

Behavior:

- Block draft.
- Show safe fallback template.
- Log policy-blocked event.
- Route to human if needed.

### Stale Data

Behavior:

- Show source freshness.
- Avoid recommendations that depend on unavailable current state.
- Ask staff to verify appointment, report, or visit status.

### Duplicate Outreach

Behavior:

- Detect active contact attempts for same patient or family contact.
- Warn staff before sending.
- Assign single owner when possible.
- Record communication ownership.

## Product Acceptance Criteria

The AI and DatacentrIQ architecture is acceptable for the MVP when:

- Staff can use core workflows without AI availability.
- AI suggestions are embedded in workflow screens, not separate DatacentrIQ surfaces.
- Every material recommendation has a user-facing explanation and audit trace.
- Patient-facing AI drafts require approval.
- Urgent escalation language routes to a human workflow.
- AI does not diagnose, prescribe, or provide clinical reassurance.
- Consent and role permissions limit what context is sent to DatacentrIQ.
- Patient identity suggestions require human approval before merge.
- Product metrics and AI quality metrics are observable.
- Staff feedback and outcomes are captured for improvement.

## Non-Goals

The flagship MVP should not use DatacentrIQ to create separate HealthcareOS Control Tower applications.

The MVP should not:

- replace HIS, EMR, LIS, RIS, billing, or telephony systems
- independently diagnose patients
- independently prescribe medication
- autonomously send sensitive messages
- automatically merge patient records
- make ABDM integration a launch blocker
- build custom diagnostic AI models
- require staff to use a separate AI analytics product to complete daily work

## Strategic Summary

HealthcareOS should make the patient lifecycle intelligent, but the intelligence should disappear into the work. DatacentrIQ provides the governed AI engine: copilots for assistance, Control Tower API intelligence for workflow prioritization and risk detection, ontology for shared meaning, decision traces for trust, and outcome loops for continuous improvement.

The product promise is not "AI answers healthcare questions." The promise is:

HealthcareOS helps Indian healthcare providers convert patient demand, prevent drop-offs, coordinate follow-up, and govern every important patient-lifecycle decision.
