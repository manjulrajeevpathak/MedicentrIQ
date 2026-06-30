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
