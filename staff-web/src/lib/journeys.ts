/* ---------------------------------------------------------------------------
   Specialty journey & protocol packs — the configurable care-continuity moat.
   ------------------------------------------------------------------------- */

export type JourneyStageTemplate = {
  label: string;
  offset: string; // when it fires relative to trigger
  sla: string;
  channel: "WhatsApp" | "Call" | "SMS";
  template: string; // patient-facing message intent
  escalates?: boolean;
};

export type JourneyPack = {
  id: string;
  specialty: string;
  name: string;
  description: string;
  status: "live" | "draft";
  activePatients: number;
  completionRate: number; // %
  leakageRecovered: number; // ₹
  avgDurationDays: number;
  languages: string[];
  stages: JourneyStageTemplate[];
  cohort: Array<{ label: string; count: number; state: "done" | "active" | "pending" | "missed" }>;
};

const packs: JourneyPack[] = [
  {
    id: "jp-cataract",
    specialty: "Ophthalmology",
    name: "Cataract post-operative",
    description: "Day-by-day post-op safety, eye-drop adherence and review booking with red-flag escalation.",
    status: "live",
    activePatients: 84,
    completionRate: 81,
    leakageRecovered: 540_000,
    avgDurationDays: 30,
    languages: ["Hindi", "English", "Kannada", "Telugu"],
    stages: [
      { label: "Day 1 check-in", offset: "+1 day", sla: "2h", channel: "WhatsApp", template: "Confirm comfort, eye-drop schedule, do/don't list" },
      { label: "Day 2 safety", offset: "+2 days", sla: "1h", channel: "Call", template: "Pain / vision symptom check", escalates: true },
      { label: "Week 1 review", offset: "+7 days", sla: "Same day", channel: "WhatsApp", template: "Book first review appointment" },
      { label: "Month 1 outcome", offset: "+30 days", sla: "Same day", channel: "WhatsApp", template: "Vision outcome + satisfaction" }
    ],
    cohort: [
      { label: "Day 1", count: 12, state: "done" },
      { label: "Day 2", count: 9, state: "active" },
      { label: "Week 1", count: 38, state: "pending" },
      { label: "Month 1", count: 25, state: "pending" }
    ]
  },
  {
    id: "jp-ivf",
    specialty: "Fertility",
    name: "IVF cycle companion",
    description: "Stimulation reminders, trigger timing, retrieval and transfer prep, and beta-hCG follow-through.",
    status: "live",
    activePatients: 46,
    completionRate: 73,
    leakageRecovered: 612_000,
    avgDurationDays: 21,
    languages: ["English", "Hindi", "Tamil"],
    stages: [
      { label: "Consult prep", offset: "Day 0", sla: "Same day", channel: "WhatsApp", template: "Collect prior reports + spouse details" },
      { label: "Stimulation reminders", offset: "Days 2-10", sla: "Daily", channel: "WhatsApp", template: "Injection time + dosage reminder" },
      { label: "Trigger timing", offset: "Day 11", sla: "Exact time", channel: "Call", template: "Trigger shot timing confirmation", escalates: true },
      { label: "Retrieval / transfer", offset: "Days 12-16", sla: "Same day", channel: "WhatsApp", template: "Pre-procedure prep + arrival time" },
      { label: "Beta hCG", offset: "+14 days", sla: "Same day", channel: "WhatsApp", template: "Test reminder + result follow-up" }
    ],
    cohort: [
      { label: "Consult", count: 8, state: "done" },
      { label: "Stimulation", count: 14, state: "active" },
      { label: "Trigger", count: 6, state: "pending" },
      { label: "Transfer", count: 11, state: "pending" },
      { label: "Beta hCG", count: 7, state: "pending" }
    ]
  },
  {
    id: "jp-onco",
    specialty: "Oncology",
    name: "Oncology continuity",
    description: "Report readiness, chemo-cycle reminders, side-effect monitoring and second-opinion follow-through.",
    status: "live",
    activePatients: 38,
    completionRate: 69,
    leakageRecovered: 880_000,
    avgDurationDays: 84,
    languages: ["English", "Hindi", "Bengali"],
    stages: [
      { label: "Document readiness", offset: "Day 0", sla: "Same day", channel: "WhatsApp", template: "Collect PET-CT, biopsy, prior records" },
      { label: "Consult", offset: "+3 days", sla: "Same day", channel: "Call", template: "Confirm consult + caregiver attendance" },
      { label: "Cycle reminders", offset: "Per protocol", sla: "Daily", channel: "WhatsApp", template: "Chemo cycle date + pre-meds" },
      { label: "Side-effect check", offset: "+2 days post cycle", sla: "1h", channel: "Call", template: "Toxicity / red-flag screen", escalates: true }
    ],
    cohort: [
      { label: "Documents", count: 10, state: "active" },
      { label: "Consult", count: 7, state: "pending" },
      { label: "Cycles", count: 15, state: "pending" },
      { label: "Side-effects", count: 6, state: "missed" }
    ]
  },
  {
    id: "jp-dialysis",
    specialty: "Nephrology",
    name: "Dialysis adherence",
    description: "Session reminders, missed-session recovery and monthly lab follow-up for recurring dialysis patients.",
    status: "live",
    activePatients: 62,
    completionRate: 88,
    leakageRecovered: 320_000,
    avgDurationDays: 90,
    languages: ["Hindi", "English", "Marathi"],
    stages: [
      { label: "Session reminder", offset: "Recurring", sla: "Day before", channel: "WhatsApp", template: "Next session date + transport check" },
      { label: "Missed-session recovery", offset: "On miss", sla: "1h", channel: "Call", template: "Rebook missed session", escalates: true },
      { label: "Monthly labs", offset: "Monthly", sla: "Same day", channel: "WhatsApp", template: "Lab collection + results" }
    ],
    cohort: [
      { label: "Scheduled", count: 34, state: "done" },
      { label: "Recovery", count: 8, state: "active" },
      { label: "Labs", count: 20, state: "pending" }
    ]
  },
  {
    id: "jp-diabetes",
    specialty: "Endocrinology",
    name: "Diabetes / CKD quarterly",
    description: "Quarterly review booking, HbA1c collection, consult and medication refill nudges.",
    status: "draft",
    activePatients: 0,
    completionRate: 0,
    leakageRecovered: 0,
    avgDurationDays: 90,
    languages: ["Hindi", "Marathi", "English"],
    stages: [
      { label: "Review booking", offset: "Quarter start", sla: "Same day", channel: "WhatsApp", template: "Book quarterly review" },
      { label: "HbA1c collection", offset: "-3 days", sla: "Same day", channel: "WhatsApp", template: "Lab upload link" },
      { label: "Consult", offset: "Day 0", sla: "Same day", channel: "Call", template: "Confirm consult attendance" },
      { label: "Refill nudge", offset: "+25 days", sla: "Same day", channel: "WhatsApp", template: "Medication refill reminder" }
    ],
    cohort: []
  }
];

export async function getJourneyPacks(): Promise<JourneyPack[]> {
  return packs;
}
