# AI Patient Access and Continuity Platform: Workflows and Edge Cases

## Purpose

This document defines the operating workflows for the flagship HealthcareOS product: the AI Patient Access and Continuity Platform for Indian healthcare providers.

The platform owns the patient lifecycle from first contact to appointment, visit preparation, visit completion, follow-up, escalation, and recovery of drop-offs. It is designed for specialty provider networks, clinics, diagnostic-linked care models, and mid-sized hospital groups where patient demand, WhatsApp conversations, calls, walk-ins, and post-visit follow-up are fragmented across teams.

DatacentrIQ is used as the underlying intelligence layer through Copilot API and Control Tower API. These APIs should appear inside HealthcareOS as workflow assistance, prioritization, decision traces, and outcome tracking. Control towers must not be presented as standalone HealthcareOS applications in this product surface.

## Product Operating Principles

- HealthcareOS owns the healthcare workflow, user experience, patient graph, operational rules, and integration state.
- DatacentrIQ powers embedded intelligence: summaries, drafts, routing suggestions, risk detection, next-best actions, prioritization, decision traces, and outcome feedback.
- AI supports healthcare teams. It does not independently diagnose, prescribe, or close clinically sensitive decisions.
- WhatsApp and calls are first-class channels, not add-ons.
- Family and caregiver identity is a first-class model because many Indian patients share phone numbers or depend on relatives for care coordination.
- Every AI-assisted action must be auditable, reversible where appropriate, and explainable to staff.
- Every patient-facing message must respect consent, preferred language, opt-out status, and clinical safety boundaries.
- Staff should see "what to do next and why," not a generic CRM task list.

## Common Workflow Objects

### Patient

The person receiving care. A patient may have one or more phone numbers, UHIDs, branch records, ABHA ID if available, appointments, visits, documents, journeys, and caregivers.

### Caregiver

A person who communicates or acts on behalf of a patient, such as a spouse, parent, child, sibling, attendant, or employer representative. The caregiver may share a phone number with one or more patients.

### Conversation

An interaction thread across WhatsApp, call notes, missed calls, website leads, referral forms, walk-in notes, or internal staff handoffs.

### Journey

A structured lifecycle around a patient need, such as first consultation, post-op review, chronic care follow-up, advised diagnostic completion, medicine refill, or procedure conversion.

### Task

An operational action assigned to a staff member or team with owner, due time, priority, status, SLA, patient context, and closure outcome.

### Escalation

A task or case that requires nurse, doctor, admin, or manager attention because of clinical risk, complaint risk, operational blockage, consent issue, or repeated failed contact.

### Decision Trace

The explanation of an AI-assisted recommendation, including source data, detected pattern, confidence, safety rule, and suggested action.

## DatacentrIQ API Involvement Pattern

### Copilot API

Used for interactive assistance inside the workflow:

- Summarize patient timeline.
- Draft WhatsApp, SMS, and call scripts in the patient's preferred language.
- Convert call notes into structured intents, tasks, and journey updates.
- Generate doctor pre-visit briefs.
- Explain why a patient appears in a staff queue.
- Suggest missing data to collect from patient or caregiver.
- Translate or rewrite patient-facing communication in Hindi, Hinglish, or regional languages.

### Control Tower API

Used behind HealthcareOS workflows for governed intelligence:

- Prioritize work queues.
- Detect no-show risk, missed follow-up risk, abnormal delay, leakage, or operational bottleneck.
- Recommend next-best actions.
- Explain queue priority and intervention rationale.
- Track outcomes after staff action.
- Monitor whether interventions are improving conversion, follow-up completion, and SLA performance.

### HealthcareOS Responsibilities

- Store workflow state and patient operational records.
- Enforce consent, role permissions, channel policies, and staff approval rules.
- Integrate with HIS, EMR, appointment, telephony, WhatsApp, LIS, RIS, payment, and document systems.
- Render AI outputs in staff workflows with confidence, sources, and human approval controls.
- Capture outcomes so DatacentrIQ can improve prioritization and measure value.

## 1. End-to-End Patient Lifecycle

### Goal

Convert a patient need into a completed care journey with minimal leakage across inquiry, booking, preparation, visit, follow-up, and recovery.

### Happy Path

1. Patient or caregiver contacts the provider through WhatsApp, call, missed call, website form, referral, or walk-in.
2. HealthcareOS captures the interaction and creates or links it to a patient record.
3. AI detects language, intent, urgency, specialty, branch preference, doctor preference, and whether the sender is the patient or caregiver.
4. Staff confirms identity and books the right appointment or routes the case to the right queue.
5. The platform sends appointment confirmation and pre-visit instructions in the preferred language.
6. Patient uploads documents or answers pre-visit questions through WhatsApp or a mobile link.
7. HealthcareOS prepares a concise patient brief for the doctor or care team.
8. Patient arrives, completes the visit, and visit outcome is captured from HIS, EMR, doctor note, coordinator entry, or manual staff update.
9. AI generates the appropriate follow-up journey: review date, lab reminder, report follow-up, post-procedure check, refill, or procedure conversion.
10. Staff receives daily prioritized tasks for pending follow-ups, no-show recovery, patient questions, and escalations.
11. Patient receives approved reminders and education through WhatsApp, call, or SMS.
12. Journey is completed, closed, deferred, or moved into a longer continuity program with outcome reason captured.

### Exception Paths

- Patient cannot be confidently matched to a record.
- Sender is a caregiver and relationship is unclear.
- One phone number maps to multiple family members.
- Patient asks for clinical advice before booking.
- Patient reports emergency-like symptoms.
- Patient needs a doctor or branch that has no available slots.
- Doctor goes on leave after booking.
- Patient cannot afford the recommended consultation, diagnostic, or procedure.
- Patient does not have smartphone access for forms or document upload.
- Patient visits as walk-in before digital confirmation is complete.
- HIS shows visit completed but HealthcareOS has no journey outcome.
- Patient opts out of WhatsApp communication.

### Operational Edge Cases

- Same patient exists as separate records across branches.
- Husband and wife share one phone number and both have active journeys.
- Parent books for child using parent's number and later sends reports from another phone.
- Patient uses mixed Hindi-English, regional language, transliteration, or voice notes.
- Patient sends a prescription image with no text.
- Patient refuses to share documents digitally but agrees to bring them physically.
- Appointment was booked in HIS by front desk but not synced to HealthcareOS.
- Appointment was rescheduled on phone but not updated in source system.
- Patient is angry because of prior wait time, billing issue, or doctor delay.
- Patient is high value operationally but low priority clinically; the product must not confuse revenue value with clinical urgency.
- Patient death, transfer, or treatment discontinuation requires sensitive case closure.

### Data Captured

- Channel, source, timestamp, branch, campaign, referral source, and staff owner.
- Patient identifiers: name, age, gender, phone numbers, UHID, branch identifiers, optional ABHA ID, family or caregiver links.
- Language preference and communication preference.
- Patient intent, specialty, symptoms or reason for visit, urgency signals, affordability concerns, and doctor preference.
- Appointment details, confirmation status, no-show risk, reschedule reason, cancellation reason.
- Documents requested, documents received, consent status, and document quality status.
- Visit outcome, follow-up plan, advised diagnostics, advised procedure, medication refill need, review date.
- Tasks, escalations, staff actions, closure reasons, and final journey outcome.

### AI Assistance

- Intent and language detection.
- Patient and caregiver matching suggestions.
- Specialty and branch routing suggestions.
- Appointment no-show risk flagging.
- Pre-visit missing-item detection.
- Doctor brief generation.
- Follow-up journey suggestion based on visit outcome.
- Queue prioritization for staff.
- Local-language message drafts.
- Leakage detection for missed reviews, pending diagnostics, and unconverted advised procedures.

### DatacentrIQ API Involvement

- Copilot API structures conversations, drafts messages, summarizes timelines, and generates briefs.
- Control Tower API prioritizes lifecycle risks, recommends next-best actions, detects leakage, and provides decision traces.
- HealthcareOS stores the accepted recommendation, staff action, patient response, and final outcome.

### Acceptance Criteria

- Every inbound interaction creates or links to a patient-aware conversation.
- Staff can distinguish patient, caregiver, and family-member context before taking action.
- AI recommendations show confidence, source data, and reason where they affect routing, escalation, or prioritization.
- No patient-facing AI-generated message is sent without the configured approval level.
- Emergency-like or clinically risky language is escalated to a human queue immediately.
- Appointment, visit, follow-up, and closure outcomes are visible in one patient timeline.
- Missed follow-ups and pending diagnostics can be recovered through prioritized work queues.
- Opt-out and consent restrictions are enforced before communication.

## 2. Front Desk Workflow

### Goal

Help front desk teams handle walk-ins, bookings, reschedules, patient questions, branch routing, doctor availability, and immediate operational issues without losing context.

### Happy Path

1. Front desk opens the daily access queue.
2. A new patient request appears from WhatsApp, call, website lead, or walk-in entry.
3. AI extracts intent, preferred language, patient identity candidates, specialty, branch, and doctor preference.
4. Front desk verifies patient or caregiver identity.
5. Staff selects appointment type, doctor, branch, and slot.
6. HealthcareOS checks known conflicts, doctor availability, and required pre-visit checklist.
7. Staff confirms the appointment.
8. Patient receives confirmation, location, preparation instructions, and document request.
9. Front desk monitors confirmation status and same-day arrival status.
10. After arrival, the patient timeline updates with visit status and any handoff notes.

### Exception Paths

- Patient is a walk-in with no existing record.
- Patient is a walk-in but claims prior visits at another branch.
- Patient wants a specific doctor who is unavailable.
- Patient wants same-day appointment but all slots are full.
- Doctor leave is declared after appointments are already confirmed.
- Patient arrives late and original slot is no longer usable.
- Patient wants to reschedule repeatedly.
- Patient asks for discount, payment plan, package, or cheapest doctor.
- Patient is upset because WhatsApp confirmation did not match front-desk availability.
- Appointment source system and HealthcareOS disagree.

### Operational Edge Cases

- Multiple front desk staff edit the same appointment.
- Call center has already promised a slot that front desk cannot honor.
- Doctor accepts walk-ins informally, bypassing schedule.
- Branch manager blocks slots for VIP, emergency, or procedure cases.
- Patient books for a family member but staff incorrectly books under sender's name.
- Patient has two UHIDs at the same branch.
- Patient has separate UHIDs across branches.
- Internet or WhatsApp delivery failure prevents confirmation.
- Patient has no smartphone and needs printed or verbal instructions.
- Patient speaks only a regional language not covered by current staff.

### Data Captured

- Inquiry source and front-desk owner.
- Patient or caregiver identity confirmation.
- Appointment type, specialty, doctor, branch, slot, token if applicable.
- Booking, reschedule, cancellation, and walk-in reasons.
- Doctor leave or schedule conflict reason.
- Affordability, estimate, or payment concern category.
- Pre-visit requirements and whether they were communicated.
- Patient language preference and channel preference.
- Staff notes and handoff to doctor, nurse, or coordinator.

### AI Assistance

- Suggest matching patient records and family links.
- Detect booking intent from message or call note.
- Suggest specialty, doctor type, branch, and urgency category.
- Draft confirmation, reschedule, delay, or doctor-leave messages.
- Translate front-desk scripts into local language.
- Identify when affordability concern should route to counselor or admin.
- Flag when symptoms or patient language require clinical escalation instead of routine booking.

### DatacentrIQ API Involvement

- Copilot API powers patient matching explanation, message drafts, translation, and concise interaction summaries.
- Control Tower API provides no-show risk, slot pressure, branch routing recommendations, and priority for same-day action.
- HealthcareOS enforces booking rules, appointment source synchronization, and communication approval.

### Acceptance Criteria

- Front desk can book, reschedule, cancel, or mark walk-in without leaving the patient context.
- Staff must choose whether the requester is patient or caregiver when ambiguity exists.
- Doctor leave or branch unavailability triggers a reschedule workflow and patient communication task.
- The system prevents silent double-booking when integration data indicates a conflict.
- The patient receives confirmation only after required staff approval and channel consent checks.
- All reschedules and cancellations require reason capture.
- Front desk can see whether the patient has pending documents, prior complaints, or active follow-up journeys.

## 3. Call Center Workflow

### Goal

Help call center teams recover missed calls, convert leads, confirm appointments, follow up on post-visit actions, and document outcomes consistently.

### Happy Path

1. Missed call, campaign lead, follow-up task, or callback request enters the call center queue.
2. AI prioritizes the queue by freshness, urgency, patient value, no-show risk, follow-up risk, SLA, and prior attempts.
3. Agent opens the task and sees patient context, reason for call, suggested script, language, and prior interactions.
4. Agent calls the patient or caregiver.
5. Agent records disposition: booked, confirmed, rescheduled, unreachable, wrong number, not interested, affordability concern, needs nurse, needs doctor, callback later.
6. AI converts call notes into structured fields and follow-up tasks.
7. Patient receives any approved WhatsApp confirmation or next-step message.
8. Queue updates with outcome, next due action, and journey state.

### Exception Paths

- Patient does not answer.
- Number is switched off or invalid.
- Caregiver answers but patient is unavailable.
- Patient says they already visited or booked through another channel.
- Patient asks for medical advice.
- Patient is angry about repeated calls.
- Patient asks not to be contacted again.
- Patient needs language support not available with current agent.
- Patient wants price estimate before booking.
- Patient says they cannot afford care now.
- Patient wants second opinion before procedure.

### Operational Edge Cases

- Multiple agents call the same patient because of duplicate tasks.
- Patient uses one family phone for multiple active tasks.
- Patient calls back and reaches a different agent.
- Call drops during consent or booking confirmation.
- Call recording exists but note is incomplete.
- Telephony integration fails to post call status.
- Agent marks task complete without meaningful disposition.
- Agent promises a discount or doctor callback without authorization.
- Patient is in a noisy environment and asks for WhatsApp follow-up instead.
- Patient prefers phone calls but automated workflow keeps sending WhatsApp.

### Data Captured

- Call attempt count, timestamp, duration, agent, direction, and outcome.
- Contacted person: patient, caregiver, family member, wrong party, unknown.
- Disposition and reason codes.
- Language used.
- Patient intent, objection, affordability concern, urgency, callback time.
- Booking or reschedule details if completed.
- Follow-up action, owner, due date, and escalation need.
- Opt-out, do-not-call, or channel preference changes.

### AI Assistance

- Prioritize call queue and explain why a call matters today.
- Suggest call script based on journey and language.
- Summarize prior patient context before call.
- Convert call notes into structured dispositions and tasks.
- Detect anger, complaint, urgency, affordability concern, or clinical-risk language.
- Draft post-call WhatsApp messages.
- Suggest next action after failed attempts.

### DatacentrIQ API Involvement

- Copilot API generates scripts, summarizes history, structures notes, and drafts follow-up messages.
- Control Tower API prioritizes missed-call recovery, no-show prevention, follow-up recovery, and procedure-conversion queues.
- HealthcareOS records the final human disposition and controls retry logic, opt-out enforcement, and task assignment.

### Acceptance Criteria

- A missed call becomes a trackable task with owner, SLA, attempts, and outcome.
- Agents can see prior channel history before calling.
- Every call task requires a disposition before closure.
- Repeated failed attempts trigger configured retry or closure rules.
- Patient opt-out immediately blocks further non-essential outreach.
- Clinical-risk language during a call routes to nurse escalation.
- Duplicate active call tasks for the same patient and journey are detected or merged.
- Managers can audit why a patient was or was not contacted.

## 4. Care Coordinator Workflow

### Goal

Help care coordinators manage post-visit journeys, chronic care follow-up, diagnostic completion, procedure readiness, patient education, and continuity tasks across visits.

### Happy Path

1. Visit outcome creates or updates a care journey.
2. AI identifies the appropriate journey type, due dates, required tasks, patient language, and risk factors.
3. Coordinator opens the follow-up queue prioritized by due date, risk, pending diagnostics, missed reviews, and patient response.
4. Coordinator reviews patient timeline and doctor instructions.
5. Coordinator sends approved reminder, calls patient, or assigns a task to nurse, doctor, billing, diagnostics, or front desk.
6. Patient completes follow-up action: books review, uploads report, completes test, confirms medication, schedules procedure, or asks for callback.
7. Coordinator updates journey state and captures outcome.
8. Completed journey is closed with reason and next review plan, or moved to long-term care continuity.

### Exception Paths

- Doctor instructions are missing, unclear, or only verbal.
- Patient completed diagnostic outside the provider network.
- Patient cannot afford the advised diagnostic or procedure.
- Patient delays because family decision-maker is unavailable.
- Patient wants a second opinion.
- Patient says symptoms have improved and declines follow-up.
- Patient reports worsening symptoms during routine follow-up.
- Follow-up date falls on holiday, doctor leave, or branch closure.
- Patient moved city or wants another branch.
- Patient repeatedly postpones and becomes inactive.

### Operational Edge Cases

- Multiple journeys are active for the same patient.
- Patient is managed by caregiver but private information should not be shared without consent.
- Lab report is uploaded but belongs to another person.
- Report image is blurry or incomplete.
- Coordinator closes the journey but patient reopens via WhatsApp.
- Procedure counseling and affordability discussion happen outside the system.
- Doctor changes treatment plan after coordinator has already sent instructions.
- Patient is part of a package plan where follow-ups are prepaid.
- Patient has sensitive condition and staff access must be restricted.
- Long-term chronic care reminders risk becoming spam if not clinically useful.

### Data Captured

- Journey type, start date, due dates, stage, owner, priority, and status.
- Visit outcome and doctor instruction source.
- Follow-up requirement, diagnostic requirement, medication refill need, procedure advice.
- Patient response, objection, affordability concern, family decision-maker status.
- Documents or reports received and quality status.
- Escalations, handoffs, and closure reason.
- Outcome: completed, booked, deferred, declined, unreachable, transferred, inactive, deceased, duplicate, or clinically escalated.

### AI Assistance

- Suggest journey template from visit outcome.
- Generate task schedule and reminders.
- Prioritize follow-up queue.
- Draft local-language reminders and education.
- Summarize patient timeline for coordinator.
- Detect leakage, repeated postponement, or risk of drop-off.
- Identify when patient response requires nurse or doctor escalation.
- Suggest closure reason based on conversation and action history, subject to human confirmation.

### DatacentrIQ API Involvement

- Copilot API creates summaries, drafts reminders, explains care-plan context, and structures coordinator notes.
- Control Tower API detects missed follow-up, pending diagnostics, procedure leakage, and high-risk drop-offs; it recommends next-best actions with traceable rationale.
- HealthcareOS owns journey state, task workflow, consent enforcement, and final outcome capture.

### Acceptance Criteria

- Every completed visit with follow-up instructions can create a trackable journey.
- Coordinators can see what is due today, overdue, blocked, or escalated.
- Journey closure requires an outcome reason.
- Unclear doctor instructions cannot be converted into patient-facing clinical guidance without human clarification.
- Patient affordability concerns can be captured and routed without being treated as generic "not interested."
- Uploaded reports must be linked to the correct patient before they influence workflow.
- Missed follow-ups appear in priority queues until completed, deferred, declined, or closed with reason.

## 5. Nurse Escalation Workflow

### Goal

Route clinically sensitive or urgent patient signals to a qualified nurse or clinical staff member quickly, while keeping AI within safe operational boundaries.

### Happy Path

1. Patient message, call note, follow-up response, or front-desk entry contains possible clinical risk or escalation language.
2. AI flags the interaction as nurse review required and explains the trigger.
3. Nurse receives the escalation queue item with patient identity, context, source message, journey state, recent visit, doctor, and contact details.
4. Nurse contacts patient or caregiver using approved protocol.
5. Nurse records assessment outcome in structured fields.
6. Nurse routes to doctor callback, urgent appointment, emergency instruction protocol, routine follow-up, or closure.
7. Patient receives approved next-step instructions.
8. Escalation outcome is visible in patient timeline and relevant staff queues.

### Exception Paths

- Patient reports severe symptoms in WhatsApp outside working hours.
- Patient sends vague but concerning language such as "bahut problem hai" or "can't breathe properly."
- Caregiver reports symptoms but patient is unreachable.
- Patient refuses to come in despite nurse advice.
- Nurse cannot determine severity from available information.
- Patient is from a branch without nurse coverage.
- Patient is in a different city.
- Patient shares images or documents that may indicate clinical concern.
- Patient asks for medicine change or dosage guidance.

### Operational Edge Cases

- AI false positive creates unnecessary nurse load.
- AI false negative misses subtle regional-language risk phrase.
- Patient mixes complaint and symptom in same conversation.
- Staff tries to handle clinical concern as routine front-desk query.
- Nurse gives advice verbally but does not document outcome.
- Patient calls after escalation but reaches call center instead of nurse.
- Patient has no consent for caregiver disclosure, but caregiver is the only reachable person.
- Escalation happens during doctor leave or holiday.
- Patient needs ambulance or emergency guidance outside the provider's capability.
- Sensitive condition requires restricted visibility.

### Data Captured

- Escalation trigger, source text or call note, language, channel, and timestamp.
- Patient and caregiver identity confidence.
- Nurse owner, response time, contact attempts, and contacted person.
- Structured symptoms or concern category as allowed by protocol.
- Severity category or protocol outcome.
- Doctor callback need, urgent visit need, emergency instruction need, or routine follow-up outcome.
- Patient refusal, inability to reach, or caregiver-only communication.
- Final escalation closure reason and next task.

### AI Assistance

- Detect clinical-risk language and escalation triggers across WhatsApp, call notes, and staff entries.
- Translate and summarize patient concern for nurse review.
- Surface relevant recent visits, procedures, medications, and reports if available and permitted.
- Suggest protocol category, not diagnosis.
- Draft nurse call script and patient next-step message for approval.
- Detect repeated escalations for same patient.

### DatacentrIQ API Involvement

- Copilot API summarizes escalation context, translates mixed-language messages, and drafts approved communication.
- Control Tower API prioritizes escalations by risk, SLA, failed attempts, and operational context.
- HealthcareOS enforces clinical safety rules, role permissions, escalation SLAs, and human-only clinical decision points.

### Acceptance Criteria

- Clinical-risk language is never handled only as a routine chatbot or front-desk task.
- Nurse escalations include source text, reason for escalation, patient context, and contact options.
- AI cannot close a nurse escalation without human action.
- Nurse outcome must be captured before closure.
- Emergency-like cases follow configured provider protocol and are auditable.
- Staff outside approved roles cannot view restricted clinical details.
- Failed nurse contact attempts remain visible with next action and SLA.

## 6. Doctor Touchpoints

### Goal

Give doctors useful context before and after the visit without forcing them into a heavy CRM workflow.

### Happy Path

1. Before consultation, doctor sees a concise patient brief: reason for visit, prior visits, uploaded reports, current medicines if available, open follow-up issues, and patient concerns.
2. Doctor completes consultation in the provider's EMR, HIS, prescription tool, or existing workflow.
3. HealthcareOS receives or captures visit outcome: follow-up date, advised diagnostics, advised procedure, medication refill, patient education, red-flag instructions, or no follow-up needed.
4. AI drafts patient-friendly instructions and follow-up journey suggestions.
5. Doctor, nurse, or coordinator approves or edits follow-up plan as configured.
6. Follow-up tasks are created for coordinator, nurse, diagnostics, or front desk.
7. Doctor can later review patient timeline, pending follow-up status, and escalations when needed.

### Exception Paths

- Doctor does not use HealthcareOS during consultation.
- Visit outcome is missing because EMR/HIS integration is incomplete.
- Doctor gives verbal follow-up instruction but no structured entry.
- Doctor changes plan after patient has already received message.
- Doctor is on leave when patient follow-up becomes due.
- Doctor receives too many low-value notifications.
- Patient uploads reports after the visit and expects doctor review.
- Patient asks doctor-specific question through WhatsApp.

### Operational Edge Cases

- Doctor has different schedules across branches.
- Junior doctor, consultant, and care coordinator share responsibility.
- Follow-up should go to department, not a specific doctor.
- Doctor wants to restrict patient communication outside visit hours.
- Doctor notes contain sensitive information not suitable for patient messages.
- AI summary misses an important context because the source data is incomplete.
- Doctor disagrees with AI-suggested follow-up journey.
- Multiple doctors are involved in one patient journey.
- Doctor leave requires rerouting but patient insists on original doctor.

### Data Captured

- Pre-visit brief viewed status if available.
- Doctor, department, branch, and visit identifiers.
- Visit outcome and source of outcome.
- Follow-up date, diagnostics, procedure advice, medication refill, patient instructions.
- Approval status for AI-drafted instructions.
- Doctor-specific routing preferences and notification settings.
- Doctor override reason for AI suggestion where relevant.

### AI Assistance

- Generate pre-visit summaries.
- Highlight missing reports or unclear history.
- Summarize long patient timeline.
- Draft patient-friendly instructions in preferred language.
- Suggest follow-up journey from visit outcome.
- Summarize escalation history for doctor callback.
- Explain why a patient appears as high priority.

### DatacentrIQ API Involvement

- Copilot API generates doctor briefs, timeline summaries, patient-friendly drafts, and handoff summaries.
- Control Tower API flags high-priority patients, follow-up leakage, and unresolved escalations that require doctor awareness.
- HealthcareOS keeps doctor interaction lightweight, manages approval workflow, and stores accepted or overridden suggestions.

### Acceptance Criteria

- Doctor brief must be concise, source-linked, and clearly marked as AI-assisted.
- AI-generated clinical-facing summaries must not invent facts absent from source records.
- Patient-facing medical instructions require configured human approval before sending.
- Doctor can override or reject AI-suggested follow-up journeys.
- Doctor leave can reroute follow-up tasks without deleting original care context.
- Doctors are not notified for routine administrative tasks unless configured.

## 7. Admin Workflow

### Goal

Give operational leaders a daily view of access, continuity, backlog, leakage, team performance, patient experience, and AI-assisted workflow effectiveness.

### Happy Path

1. Admin opens daily command view.
2. HealthcareOS shows access load, missed calls, booking conversion, no-show risk, visit completion, follow-up backlog, pending diagnostics, escalations, and queue aging.
3. AI highlights operational risks, anomalies, and recommended interventions.
4. Admin drills into branch, department, doctor, team, campaign, or journey segment.
5. Admin assigns work, changes queue ownership, escalates bottlenecks, or updates operating rules.
6. Teams complete tasks and capture outcomes.
7. Admin reviews whether interventions improved conversion, completion, SLA, patient experience, and revenue recovery.

### Exception Paths

- Branch data is delayed or missing.
- HIS and HealthcareOS metrics disagree.
- Team marks many tasks complete with weak closure reasons.
- Patient complaints spike after campaign or doctor delay.
- Doctor leave creates sudden reschedule backlog.
- WhatsApp template rejection or delivery failure causes communication drop.
- Call center capacity is lower than queue demand.
- Admin sees AI recommendation but source data is insufficient.

### Operational Edge Cases

- Different branches follow different operating rules.
- One department wants aggressive follow-up and another wants low-touch follow-up.
- Staff gaming metrics by closing tasks too early.
- High volume of duplicate patients inflates workload.
- Follow-up completion improves but patient complaints increase due to over-contacting.
- Revenue recovery focus risks overshadowing clinical appropriateness.
- A VIP or sensitive case should not appear in broad dashboards.
- Regional-language communication quality varies by team.
- External systems go down during peak OPD hours.

### Data Captured

- Branch, department, doctor, team, campaign, and journey metrics.
- Queue size, aging, SLA, completion, reassignment, and closure reasons.
- Missed-call recovery, lead-to-appointment conversion, confirmation, no-show, follow-up completion.
- Pending diagnostics, advised procedure conversion, affordability objections, and drop-off reasons.
- Escalation volume, response time, outcome, and breach reason.
- AI suggestion acceptance, correction, rejection, and override reasons.
- Patient opt-out, complaint, and sentiment indicators where available.

### AI Assistance

- Explain operational anomalies.
- Prioritize backlog segments.
- Recommend staffing or queue assignment changes.
- Identify leakage patterns.
- Summarize branch or department performance.
- Detect weak closure behavior or repeated failed contact patterns.
- Recommend experiments, such as earlier reminder timing or language-specific scripts.

### DatacentrIQ API Involvement

- Copilot API answers admin questions, summarizes operational performance, and explains patient or queue segments.
- Control Tower API detects risks, bottlenecks, anomalies, leakage, and recommended interventions behind the command view.
- HealthcareOS presents these insights as operational workflows, not as separate control tower products.

### Acceptance Criteria

- Admin can see work volume, backlog, SLA, and outcomes by branch, department, doctor, and team.
- AI recommendations include rationale and source metrics.
- Admin can assign or reassign queue ownership from the dashboard.
- Closure-quality issues are detectable through required outcome fields.
- Sensitive patient records respect role and visibility restrictions.
- The system tracks whether recommended interventions were acted on and whether outcomes improved.
- Data freshness and integration status are visible where metrics may be delayed.

## 8. Patient and Caregiver Experience

### Goal

Give patients and caregivers a simple, respectful, multilingual experience across WhatsApp, calls, and mobile links without forcing them to understand provider operations.

### Happy Path

1. Patient or caregiver contacts provider through WhatsApp, phone, web form, referral, or walk-in.
2. They receive a clear response in preferred language.
3. They can book, reschedule, confirm, upload documents, ask operational questions, and receive reminders.
4. They are told what to bring, where to go, how much time to expect where available, and what next step is pending.
5. After visit, they receive approved instructions, follow-up reminders, report reminders, and education in understandable language.
6. If they reply with concern, confusion, or worsening symptoms, the system routes them to the appropriate human team.
7. Caregiver can help coordinate care where relationship and consent allow.

### Exception Paths

- Patient has no smartphone.
- Patient cannot read English or Hindi.
- Patient sends voice note instead of text.
- Patient shares phone with family.
- Patient is elderly and caregiver manages communication.
- Patient does not want WhatsApp messages.
- Patient fears cost and avoids booking.
- Patient is confused by medical terms.
- Patient sends report at night and expects immediate interpretation.
- Patient wants urgent medical advice through chat.
- Patient complains about wait time, billing, doctor behavior, or staff behavior.

### Operational Edge Cases

- Caregiver asks for sensitive report but consent is unclear.
- Patient and caregiver disagree about appointment or procedure.
- Child patient becomes adult over long-term record.
- Patient changes preferred language after first interaction.
- Patient changes branch due to travel, relocation, or affordability.
- Patient's number is reassigned to another person.
- Patient replies "yes" or "ok" ambiguously to multiple pending questions.
- Patient receives duplicate messages from call center and front desk.
- Patient has a condition requiring discreet communication.
- Patient uses multiple names or spelling variants.

### Data Captured

- Preferred language, channel, and communication time preference.
- Patient or caregiver role and relationship.
- Consent and opt-out status.
- Appointment confirmations, reschedule requests, and cancellations.
- Document upload status and patient-reported blockers.
- Patient concerns, affordability objections, complaint categories, and confusion points.
- Follow-up response, adherence status, and closure reason.

### AI Assistance

- Understand mixed-language patient messages.
- Draft simple patient-facing messages.
- Translate instructions into preferred language.
- Detect confusion, anger, urgency, affordability concern, and opt-out intent.
- Suggest whether a response should be operational, coordinator-led, nurse-led, or doctor-led.
- Summarize long interactions for staff before they respond.

### DatacentrIQ API Involvement

- Copilot API powers message drafting, translation, summarization, and intent extraction.
- Control Tower API identifies patients at risk of no-show, drop-off, missed follow-up, or repeated dissatisfaction.
- HealthcareOS enforces consent, channel rules, approval requirements, and patient-visible communication policies.

### Acceptance Criteria

- Patients can complete core actions through WhatsApp, phone, or staff-assisted workflow.
- The system supports caregiver communication without assuming caregiver equals patient.
- Preferred language and opt-out preferences are respected.
- Patient-facing messages avoid unsupported diagnosis, prescription, or clinical certainty.
- Ambiguous patient replies create staff review instead of unsafe automation.
- Sensitive communication can be restricted by patient, condition, role, or channel.
- Duplicate or conflicting outreach is minimized through shared conversation and task state.

## Cross-Workflow Acceptance Criteria

- Patient identity ambiguity is surfaced before staff act on sensitive information.
- Family number and caregiver scenarios are handled explicitly in UI and data model.
- Every task has owner, status, due time, priority, source, and closure reason.
- AI-assisted recommendations are logged with source data, confidence where available, and decision trace.
- Staff can accept, edit, reject, defer, or escalate AI suggestions.
- Patient-facing AI drafts require approval according to configured risk and message type.
- Clinical-risk language routes to nurse or doctor workflow and is not handled as routine automation.
- Doctor leave, branch routing, walk-ins, and source-system sync delays have explicit exception flows.
- Affordability concerns are captured as structured blockers, not just "not interested."
- WhatsApp delivery failure, telephony failure, and integration lag are visible to staff.
- Admins can audit who contacted the patient, what was said, what AI suggested, what humans approved, and what outcome occurred.
- HealthcareOS presents DatacentrIQ intelligence inside healthcare workflows; it does not expose control towers as separate HealthcareOS apps in this flagship product.
