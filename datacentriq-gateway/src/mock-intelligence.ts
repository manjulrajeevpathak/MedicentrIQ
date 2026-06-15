import { findSeedPatient } from "./seed.js";
import type {
  DecisionTrace,
  DecisionTraceStep,
  DraftRequest,
  DraftResult,
  AccessNextActionRequest,
  AccessNextActionResult,
  ExplainIdentityMatchRequest,
  ExplainIdentityMatchResult,
  ExtractIntentRequest,
  ExtractIntentResult,
  FollowUpLeakageRequest,
  FollowUpLeakageResult,
  IntelligenceResponse,
  LeakageItem,
  LeakageRequest,
  LeakageResult,
  NextBestAction,
  NextBestActionRequest,
  NextBestActionResult,
  PatientSignal,
  PrioritizeRequest,
  PrioritizeResult,
  SourceRef,
  SummarizeRequest,
  SummaryResult,
  UrgencyLevel
} from "./types.js";

const policyVersion = "mock-healthcareos-datacentriq-2026-06-11";

export function summarize(request: SummarizeRequest): IntelligenceResponse<SummaryResult> {
  const patient = hydratePatient(request.patient);
  const sources = buildSources(patient);
  const risks = detectRiskPhrases(patient);
  const highlights = compact([
    patient.specialty ? `Specialty: ${patient.specialty}` : undefined,
    patient.doctorName ? `Doctor: ${patient.doctorName}` : undefined,
    patient.appointmentStatus ? `Appointment status: ${patient.appointmentStatus}` : undefined,
    patient.nextFollowUpAt ? `Next follow-up: ${patient.nextFollowUpAt}` : undefined,
    patient.caregiverName ? `Caregiver: ${patient.caregiverName}` : undefined
  ]);
  const recommendedFollowUps = recommendFollowUps(patient);
  const fallback = sources.length === 0;
  const title = `${displayName(patient)} ${request.summaryType ?? "patient_brief"}`;
  const summary = fallback
    ? "Limited patient context is available. Confirm identity, specialty, recent visit, and current patient need before taking action."
    : [
        `${displayName(patient)} is linked to ${patient.specialty ?? "an unspecified specialty"}.`,
        latestInteractionText(patient),
        recommendedFollowUps.length > 0
          ? `Recommended next step: ${recommendedFollowUps[0]}`
          : "No immediate follow-up action was detected from the provided context."
      ].join(" ");

  return response(request.requestId, "summarize", fallback ? "fallback" : "ok", fallback ? 0.46 : confidenceFromSignals(patient), {
    title,
    summary,
    highlights,
    risks,
    recommendedFollowUps
  }, sources, trace([
    {
      id: "patient-context",
      label: "Read patient context",
      rationale: `Used ${sources.length} source signals from patient profile, interactions, reports, tasks, and payments.`
    },
    {
      id: "risk-detection",
      label: "Detected care risks",
      rationale: risks.length > 0 ? risks.join("; ") : "No high-risk signals were found in the mock rules."
    },
    {
      id: "follow-up",
      label: "Selected follow-up recommendations",
      rationale: recommendedFollowUps.length > 0 ? recommendedFollowUps.join("; ") : "No follow-up recommendation was generated."
    }
  ]), fallbackReason(fallback, "summary"));
}

export function draft(request: DraftRequest): IntelligenceResponse<DraftResult> {
  const patient = hydratePatient(request.patient);
  const sources = buildSources(patient);
  const language = request.language ?? patient.preferredLanguage ?? "English";
  const channel = request.channel ?? "whatsapp";
  const intent = request.intent ?? inferIntentFromPatient(patient);
  const tone = request.tone ?? (hasCriticalReport(patient) ? "urgent" : "warm");
  const fallback = !patient.patientName && sources.length === 0;
  const greeting = patient.patientName ? `Hello ${patient.patientName}` : "Hello";
  const message = fallback
    ? "Hello, this is your healthcare team. We wanted to check in and help with your appointment or follow-up. Please reply with a suitable time for a call."
    : buildDraftMessage(greeting, intent, language, tone, patient);

  return response(request.requestId, "draft", fallback ? "fallback" : "ok", fallback ? 0.42 : 0.76, {
    channel,
    language,
    message,
    approvalRequired: true,
    guardrails: [
      "Human approval required before sending.",
      "Does not diagnose, prescribe, or replace clinician advice.",
      "Avoid sharing sensitive details unless patient identity and consent are confirmed."
    ]
  }, sources, trace([
    {
      id: "intent",
      label: "Selected message intent",
      rationale: `Message intent resolved as ${intent}.`
    },
    {
      id: "language",
      label: "Selected language",
      rationale: `Language resolved as ${language}.`
    },
    {
      id: "approval",
      label: "Applied approval policy",
      rationale: "Patient-facing outbound communication is generated as a draft requiring staff approval."
    }
  ]), fallbackReason(fallback, "draft"));
}

export function extractIntent(request: ExtractIntentRequest): IntelligenceResponse<ExtractIntentResult> {
  const text = request.text ?? "";
  const normalized = text.toLowerCase();
  const sources = text
    ? [{
        id: "incoming-text",
        type: "message" as const,
        label: "Incoming patient text",
        excerpt: text.slice(0, 180)
      }]
    : [];
  const primaryIntent = inferIntentFromText(normalized);
  const urgency = inferUrgency(normalized);
  const specialtyHint = inferSpecialty(normalized, request.patient);
  const entities = extractEntities(normalized);
  const fallback = normalized.trim().length < 3;

  return response(request.requestId, "extract_intent", fallback ? "fallback" : "ok", fallback ? 0.35 : 0.72, {
    primaryIntent: fallback ? "needs_human_review" : primaryIntent,
    secondaryIntents: inferSecondaryIntents(normalized),
    urgency,
    specialtyHint,
    entities,
    suggestedQueue: queueForIntent(primaryIntent, urgency)
  }, sources, trace([
    {
      id: "keyword-routing",
      label: "Applied keyword intent routing",
      rationale: fallback ? "Input was too short for reliable routing." : `Matched intent ${primaryIntent}.`
    },
    {
      id: "urgency",
      label: "Estimated urgency",
      rationale: `Urgency resolved as ${urgency}.`
    },
    {
      id: "queue",
      label: "Selected queue",
      rationale: `Queue selected from intent and urgency.`
    }
  ]), fallbackReason(fallback, "intent extraction"));
}

export function prioritize(request: PrioritizeRequest): IntelligenceResponse<PrioritizeResult> {
  const items = request.items.map(hydratePatient);
  const sources = items.flatMap(buildSources).slice(0, 12);
  const objective = request.objective ?? "follow_up";
  const orderedItems = items
    .map((patient) => {
      const scored = scorePatient(patient, objective);
      return {
        patientId: patient.patientId,
        patientName: patient.patientName,
        score: scored.score,
        urgency: scored.urgency,
        reasons: scored.reasons,
        recommendedOwnerRole: ownerForPatient(patient, scored.urgency)
      };
    })
    .sort((a, b) => b.score - a.score);
  const fallback = items.length === 0;

  return response(request.requestId, "prioritize", fallback ? "fallback" : "ok", fallback ? 0.38 : 0.79, {
    objective,
    orderedItems
  }, sources, trace([
    {
      id: "scoring",
      label: "Scored patient signals",
      rationale: `Scored ${items.length} patients for ${objective}.`
    },
    {
      id: "ranking",
      label: "Ranked queue",
      rationale: "Sorted patients by deterministic mock score."
    },
    {
      id: "ownership",
      label: "Assigned owner role",
      rationale: "Owner role selected from urgency, reports, payment, and appointment signals."
    }
  ]), fallbackReason(fallback, "prioritization"));
}

export function detectLeakage(request: LeakageRequest): IntelligenceResponse<LeakageResult> {
  const items = request.items.map(hydratePatient);
  const leakageType = request.leakageType ?? "all";
  const leakageItems = items.flatMap((patient) => detectPatientLeakage(patient, leakageType));
  const fallback = items.length === 0;

  return response(request.requestId, "detect_leakage", fallback ? "fallback" : "ok", fallback ? 0.36 : 0.81, {
    leakageType,
    items: leakageItems,
    totalDetected: leakageItems.length
  }, items.flatMap(buildSources).slice(0, 12), trace([
    {
      id: "follow-up-leakage",
      label: "Checked follow-up leakage",
      rationale: "Looked for no-show, overdue follow-up, and open recovery tasks."
    },
    {
      id: "diagnostics-leakage",
      label: "Checked diagnostics leakage",
      rationale: "Looked for abnormal or critical reports without review."
    },
    {
      id: "revenue-leakage",
      label: "Checked revenue leakage",
      rationale: "Looked for pending procedure, package, or payment signals."
    }
  ]), fallbackReason(fallback, "leakage detection"));
}

export function nextBestActions(request: NextBestActionRequest): IntelligenceResponse<NextBestActionResult> {
  const patient = hydratePatient(request.patient);
  const objective = request.objective ?? "continue_care";
  const actions = buildActions(patient, objective);
  const fallback = actions.length === 0;

  return response(request.requestId, "next_best_actions", fallback ? "fallback" : "ok", fallback ? 0.44 : 0.82, {
    objective,
    actions: fallback
      ? [{
          actionId: "verify-context",
          label: "Verify patient context and create a manual follow-up task",
          ownerRole: "front_desk",
          urgency: "medium",
          rationale: "The provided context is too limited for a specific recommendation.",
          draftAvailable: false
        }]
      : actions
  }, buildSources(patient), trace([
    {
      id: "objective",
      label: "Read objective",
      rationale: `Objective resolved as ${objective}.`
    },
    {
      id: "candidate-actions",
      label: "Generated candidate actions",
      rationale: `${actions.length} candidate actions were generated from patient signals.`
    },
    {
      id: "safety",
      label: "Applied safety boundary",
      rationale: "Recommendations are operational and require staff action for patient communication."
    }
  ]), fallbackReason(fallback, "next-best-action"));
}

export function explainIdentityMatch(
  request: ExplainIdentityMatchRequest
): IntelligenceResponse<ExplainIdentityMatchResult> {
  const requesterText = compact([request.requester.name, request.requester.phone, request.requester.message]).join(" ");
  const requesterType = /son|daughter|wife|husband|father|mother|caregiver|for my/i.test(requesterText)
    ? "caregiver"
    : request.requester.name || request.requester.phone
      ? "patient"
      : "unknown";
  const explanations = request.candidates.map((candidate) => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 42;

    if (candidate.phone && request.requester.phone && normalizePhone(candidate.phone) === normalizePhone(request.requester.phone)) {
      score += 32;
      reasons.push("Requester phone matches candidate or household phone.");
    }

    if (candidate.patientName && request.requester.name && candidate.patientName.toLowerCase().includes(request.requester.name.toLowerCase())) {
      score += 18;
      reasons.push("Requester name is similar to patient name.");
    }

    if (candidate.caregiverName && request.requester.name && candidate.caregiverName.toLowerCase().includes(request.requester.name.toLowerCase())) {
      score += 16;
      reasons.push("Requester name is similar to recorded caregiver.");
    }

    if (candidate.householdId) {
      reasons.push("Candidate belongs to a household context.");
    }

    if (!candidate.uhid) {
      warnings.push("UHID is missing; staff should verify demographics before linking.");
    }

    if (requesterType === "caregiver" && !candidate.caregiverName) {
      warnings.push("Requester appears to be a caregiver but candidate has no caregiver match.");
    }

    const confidence = Math.min(94, score);
    return {
      candidateId: candidate.patientId ?? candidate.householdId ?? "unknown-candidate",
      patientName: candidate.patientName,
      householdId: candidate.householdId,
      confidence,
      recommendation:
        confidence >= 78
          ? candidate.householdId && requesterType === "caregiver"
            ? "link_household" as const
            : "link_patient" as const
          : confidence >= 55
            ? "manual_review" as const
            : "create_patient" as const,
      reasons: reasons.length ? reasons : ["Candidate has limited overlap with requester context."],
      warnings
    };
  }).sort((a, b) => b.confidence - a.confidence);
  const fallback = request.candidates.length === 0;

  return response(request.requestId, "explain_identity_match", fallback ? "fallback" : "ok", fallback ? 0.34 : 0.78, {
    requesterType,
    explanations,
    recommendedAction: fallback
      ? "Create an unverified patient or collect more identity details."
      : explanations[0]?.recommendation === "manual_review"
        ? "Open identity resolution before linking this thread."
        : "Review the top candidate and link only after staff verification."
  }, [{
    id: "identity-request",
    type: "profile",
    label: "Identity request",
    excerpt: requesterText.slice(0, 180)
  }], trace([
    {
      id: "requester-context",
      label: "Classified requester",
      rationale: `Requester classified as ${requesterType}.`
    },
    {
      id: "candidate-score",
      label: "Scored identity candidates",
      rationale: `Scored ${request.candidates.length} candidates using phone, name, household, UHID, and caregiver signals.`
    }
  ]), fallbackReason(fallback, "identity matching"));
}

export function accessNextActions(request: AccessNextActionRequest): IntelligenceResponse<AccessNextActionResult> {
  const patient = hydratePatient(request.patient);
  const access = request.accessRequest ?? {};
  const text = compact([access.specialty, access.preferredDoctor, access.preferredBranch, access.status, latestInteractionText(patient)]).join(" ").toLowerCase();
  const urgent = /pain|urgent|emergency|post.?op|bleeding|breath|critical/.test(text);
  const noShowRisk = patient.appointmentStatus === "no_show" || /reschedule|missed|not confirm/.test(text) ? "high" : urgent ? "medium" : "low";
  const actions: NextBestAction[] = [
    {
      actionId: "verify-identity-before-slot",
      label: "Verify patient or caregiver identity before confirming a slot",
      ownerRole: "front_desk",
      urgency: urgent ? "high" : "medium",
      rationale: "Access requests from WhatsApp or missed calls should not be booked under the wrong family member.",
      draftAvailable: false
    },
    {
      actionId: "offer-slot-with-prep",
      label: "Offer best slot and attach pre-visit checklist",
      ownerRole: "front_desk",
      urgency: noShowRisk,
      rationale: "Confirmation plus preparation reduces no-show and visit-failure risk.",
      draftAvailable: true
    }
  ];

  if (urgent) {
    actions.unshift({
      actionId: "clinical-safety-review",
      label: "Route to nurse before routine booking",
      ownerRole: "nurse",
      urgency: "high",
      rationale: "The request contains clinical-risk language and should not be handled as routine booking.",
      draftAvailable: true
    });
  }

  return response(request.requestId, "access_next_actions", "ok", 0.8, {
    noShowRisk,
    recommendedQueue: urgent ? "nurse_escalation" : "access_confirmation",
    slotStrategy: access.preferredDoctor
      ? "Respect doctor preference when available, but show alternate slots if SLA risk increases."
      : "Offer earliest specialty-matched branch slot and capture patient constraints.",
    actions
  }, buildSources(patient), trace([
    {
      id: "access-context",
      label: "Read access request",
      rationale: "Used specialty, doctor, branch preference, appointment status, and latest patient interaction."
    },
    {
      id: "safety-routing",
      label: "Applied safety routing",
      rationale: urgent ? "Clinical-risk terms detected; nurse route recommended." : "No clinical-risk terms required nurse-first routing."
    }
  ]));
}

export function followUpLeakage(request: FollowUpLeakageRequest): IntelligenceResponse<FollowUpLeakageResult> {
  const patient = hydratePatient(request.patient);
  const journey = request.journey ?? {};
  const dueAt = journey.dueAt ? new Date(journey.dueAt).getTime() : undefined;
  const overdue = dueAt ? dueAt < Date.now() : false;
  const leakageSignals = detectPatientLeakage(patient, "all");
  const severity = leakageSignals.some((item) => item.severity === "critical")
    ? "critical"
    : overdue || leakageSignals.some((item) => item.severity === "high")
      ? "high"
      : leakageSignals.length
        ? "medium"
        : "low";
  const leakageDetected = overdue || leakageSignals.length > 0 || journey.status === "missed";
  const reasons = compact([
    overdue ? "Journey due time has passed." : undefined,
    journey.status === "missed" ? "Journey status is missed." : undefined,
    ...leakageSignals.flatMap((item) => item.evidence)
  ]);

  return response(request.requestId, "follow_up_leakage", leakageDetected ? "ok" : "fallback", leakageDetected ? 0.82 : 0.48, {
    leakageDetected,
    severity,
    reasons: reasons.length ? reasons : ["No strong follow-up leakage signal was found in the supplied context."],
    recommendedOwnerRole: severity === "critical" || severity === "high" ? "care_coordinator" : "front_desk",
    nextAction: leakageDetected
      ? "Create a same-day follow-up task and send an approved patient or caregiver reminder."
      : "Keep journey active and monitor the next due event."
  }, buildSources(patient), trace([
    {
      id: "journey-state",
      label: "Checked journey state",
      rationale: `Journey status is ${journey.status ?? "unknown"} and due date is ${journey.dueAt ?? "not supplied"}.`
    },
    {
      id: "leakage-signals",
      label: "Checked leakage signals",
      rationale: `${reasons.length} leakage evidence signal(s) found.`
    }
  ]), leakageDetected ? undefined : fallbackReason(true, "follow-up leakage"));
}

function hydratePatient(patient: PatientSignal): PatientSignal {
  const seeded = findSeedPatient(patient.patientId);
  return seeded ? { ...seeded, ...patient } : patient;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function response<T>(
  requestId: string | undefined,
  task: IntelligenceResponse<T>["task"],
  status: IntelligenceResponse<T>["status"],
  confidence: number,
  result: T,
  sources: SourceRef[],
  decisionTrace: DecisionTrace,
  fallback?: IntelligenceResponse<T>["fallback"]
): IntelligenceResponse<T> {
  return {
    requestId: requestId ?? createId("req"),
    status,
    task,
    confidence,
    data: result,
    result,
    sources,
    decisionTrace,
    ...(fallback ? { fallback } : {})
  };
}

function trace(steps: DecisionTraceStep[]): DecisionTrace {
  return {
    traceId: createId("trace"),
    mode: "mock",
    policyVersion,
    generatedAt: new Date().toISOString(),
    steps
  };
}

function buildSources(patient: PatientSignal): SourceRef[] {
  const sources: SourceRef[] = [];

  if (patient.patientId || patient.patientName) {
    sources.push({
      id: patient.patientId ?? "profile",
      type: "profile",
      label: "Patient profile",
      excerpt: compact([patient.patientName, patient.specialty, patient.branch]).join(" | ")
    });
  }

  for (const [index, message] of (patient.messages ?? []).entries()) {
    sources.push({
      id: `message-${index + 1}`,
      type: "message",
      label: "Patient message",
      excerpt: message
    });
  }

  for (const [index, callNote] of (patient.callNotes ?? []).entries()) {
    sources.push({
      id: `call-note-${index + 1}`,
      type: "call_note",
      label: "Call note",
      excerpt: callNote
    });
  }

  for (const report of patient.reports ?? []) {
    sources.push({
      id: report.id ?? createId("report"),
      type: "report",
      label: report.name,
      excerpt: report.summary ?? report.status
    });
  }

  for (const task of patient.openTasks ?? []) {
    sources.push({
      id: task.id ?? createId("task"),
      type: "task",
      label: task.title,
      excerpt: task.status ?? "open"
    });
  }

  for (const payment of patient.payments ?? []) {
    sources.push({
      id: payment.id ?? createId("payment"),
      type: "payment",
      label: payment.label ?? "Payment",
      excerpt: payment.status
    });
  }

  return sources;
}

function detectRiskPhrases(patient: PatientSignal): string[] {
  const risks: string[] = [];

  if (patient.appointmentStatus === "no_show") {
    risks.push("Patient has a no-show appointment status.");
  }

  if (hasAbnormalReport(patient)) {
    risks.push("Patient has an abnormal report that may need review.");
  }

  if (hasCriticalReport(patient)) {
    risks.push("Patient has a critical report signal requiring prompt human review.");
  }

  if (hasPendingPayment(patient)) {
    risks.push("Patient has a pending payment or package conversion signal.");
  }

  if (patient.openTasks?.some((task) => task.status !== "done")) {
    risks.push("Patient has open operational tasks.");
  }

  return risks;
}

function recommendFollowUps(patient: PatientSignal): string[] {
  const recommendations: string[] = [];

  if (patient.appointmentStatus === "no_show") {
    recommendations.push("Call patient to recover the missed appointment and offer a new slot.");
  }

  if (hasAbnormalReport(patient)) {
    recommendations.push("Route report to nurse or doctor queue and book review follow-up.");
  }

  if (hasPendingPayment(patient)) {
    recommendations.push("Share approved estimate or payment link after staff review.");
  }

  if (patient.nextFollowUpAt) {
    recommendations.push("Confirm next follow-up and send reminder in preferred language.");
  }

  if (recommendations.length === 0 && patient.appointmentStatus === "booked") {
    recommendations.push("Send pre-visit instructions and collect required documents.");
  }

  return recommendations;
}

function scorePatient(patient: PatientSignal, objective: string): { score: number; urgency: UrgencyLevel; reasons: string[] } {
  let score = 20;
  const reasons: string[] = [];

  if (patient.appointmentStatus === "no_show") {
    score += 25;
    reasons.push("No-show requires recovery.");
  }

  if (hasCriticalReport(patient)) {
    score += 35;
    reasons.push("Critical report signal.");
  } else if (hasAbnormalReport(patient)) {
    score += 22;
    reasons.push("Abnormal report is pending review.");
  }

  if (hasPendingPayment(patient)) {
    score += objective === "revenue" ? 28 : 16;
    reasons.push("Pending payment or package conversion.");
  }

  const highPriorityTask = patient.openTasks?.some((task) => task.priority === "high" && task.status !== "done");
  if (highPriorityTask) {
    score += 18;
    reasons.push("High-priority open task.");
  }

  if (patient.nextFollowUpAt) {
    score += 10;
    reasons.push("Follow-up date is present.");
  }

  if (objective === "clinical_risk" && (hasAbnormalReport(patient) || hasCriticalReport(patient))) {
    score += 18;
    reasons.push("Clinical-risk objective increases report priority.");
  }

  return {
    score: clamp(score, 0, 100),
    urgency: urgencyFromScore(score),
    reasons: reasons.length > 0 ? reasons : ["No urgent signal; keep in routine queue."]
  };
}

function detectPatientLeakage(patient: PatientSignal, leakageType: string): LeakageItem[] {
  const items: LeakageItem[] = [];

  if ((leakageType === "all" || leakageType === "follow_up") && patient.appointmentStatus === "no_show") {
    items.push({
      patientId: patient.patientId,
      patientName: patient.patientName,
      leakageType: "follow_up",
      severity: "high",
      evidence: ["Appointment status is no_show."],
      suggestedAction: "Create recovery call task and offer nearest available slot."
    });
  }

  if ((leakageType === "all" || leakageType === "diagnostics") && hasAbnormalReport(patient)) {
    items.push({
      patientId: patient.patientId,
      patientName: patient.patientName,
      leakageType: "diagnostics",
      severity: hasCriticalReport(patient) ? "critical" : "high",
      evidence: ["Abnormal or critical report is not fully reviewed."],
      suggestedAction: "Route report to clinical queue and book patient review."
    });
  }

  if ((leakageType === "all" || leakageType === "payment") && hasPendingPayment(patient)) {
    items.push({
      patientId: patient.patientId,
      patientName: patient.patientName,
      leakageType: "payment",
      severity: "medium",
      evidence: ["Payment status is pending."],
      suggestedAction: "Ask staff to verify estimate and send approved payment follow-up."
    });
  }

  if ((leakageType === "all" || leakageType === "procedure") && textFromPatient(patient).includes("surgery")) {
    items.push({
      patientId: patient.patientId,
      patientName: patient.patientName,
      leakageType: "procedure",
      severity: "high",
      evidence: ["Procedure interest or surgery counselling signal found."],
      suggestedAction: "Assign care coordinator for counselling and blocker resolution."
    });
  }

  return items;
}

function buildActions(patient: PatientSignal, objective: string): NextBestAction[] {
  const actions: NextBestAction[] = [];

  if (patient.appointmentStatus === "no_show") {
    actions.push({
      actionId: "recover-no-show",
      label: "Call patient and recover missed appointment",
      ownerRole: "call_center",
      urgency: "high",
      rationale: "Patient has no-show status and should be offered a new slot.",
      draftAvailable: true
    });
  }

  if (hasAbnormalReport(patient)) {
    actions.push({
      actionId: "review-abnormal-report",
      label: "Route abnormal report for review and book follow-up",
      ownerRole: hasCriticalReport(patient) ? "doctor" : "nurse",
      urgency: hasCriticalReport(patient) ? "critical" : "high",
      rationale: "Abnormal report signal found without sufficient closure.",
      draftAvailable: true
    });
  }

  if (hasPendingPayment(patient)) {
    actions.push({
      actionId: "resolve-payment-blocker",
      label: "Resolve payment or estimate blocker",
      ownerRole: "care_coordinator",
      urgency: objective === "recover_leakage" ? "high" : "medium",
      rationale: "Pending payment may block procedure or package conversion.",
      draftAvailable: true
    });
  }

  if (patient.appointmentStatus === "booked") {
    actions.push({
      actionId: "prepare-visit",
      label: "Send pre-visit checklist and confirm attendance",
      ownerRole: "front_desk",
      urgency: "medium",
      rationale: "Booked patient should receive preparation support to reduce no-show risk.",
      draftAvailable: true
    });
  }

  if (patient.nextFollowUpAt) {
    actions.push({
      actionId: "confirm-follow-up",
      label: "Confirm upcoming follow-up with patient or caregiver",
      ownerRole: "front_desk",
      urgency: "medium",
      rationale: "Follow-up date is present and should be confirmed.",
      draftAvailable: true
    });
  }

  return actions.slice(0, 5);
}

function buildDraftMessage(greeting: string, intent: string, language: string, tone: string, patient: PatientSignal): string {
  const languageHint = language.toLowerCase() === "hindi" ? " Kripya suitable time confirm karein." : "";

  if (intent.includes("appointment") || patient.appointmentStatus === "booked") {
    return `${greeting}, this is a reminder from your healthcare team. Your appointment${patient.appointmentAt ? ` is scheduled for ${patient.appointmentAt}` : " is scheduled"}. Please confirm if you will attend or need help rescheduling.${languageHint}`;
  }

  if (intent.includes("report") || hasAbnormalReport(patient)) {
    return `${greeting}, we received your report and would like to help schedule a review with the care team. Please reply with a suitable time for a callback.`;
  }

  if (intent.includes("payment") || hasPendingPayment(patient)) {
    return `${greeting}, our team can help with the estimate and next steps for your planned care. Please confirm a suitable time for a quick call.`;
  }

  if (tone === "urgent") {
    return `${greeting}, your care team would like to speak with you today regarding your recent update. Please reply with a suitable callback time.`;
  }

  return `${greeting}, your healthcare team is following up on your care journey. Please reply with a convenient time if you need help with appointment, reports, or next steps.`;
}

function inferIntentFromPatient(patient: PatientSignal): string {
  const text = textFromPatient(patient);

  if (text.includes("report") || hasAbnormalReport(patient)) {
    return "report_follow_up";
  }

  if (text.includes("payment") || text.includes("estimate") || hasPendingPayment(patient)) {
    return "payment_or_estimate_follow_up";
  }

  if (text.includes("reschedule") || patient.appointmentStatus === "booked") {
    return "appointment_confirmation";
  }

  if (patient.appointmentStatus === "no_show") {
    return "missed_appointment_recovery";
  }

  return "general_care_follow_up";
}

function inferIntentFromText(text: string): string {
  if (containsAny(text, ["after surgery", "post surgery", "post-op", "post op", "postoperative", "operation"])) {
    return "post_op_concern";
  }

  if (containsAny(text, ["book", "appointment", "slot", "reschedule", "cancel"])) {
    return "appointment_request";
  }

  if (containsAny(text, ["report", "test", "hba1c", "scan", "xray", "mri", "ct"])) {
    return "report_or_diagnostics_query";
  }

  if (containsAny(text, ["pain", "bleeding", "breath", "emergency", "critical", "fever"])) {
    return "clinical_escalation";
  }

  if (containsAny(text, ["pay", "payment", "insurance", "tpa", "estimate", "cost"])) {
    return "payment_or_insurance_query";
  }

  if (containsAny(text, ["medicine", "refill", "dose", "tablet"])) {
    return "medication_query";
  }

  return "general_query";
}

function inferSecondaryIntents(text: string): string[] {
  const intents: string[] = [];

  if (containsAny(text, ["doctor", "specialist"])) {
    intents.push("doctor_preference");
  }

  if (containsAny(text, ["hindi", "english", "tamil", "telugu", "marathi", "bengali"])) {
    intents.push("language_preference");
  }

  if (containsAny(text, ["wife", "husband", "father", "mother", "son", "daughter"])) {
    intents.push("caregiver_or_family_context");
  }

  return intents;
}

function inferUrgency(text: string): UrgencyLevel {
  if (containsAny(text, ["emergency", "cannot breathe", "chest pain", "unconscious", "critical"])) {
    return "critical";
  }

  if (containsAny(text, ["pain", "bleeding", "fever", "urgent", "high sugar"])) {
    return "high";
  }

  if (containsAny(text, ["reschedule", "report", "payment", "insurance"])) {
    return "medium";
  }

  return "low";
}

function inferSpecialty(text: string, patient: PatientSignal | undefined): string | undefined {
  if (patient?.specialty) {
    return patient.specialty;
  }

  if (containsAny(text, ["eye", "cataract", "vision"])) {
    return "Ophthalmology";
  }

  if (containsAny(text, ["sugar", "hba1c", "diabetes"])) {
    return "Diabetes";
  }

  if (containsAny(text, ["pregnancy", "antenatal", "scan"])) {
    return "Maternity";
  }

  if (containsAny(text, ["kidney", "dialysis"])) {
    return "Nephrology";
  }

  return undefined;
}

function extractEntities(text: string): Record<string, string[]> {
  const entities: Record<string, string[]> = {};
  const phoneMatches = text.match(/\b[6-9]\d{9}\b/g);
  const timeMatches = text.match(/\b(?:today|tomorrow|morning|evening|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/g);

  if (phoneMatches) {
    entities.phone = phoneMatches;
  }

  if (timeMatches) {
    entities.timePreference = Array.from(new Set(timeMatches));
  }

  return entities;
}

function queueForIntent(intent: string, urgency: UrgencyLevel): string {
  if (urgency === "critical") {
    return "clinical_escalation";
  }

  if (intent.includes("appointment")) {
    return "front_desk";
  }

  if (intent.includes("report") || intent.includes("clinical")) {
    return "nurse_review";
  }

  if (intent.includes("payment") || intent.includes("insurance")) {
    return "billing_or_tpa";
  }

  return "general_patient_support";
}

function ownerForPatient(patient: PatientSignal, urgency: UrgencyLevel): string {
  if (urgency === "critical") {
    return "doctor";
  }

  if (hasAbnormalReport(patient)) {
    return "nurse";
  }

  if (hasPendingPayment(patient)) {
    return "care_coordinator";
  }

  if (patient.appointmentStatus === "booked" || patient.appointmentStatus === "no_show") {
    return "front_desk";
  }

  return "call_center";
}

function hasAbnormalReport(patient: PatientSignal): boolean {
  return Boolean(patient.reports?.some((report) => report.status === "abnormal" || report.status === "critical"));
}

function hasCriticalReport(patient: PatientSignal): boolean {
  return Boolean(patient.reports?.some((report) => report.status === "critical"));
}

function hasPendingPayment(patient: PatientSignal): boolean {
  return Boolean(patient.payments?.some((payment) => payment.status === "pending" || payment.status === "failed"));
}

function confidenceFromSignals(patient: PatientSignal): number {
  const sourceCount = buildSources(patient).length;
  return clamp(0.45 + sourceCount * 0.06, 0.45, 0.88);
}

function latestInteractionText(patient: PatientSignal): string {
  const latest = [...(patient.messages ?? []), ...(patient.callNotes ?? [])][0];
  return latest ? `Latest context: ${latest}` : "No recent interaction text was provided.";
}

function textFromPatient(patient: PatientSignal): string {
  return [
    ...(patient.messages ?? []),
    ...(patient.callNotes ?? []),
    ...(patient.openTasks?.map((task) => task.title) ?? []),
    ...(patient.reports?.map((report) => `${report.name} ${report.summary ?? ""}`) ?? []),
    ...(patient.payments?.map((payment) => `${payment.label ?? ""} ${payment.status ?? ""}`) ?? [])
  ].join(" ").toLowerCase();
}

function displayName(patient: PatientSignal): string {
  return patient.patientName ?? patient.patientId ?? "Unknown patient";
}

function fallbackReason(isFallback: boolean, task: string): IntelligenceResponse<unknown>["fallback"] | undefined {
  if (!isFallback) {
    return undefined;
  }

  return {
    reason: `Insufficient structured context for confident ${task}.`,
    behavior: "Returned conservative output and requested human verification."
  };
}

function compact(values: Array<string | undefined | null | false>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function containsAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function urgencyFromScore(score: number): UrgencyLevel {
  if (score >= 85) {
    return "critical";
  }

  if (score >= 65) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
