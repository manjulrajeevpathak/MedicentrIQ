/* ---------------------------------------------------------------------------
   Command Center + Revenue Recovery analytics.
   Mock-first (no core-api endpoint yet); structured so a live Control Tower
   feed can drop in behind getAnalytics() later.
   ------------------------------------------------------------------------- */

import type { QueuePriority } from "./types";

export type FunnelStage = { label: string; value: number };

export type LeakageCategory = {
  id: string;
  label: string;
  atRisk: number; // ₹ at risk this period
  recovered: number; // ₹ recovered this period
  count: number; // open recoverable items
  trend: number[];
};

export type PerformanceRow = {
  name: string;
  detail: string;
  bookings: number;
  conversion: number; // %
  noShow: number; // %
  revenue: number; // ₹
};

export type ChannelPerf = { channel: string; leads: number; converted: number };

export type BranchRollup = {
  branch: string;
  leadConversion: number;
  followUpCompletion: number;
  noShow: number;
  revenueRecovered: number;
  trend: number[];
};

export type LeakageWorkItem = {
  id: string;
  patient: string;
  category: string;
  value: number; // ₹
  ageDays: number;
  owner: string;
  action: string;
  risk: QueuePriority;
};

export type AnalyticsData = {
  source: "control-tower" | "mock";
  period: string;
  kpis: {
    revenueRecovered: number;
    revenueAtRisk: number;
    leadConversion: number;
    followUpCompletion: number;
    noShowRate: number;
    avgFirstResponseMins: number;
    aiAcceptance: number;
  };
  funnel: FunnelStage[];
  leakageWaterfall: Array<{ label: string; value: number; kind: "total" | "loss" | "gain" }>;
  leakageCategories: LeakageCategory[];
  retention: { labels: string[]; values: number[] };
  retentionCohorts: { rows: string[]; cols: string[]; values: number[][] };
  doctors: PerformanceRow[];
  channels: ChannelPerf[];
  branches: BranchRollup[];
  slaHeatmap: { rows: string[]; cols: string[]; values: number[][] };
  trends: { bookings: number[]; recovered: number[]; noShow: number[] };
  worklist: LeakageWorkItem[];
};

const mockAnalytics: AnalyticsData = {
  source: "mock",
  period: "Last 30 days · Indiranagar",
  kpis: {
    revenueRecovered: 1_842_000,
    revenueAtRisk: 4_360_000,
    leadConversion: 47,
    followUpCompletion: 68,
    noShowRate: 19,
    avgFirstResponseMins: 9,
    aiAcceptance: 82
  },
  funnel: [
    { label: "Requests captured", value: 3120 },
    { label: "Identified / matched", value: 2870 },
    { label: "Contacted", value: 2410 },
    { label: "Booked", value: 1490 },
    { label: "Arrived", value: 1180 },
    { label: "Followed up", value: 690 },
    { label: "Converted / retained", value: 472 }
  ],
  leakageWaterfall: [
    { label: "Recoverable", value: 4_360_000, kind: "total" },
    { label: "No-shows", value: -980_000, kind: "loss" },
    { label: "Missed follow-up", value: -1_240_000, kind: "loss" },
    { label: "Pending diagnostics", value: -760_000, kind: "loss" },
    { label: "Unconverted procedure", value: -1_380_000, kind: "loss" },
    { label: "Recovered", value: 1_842_000, kind: "gain" }
  ],
  leakageCategories: [
    { id: "lk-followup", label: "Missed follow-ups", atRisk: 1_240_000, recovered: 540_000, count: 31, trend: [40, 44, 48, 52, 49, 55, 58, 61] },
    { id: "lk-diag", label: "Pending diagnostics", atRisk: 760_000, recovered: 286_000, count: 22, trend: [30, 28, 33, 35, 38, 41, 39, 44] },
    { id: "lk-procedure", label: "Advised procedure not converted", atRisk: 1_380_000, recovered: 612_000, count: 14, trend: [50, 54, 52, 58, 60, 63, 66, 70] },
    { id: "lk-noshow", label: "No-show recovery", atRisk: 980_000, recovered: 404_000, count: 17, trend: [35, 32, 38, 42, 40, 45, 47, 49] }
  ],
  retention: {
    labels: ["W1", "W2", "W3", "W4", "W6", "W8", "W12"],
    values: [100, 86, 74, 66, 58, 51, 44]
  },
  retentionCohorts: {
    rows: ["Mar", "Apr", "May", "Jun"],
    cols: ["W1", "W2", "W4", "W8", "W12"],
    values: [
      [100, 82, 64, 48, 41],
      [100, 85, 69, 53, 46],
      [100, 88, 72, 57, 0],
      [100, 90, 0, 0, 0]
    ]
  },
  doctors: [
    { name: "Dr. Kavita Menon", detail: "Ophthalmology", bookings: 312, conversion: 58, noShow: 12, revenue: 2_140_000 },
    { name: "Dr. Arvind Rao", detail: "Cardiology", bookings: 268, conversion: 49, noShow: 18, revenue: 1_760_000 },
    { name: "Dr. S. Prakash", detail: "Fertility / IVF", bookings: 196, conversion: 41, noShow: 22, revenue: 3_420_000 },
    { name: "Dr. N. Joshi", detail: "Endocrinology", bookings: 174, conversion: 52, noShow: 15, revenue: 980_000 },
    { name: "Dr. R. Bose", detail: "Oncology", bookings: 142, conversion: 44, noShow: 9, revenue: 2_880_000 }
  ],
  channels: [
    { channel: "WhatsApp", leads: 1480, converted: 742 },
    { channel: "Call", leads: 820, converted: 318 },
    { channel: "Web", leads: 410, converted: 196 },
    { channel: "Referral", leads: 264, converted: 158 },
    { channel: "Walk-in", leads: 146, converted: 88 }
  ],
  branches: [
    { branch: "Indiranagar", leadConversion: 47, followUpCompletion: 68, noShow: 19, revenueRecovered: 1_842_000, trend: [40, 44, 48, 52, 58, 60, 66, 72] },
    { branch: "Lucknow", leadConversion: 42, followUpCompletion: 61, noShow: 24, revenueRecovered: 1_180_000, trend: [38, 40, 39, 44, 48, 50, 52, 55] },
    { branch: "Hyderabad", leadConversion: 51, followUpCompletion: 72, noShow: 16, revenueRecovered: 1_460_000, trend: [42, 46, 50, 54, 56, 60, 63, 68] },
    { branch: "Mumbai - Thane", leadConversion: 39, followUpCompletion: 57, noShow: 27, revenueRecovered: 860_000, trend: [30, 34, 33, 38, 40, 42, 44, 47] }
  ],
  slaHeatmap: {
    rows: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    cols: ["9a", "11a", "1p", "3p", "5p", "7p"],
    values: [
      [62, 78, 70, 55, 48, 40],
      [70, 82, 74, 60, 52, 44],
      [66, 80, 72, 58, 50, 42],
      [72, 88, 80, 64, 56, 46],
      [68, 84, 76, 62, 54, 45],
      [80, 92, 60, 50, 38, 30]
    ]
  },
  trends: {
    bookings: [52, 49, 58, 62, 70, 74, 80, 86, 84, 90, 88, 94],
    recovered: [20, 28, 30, 42, 48, 55, 60, 72, 78, 84, 90, 98],
    noShow: [30, 28, 34, 40, 38, 44, 42, 39, 37, 35, 33, 31]
  },
  worklist: [
    { id: "RL-2201", patient: "Lakshmi Reddy", category: "Advised procedure not converted", value: 86_000, ageDays: 4, owner: "Front desk", action: "Share Telugu cataract package estimate + hold Friday consult", risk: "high" },
    { id: "RL-2188", patient: "Devika Nair", category: "Pending diagnostics", value: 42_000, ageDays: 2, owner: "Aman", action: "Collect PET-CT before oncology consult", risk: "high" },
    { id: "RL-2176", patient: "Rafiq Khan", category: "Missed follow-up", value: 38_000, ageDays: 6, owner: "Front desk", action: "Offer Saturday cardiology slot + Hindi estimate", risk: "critical" },
    { id: "RL-2160", patient: "Suresh Patil", category: "Pending diagnostics", value: 12_000, ageDays: 3, owner: "Care coordinator", action: "Send HbA1c upload link in Marathi", risk: "medium" },
    { id: "RL-2154", patient: "Meena Iyer", category: "Advised procedure not converted", value: 240_000, ageDays: 5, owner: "Call center", action: "Share IVF cycle estimate + financing options", risk: "high" },
    { id: "RL-2142", patient: "Anita Sharma", category: "No-show recovery", value: 18_000, ageDays: 1, owner: "Nurse desk", action: "Rebook post-op review after pain escalation", risk: "critical" }
  ]
};

export async function getAnalytics(): Promise<AnalyticsData> {
  return mockAnalytics;
}
