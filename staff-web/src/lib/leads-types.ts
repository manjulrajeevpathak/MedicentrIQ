/**
 * Client-safe types + label constants for the Leads / Growth surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's lead, funnel and lead-form contracts (served under
 * the `{data}` envelope with a Bearer session; public form routes are open).
 */

// ---- Leads -----------------------------------------------------------------

export type LeadStage = "new" | "contacted" | "qualified" | "converted" | "lost";

export type LeadSource =
  | "camp"
  | "web_form"
  | "referral"
  | "walk_in"
  | "call"
  | "whatsapp"
  | "import"
  | "other";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource | string;
  sourceDetail?: string;
  stage: LeadStage | string;
  assignedTo?: string;
  branchId?: string;
  formData?: Record<string, unknown>;
  notes?: string;
  convertedPatientId?: string;
  matchedPatientId?: string;
  createdAt: string;
};

export type LeadFunnel = {
  byStage: Record<string, number>;
  bySource: Record<string, number>;
};

// ---- Tenant-configured funnel (sources + ordered stages) -------------------

/** A single configured funnel stage. The list order = funnel order. */
export type LeadFunnelStage = { key: string; label: string };

/** A single configured lead source. */
export type LeadSourceOption = { key: string; label: string };

/** Tenant lead config served by `GET /tenant/lead-config`. Stages are ORDERED. */
export type LeadConfig = {
  sources: LeadSourceOption[];
  stages: LeadFunnelStage[];
};

/**
 * Sensible defaults used when the tenant hasn't configured anything yet (or the
 * config endpoint returns empty). Mirrors the legacy hardcoded lists so the
 * board still renders before the backend lands.
 */
export const DEFAULT_LEAD_STAGES: LeadFunnelStage[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Lost" }
];

export const DEFAULT_LEAD_SOURCES: LeadSourceOption[] = [
  { key: "camp", label: "Camp" },
  { key: "web_form", label: "Web form" },
  { key: "referral", label: "Referral" },
  { key: "walk_in", label: "Walk-in" },
  { key: "call", label: "Call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "import", label: "Import" },
  { key: "other", label: "Other" }
];

/** Normalise a possibly-empty/defaulted config into usable, non-empty lists. */
export function resolveLeadConfig(config?: Partial<LeadConfig> | null): LeadConfig {
  const stages = config?.stages?.length ? config.stages : DEFAULT_LEAD_STAGES;
  const sources = config?.sources?.length ? config.sources : DEFAULT_LEAD_SOURCES;
  return { stages, sources };
}

/** Slugify a label into a stable config key (lowercase, underscores). */
export function slugifyConfigKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Build a key→label lookup from a configured list, with a fallback formatter. */
export function configLabel(
  list: { key: string; label: string }[],
  key: string
): string {
  return list.find((e) => e.key === key)?.label ?? key.replace(/_/g, " ");
}

// ---- Google Sheet → Leads sync (CRM Phase 3) -------------------------------

/** Maps CSV header names to lead fields. Phone is required to import a row. */
export type LeadSheetMapping = { name?: string; phone?: string; email?: string };

/** The outcome of the last sync run, surfaced in the connect UI. */
export type LeadSheetResult = {
  imported: number;
  skipped: number;
  total: number;
  error?: string;
  at: string;
};

/**
 * Tenant's Google Sheet connection served by `GET /tenant/lead-sheet`. The sheet
 * is a "Publish to web" CSV URL whose rows sync into Leads (tagged `sourceKey`).
 */
export type LeadSheetConfig = {
  enabled: boolean;
  csvUrl?: string;
  mapping: LeadSheetMapping;
  sourceKey?: string;
  lastSyncedAt?: string;
  lastResult?: LeadSheetResult;
};

/** A blank config so the connect form renders before anything is saved. */
export const EMPTY_LEAD_SHEET_CONFIG: LeadSheetConfig = {
  enabled: false,
  mapping: {}
};

/** Normalise a possibly-empty/partial sheet config into a usable shape. */
export function resolveLeadSheetConfig(config?: Partial<LeadSheetConfig> | null): LeadSheetConfig {
  return {
    enabled: Boolean(config?.enabled),
    csvUrl: config?.csvUrl,
    mapping: config?.mapping ?? {},
    sourceKey: config?.sourceKey,
    lastSyncedAt: config?.lastSyncedAt,
    lastResult: config?.lastResult
  };
}

// ---- Lead detail: notes, callbacks, timeline (CRM Phase 2) -----------------

export type CallbackChannel = "whatsapp" | "call" | "manual";
export type CallbackStatus = "open" | "done" | "cancelled";

/** A free-text note logged against a lead. */
export type LeadNote = {
  id: string;
  leadId: string;
  body: string;
  authorName?: string;
  createdAt: string;
};

/** A scheduled callback ("call this patient back in 7 days"). */
export type LeadCallback = {
  id: string;
  leadId: string;
  title: string;
  dueAt: string;
  channel: CallbackChannel;
  status: CallbackStatus;
  assignedTo?: string;
  note?: string;
  createdAt: string;
  completedAt?: string;
};

/** A callback enriched with its lead's name + phone for the Tasks view. */
export type EnrichedCallback = LeadCallback & {
  leadName?: string;
  leadPhone?: string;
};

export type LeadTimelineType =
  | "created"
  | "note"
  | "stage"
  | "source"
  | "callback_scheduled"
  | "callback_done"
  | "callback_cancelled"
  | "converted"
  | string;

/** A single merged timeline entry (created / note / stage change / callback…). */
export type LeadTimelineEntry = {
  id: string;
  type: LeadTimelineType;
  at: string;
  text: string;
  by?: string;
};

/** The full lead-detail bundle served by `GET /leads/:leadId`. */
export type LeadDetail = {
  lead: Lead;
  notes: LeadNote[];
  callbacks: LeadCallback[];
  timeline: LeadTimelineEntry[];
};

// ---- Callback channels (presentation) --------------------------------------

export const CALLBACK_CHANNELS: { value: CallbackChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "manual", label: "Manual" }
];

export const CALLBACK_CHANNEL_LABELS: Record<string, string> = Object.fromEntries(
  CALLBACK_CHANNELS.map((c) => [c.value, c.label])
);

export function callbackChannelLabel(channel: string): string {
  return CALLBACK_CHANNEL_LABELS[channel] ?? channel.replace(/_/g, " ");
}

export const CALLBACK_CHANNEL_TONE: Record<string, LeadBadgeTone> = {
  whatsapp: "good",
  call: "brand",
  manual: "neutral"
};

/**
 * Quick-pick "when" options for scheduling a callback. `days`/`months` are added
 * to "now" to compute the dueAt ISO. `custom` lets the user pick a date.
 */
export type CallbackWhenPreset = {
  value: string;
  label: string;
  days?: number;
  months?: number;
  custom?: boolean;
};

export const CALLBACK_WHEN_PRESETS: CallbackWhenPreset[] = [
  { value: "tomorrow", label: "Tomorrow", days: 1 },
  { value: "in_3_days", label: "In 3 days", days: 3 },
  { value: "in_7_days", label: "In 7 days", days: 7 },
  { value: "in_1_month", label: "In 1 month", months: 1 },
  { value: "in_6_months", label: "In 6 months", months: 6 },
  { value: "custom", label: "Custom date", custom: true }
];

/**
 * Compute a dueAt ISO string from a preset. For day/month offsets the callback
 * is scheduled for ~10am local on the target day; for a custom date string
 * (YYYY-MM-DD) it anchors to 10am local on that day.
 */
export function computeDueAt(preset: CallbackWhenPreset, customDate?: string): string | null {
  if (preset.custom) {
    if (!customDate) return null;
    const d = new Date(`${customDate}T10:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  const d = new Date();
  if (preset.days) d.setDate(d.getDate() + preset.days);
  if (preset.months) d.setMonth(d.getMonth() + preset.months);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** Format a due date for display ("Tomorrow", "in 3 days", or an absolute date). */
export function formatDueDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/** Whether a due date is in the past (used to highlight overdue callbacks). */
export function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** A short relative-time label like "2 days overdue" / "due in 5 days". */
export function relativeDue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const overdue = diffMs < 0;
  const absDays = Math.round(Math.abs(diffMs) / 86_400_000);
  if (absDays === 0) {
    return overdue ? "due earlier today" : "due today";
  }
  const unit = absDays === 1 ? "day" : "days";
  return overdue ? `${absDays} ${unit} overdue` : `due in ${absDays} ${unit}`;
}

// ---- Lead forms ------------------------------------------------------------

export type LeadFieldType = "text" | "phone" | "email" | "number" | "select" | "multiselect" | "textarea";

export type LeadFormField = {
  key: string;
  label: string;
  type: LeadFieldType;
  required?: boolean;
  options?: string[];
};

export type LeadFormStatus = "active" | "inactive" | "draft";

export type LeadForm = {
  id: string;
  title: string;
  description?: string;
  slug: string;
  fields: LeadFormField[];
  status: LeadFormStatus | string;
  submissions: number;
  createdAt: string;
};

/** The public-facing shape returned by `GET /public/forms/:slug` (no bearer). */
export type PublicLeadForm = {
  title: string;
  description?: string;
  fields: LeadFormField[];
};

// ---- Presentation ----------------------------------------------------------

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" }
];

export const LEAD_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_STAGES.map((s) => [s.value, s.label])
);

/** Ordered funnel stages (new → … → converted), with `lost` shown separately. */
export const FUNNEL_STAGE_ORDER: LeadStage[] = ["new", "contacted", "qualified", "converted"];

export type LeadBadgeTone = "neutral" | "brand" | "good" | "high" | "critical" | "violet";

export const LEAD_STAGE_TONE: Record<string, LeadBadgeTone> = {
  new: "brand",
  contacted: "brand",
  qualified: "violet",
  converted: "good",
  lost: "critical"
};

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "camp", label: "Camp" },
  { value: "web_form", label: "Web form" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "import", label: "Import" },
  { value: "other", label: "Other" }
];

export const LEAD_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_SOURCES.map((s) => [s.value, s.label])
);

export function leadSourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export function leadStageLabel(stage: string): string {
  return LEAD_STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

export const LEAD_FIELD_TYPES: { value: LeadFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Checkboxes (multi-select)" },
  { value: "textarea", label: "Long text" }
];

/** Field types that carry a list of choices (need the options input). */
export const OPTION_FIELD_TYPES: LeadFieldType[] = ["select", "multiselect"];

export const FORM_STATUS_TONE: Record<string, "neutral" | "good" | "high"> = {
  active: "good",
  inactive: "neutral",
  draft: "high"
};

export function formatLeadDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
