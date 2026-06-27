/* ---------------------------------------------------------------------------
   ROI engine — attribution ledger + board-ready report data.
   Every recovered rupee carries its chain of evidence (action → outcome),
   which is what makes the monthly ROI report and the pre-sales care-gaps
   audit defensible. Mock-first; a live feed can drop in behind getRoi() later.
   ------------------------------------------------------------------------- */

export type AttributionStage = "actioned" | "converted" | "observed";

export type AttributionRow = {
  id: string;
  patient: string;
  maskedPhone: string;
  category: string;
  action: string;
  actor: string;
  value: number; // ₹ realised
  stage: AttributionStage;
  evidence: string[]; // chain references
  date: string;
};

export type RoiData = {
  source: "control-tower" | "mock";
  period: string;
  tenant: string;
  branch: string;
  preparedFor: string;
  kpis: {
    recovered: number; // ₹ this period
    recoveredDelta: string;
    attributionRate: number; // % of recoveries with full evidence chain
    outstandingLeakage: number; // ₹ still recoverable
    projectedNextQuarter: number; // ₹ projected recoverable
  };
  monthlyRecovered: { labels: string[]; values: number[] };
  byCategory: Array<{ label: string; recovered: number; atRisk: number; items: number }>;
  ledger: AttributionRow[];
  methodology: string[];
};

const mockRoi: RoiData = {
  source: "mock",
  period: "May 14 – Jun 13, 2026",
  tenant: "Demo Specialty Care Network",
  branch: "Indiranagar Eye Centre",
  preparedFor: "Owner & operations leadership",
  kpis: {
    recovered: 1_842_000,
    recoveredDelta: "+18% vs prior period",
    attributionRate: 91,
    outstandingLeakage: 4_360_000,
    projectedNextQuarter: 5_900_000
  },
  monthlyRecovered: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    values: [420_000, 610_000, 880_000, 1_120_000, 1_540_000, 1_842_000]
  },
  byCategory: [
    { label: "Advised procedure not converted", recovered: 612_000, atRisk: 1_380_000, items: 14 },
    { label: "Missed follow-ups", recovered: 540_000, atRisk: 1_240_000, items: 31 },
    { label: "No-show recovery", recovered: 404_000, atRisk: 980_000, items: 17 },
    { label: "Pending diagnostics", recovered: 286_000, atRisk: 760_000, items: 22 }
  ],
  ledger: [
    {
      id: "AT-1042",
      patient: "Meena Iyer",
      maskedPhone: "+91 99XX XXX 771",
      category: "Advised procedure not converted",
      action: "IVF cycle estimate + financing options shared, cycle booked",
      actor: "Call center",
      value: 240_000,
      stage: "converted",
      evidence: ["Interaction IN-2285", "Booking AQ-114"],
      date: "Jun 11"
    },
    {
      id: "AT-1038",
      patient: "Lakshmi Reddy",
      maskedPhone: "+91 91XX XXX 556",
      category: "Advised procedure not converted",
      action: "Telugu cataract package estimate, Friday consult held",
      actor: "Front desk",
      value: 86_000,
      stage: "actioned",
      evidence: ["Interaction IN-2274"],
      date: "Jun 12"
    },
    {
      id: "AT-1031",
      patient: "Devika Nair",
      maskedPhone: "+91 98XX XXX 904",
      category: "Pending diagnostics",
      action: "PET-CT completed before oncology consult, consult attended",
      actor: "Aman Verma",
      value: 42_000,
      stage: "observed",
      evidence: ["Journey FQ-459", "Report DOC-118"],
      date: "Jun 10"
    },
    {
      id: "AT-1027",
      patient: "Rafiq Khan",
      maskedPhone: "+91 90XX XXX 118",
      category: "Missed follow-ups",
      action: "Saturday cardiology slot rebooked after Hindi estimate",
      actor: "Aman Verma",
      value: 38_000,
      stage: "converted",
      evidence: ["Interaction IN-2307", "Booking AQ-118"],
      date: "Jun 12"
    },
    {
      id: "AT-1019",
      patient: "Suresh Patil",
      maskedPhone: "+91 70XX XXX 233",
      category: "Pending diagnostics",
      action: "HbA1c collected via Marathi upload link, review held",
      actor: "Priya Nair",
      value: 12_000,
      stage: "observed",
      evidence: ["Journey FQ-466", "Report DOC-104"],
      date: "Jun 9"
    },
    {
      id: "AT-1012",
      patient: "Anita Sharma",
      maskedPhone: "+91 98XX XXX 442",
      category: "No-show recovery",
      action: "Post-op review rebooked after pain escalation",
      actor: "Nurse desk",
      value: 18_000,
      stage: "converted",
      evidence: ["Interaction IN-2317", "Journey FQ-481"],
      date: "Jun 13"
    },
    {
      id: "AT-1004",
      patient: "Vikram Joshi",
      maskedPhone: "+91 98XX XXX 230",
      category: "No-show recovery",
      action: "Missed retina review recovered via WhatsApp reminder",
      actor: "Front desk",
      value: 9_500,
      stage: "observed",
      evidence: ["Campaign cmp-301", "Booking AQ-097"],
      date: "Jun 8"
    }
  ],
  methodology: [
    "A recovery is counted only when a care-gap-flagged patient completes the booked visit, procedure, or diagnostic within the period.",
    "Every entry carries its evidence chain — interaction, booking, and outcome event — and is auditable in the platform.",
    "Values use the branch rate card at time of booking; package procedures use the quoted estimate.",
    "Every recovery is attributed to the named staff member who actioned it.",
    "Outstanding leakage is the sum of currently open, recoverable items in the worklist; projection assumes the trailing recovery rate."
  ]
};

export async function getRoi(): Promise<RoiData> {
  return mockRoi;
}
