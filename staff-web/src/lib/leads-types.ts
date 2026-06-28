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
