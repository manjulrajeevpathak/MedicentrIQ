/* ---------------------------------------------------------------------------
   Conversational copilot seed + recommendation outcome (feedback) loop.
   The dock matches user input to a canned answer by keyword overlap; a live
   DatacentrIQ Copilot call can replace `answerFor` later.
   ------------------------------------------------------------------------- */

export type CopilotAnswer = {
  keywords: string[];
  title: string;
  body: string;
  bullets?: string[];
  citations?: string[];
  suggestedAction?: string;
};

export const copilotSuggestions: string[] = [
  "Who is likely to drop off this week?",
  "Summarize Anita Sharma",
  "Which patients are slipping out of care?",
  "Draft a Hindi no-show reminder",
  "Which doctors have the highest no-show rate?",
  "What needs approval right now?"
];

const answers: CopilotAnswer[] = [
  {
    keywords: ["drop", "off", "risk", "leak", "churn", "week"],
    title: "7 patients at high drop-off risk this week",
    body: "Across active care journeys, these patients are most likely to drop off and have no contact scheduled:",
    bullets: [
      "Anita Sharma — cataract day-2 safety overdue (88%)",
      "Devika Nair — PET-CT pending before oncology consult (67%)",
      "Suresh Patil — HbA1c report missing for review (54%)",
      "Rafiq Khan — missed cardiology review after abnormal ECG"
    ],
    citations: ["Continuity journeys", "DatacentrIQ continuity model"],
    suggestedAction: "Queue Hindi/Marathi reminders and a nurse call for the top two."
  },
  {
    keywords: ["summarize", "summary", "anita", "patient", "360"],
    title: "Anita Sharma — patient summary",
    body: "62y female, cataract post-op day 2 under Dr. Kavita Menon. Caregiver-first household (son Rohit, consent granted).",
    bullets: [
      "WhatsApp pain + blurred vision message 10 min ago — risk language detected",
      "Day-2 safety check overdue by 42 min",
      "Payment receipt pending upload"
    ],
    citations: ["Patient 360 P-77421", "Interaction IN-2317"],
    suggestedAction: "Escalate to nurse, call caregiver, rebook urgent review."
  },
  {
    keywords: ["revenue", "leak", "leaking", "money", "recover", "₹", "rupee", "care", "continuity"],
    title: "₹18.4L of care continued, ₹43.6L still at risk (30d)",
    body: "Where patients are falling out of care right now:",
    bullets: [
      "Advised procedure not yet scheduled — ₹13.8L (14 patients)",
      "Missed follow-ups — ₹12.4L (31 patients)",
      "No-shows to reach again — ₹9.8L (17 patients)",
      "Pending diagnostics — ₹7.6L (22 patients)"
    ],
    citations: ["Command Center", "Control Tower continuity model"],
    suggestedAction: "Open Care recovery worklist — the IVF estimate (₹2.4L) is the top single item."
  },
  {
    keywords: ["draft", "message", "reminder", "hindi", "whatsapp", "write", "no-show", "noshow"],
    title: "Draft — Hindi no-show reminder",
    body: "Suggested approved-template message (appointment_reminder, Hindi):",
    bullets: [
      "नमस्ते {{name}}, {{doctor}} के साथ आपका अपॉइंटमेंट {{date}} को {{time}} बजे है। पुष्टि के लिए 1 भेजें, बदलने के लिए 2।"
    ],
    citations: ["Template appointment_reminder"],
    suggestedAction: "Send via Campaigns to the 142 patients without a booked review."
  },
  {
    keywords: ["doctor", "no-show", "noshow", "utilization", "performance", "highest"],
    title: "No-show rate by doctor",
    body: "Highest no-show rates this period:",
    bullets: [
      "Dr. S. Prakash (IVF) — 22%",
      "Dr. Arvind Rao (Cardiology) — 18%",
      "Dr. N. Joshi (Endocrinology) — 15%",
      "Dr. Kavita Menon (Ophthalmology) — 12%"
    ],
    citations: ["Command Center · doctor performance"],
    suggestedAction: "Enable same-day reminder + confirmation link for IVF and cardiology slots."
  },
  {
    keywords: ["approval", "approve", "pending", "sign", "now"],
    title: "1 recommendation needs your approval",
    body: "Awaiting sign-off:",
    bullets: ["Prioritize clinical escalation — Anita Sharma (92% confidence, clinical-risk)"],
    citations: ["AI Workbench AI-811"],
    suggestedAction: "Approve to move to nurse queue and draft the urgent review message."
  }
];

export function answerFor(query: string): CopilotAnswer {
  const q = query.toLowerCase();
  let best: CopilotAnswer | null = null;
  let bestScore = 0;
  for (const answer of answers) {
    const score = answer.keywords.reduce((sum, kw) => (q.includes(kw) ? sum + 1 : sum), 0);
    if (score > bestScore) {
      bestScore = score;
      best = answer;
    }
  }
  if (best && bestScore > 0) return best;
  return {
    keywords: [],
    title: "Here's what I can see",
    body: `I can pull from the inbox, Patient 360, journeys, continuity model and Command Center. Try asking about drop-off risk, patients at risk of falling out of care, a specific patient, or to draft a message.`,
    citations: ["DatacentrIQ Copilot"],
    suggestedAction: undefined
  };
}

/* ----------------------------- Feedback loop ----------------------------- */
export type OutcomeStage = "generated" | "shown" | "accepted" | "rejected" | "converted" | "observed";

export type RecommendationOutcome = {
  id: string;
  title: string;
  patient: string;
  stage: OutcomeStage;
  by?: string;
  value?: number; // ₹ outcome where realised
  note: string;
  at: string;
};

export const outcomeStages: OutcomeStage[] = ["generated", "shown", "accepted", "converted", "observed"];

export const dismissReasons = [
  "Not clinically relevant",
  "Already actioned",
  "Patient opted out",
  "Wrong patient match",
  "Low confidence / needs review",
  "Duplicate"
];

export const recommendationOutcomes: RecommendationOutcome[] = [
  { id: "AI-804", title: "Re-engaged missed cardiology follow-up", patient: "Rafiq Khan", stage: "converted", by: "Aman Verma", value: 38_000, note: "Saturday slot booked after Hindi estimate", at: "Today 09:40" },
  { id: "AI-796", title: "Prevent chronic care drop-off", patient: "Suresh Patil", stage: "accepted", by: "Priya Nair", note: "HbA1c link sent, callback scheduled 6 PM", at: "Today 08:15" },
  { id: "AI-790", title: "Helped schedule advised cataract surgery", patient: "Lakshmi Reddy", stage: "shown", note: "Awaiting front-desk action", at: "Today 10:02" },
  { id: "AI-781", title: "Rebooked paused IVF consult", patient: "Meena Iyer", stage: "converted", by: "Call center", value: 240_000, note: "Cycle booked with financing", at: "Yesterday" },
  { id: "AI-774", title: "Diagnostics gap — abnormal report", patient: "Devika Nair", stage: "observed", by: "Aman Verma", value: 42_000, note: "PET-CT completed, consult attended", at: "2 days ago" }
];

export async function getFeedbackOutcomes(): Promise<RecommendationOutcome[]> {
  return recommendationOutcomes;
}
