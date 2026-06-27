/**
 * Client-safe types + label constants for the Campaigns surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's campaign + audience-preview contracts (served
 * under the `{data}` envelope with a Bearer session).
 */

// ---- Channel & trigger -----------------------------------------------------

export type CampaignChannel = "transactional" | "marketing";

export type CampaignTrigger = "manual" | "automated";

export type CampaignStatus = "draft" | "sending" | "sent" | "scheduled";

/** Lead lifecycle events that can drive an automated campaign. */
export type AutomatedOn = string;

// ---- Audience segment ------------------------------------------------------

export type AudienceInclude = "leads" | "patients" | "both";

export type CampaignAudience = {
  include: AudienceInclude;
  leadStages?: string[];
  leadSources?: string[];
  patientStages?: string[];
  conditionCodes?: string[];
  tags?: string[];
};

export type AudienceSample = {
  name: string;
  phone: string;
  kind: "lead" | "patient" | string;
};

export type AudiencePreview = {
  size: number;
  sample: AudienceSample[];
};

// ---- Campaign --------------------------------------------------------------

export type CampaignStats = {
  audienceSize?: number;
  sent: number;
  failed: number;
  lastRunAt?: string;
};

export type Campaign = {
  id: string;
  name: string;
  channelType: CampaignChannel;
  audience: CampaignAudience;
  body?: string;
  aisensyCampaign?: string;
  templateParams?: string[];
  trigger: CampaignTrigger;
  automatedOn?: AutomatedOn;
  status: CampaignStatus;
  stats?: CampaignStats;
  createdAt: string;
};

/** The shape POSTed to create a campaign. */
export type CampaignInput = {
  name: string;
  channelType: CampaignChannel;
  audience: CampaignAudience;
  body?: string;
  aisensyCampaign?: string;
  templateParams?: string[];
  trigger: CampaignTrigger;
  automatedOn?: AutomatedOn;
};

export type SendResult = {
  sent: number;
  failed: number;
  audienceSize: number;
};

// ---- ICD-10 condition catalog (for the condition filter) -------------------

export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category?: string;
};

// ---- Presentation ----------------------------------------------------------

export const CHANNEL_OPTIONS: { value: CampaignChannel; label: string; hint: string }[] = [
  {
    value: "transactional",
    label: "Transactional",
    hint: "Free-text WhatsApp via UltraMsg — supports a {{name}} merge field."
  },
  {
    value: "marketing",
    label: "Marketing",
    hint: "Approved AISensy campaign — supply the campaign name + optional template params."
  }
];

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  transactional: "Transactional",
  marketing: "Marketing"
};

export const CHANNEL_TONE: Record<CampaignChannel, "brand" | "violet"> = {
  transactional: "brand",
  marketing: "violet"
};

export const TRIGGER_OPTIONS: { value: CampaignTrigger; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automated", label: "Automated" }
];

export const TRIGGER_LABELS: Record<CampaignTrigger, string> = {
  manual: "Manual",
  automated: "Automated"
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  sending: "Sending",
  sent: "Sent",
  scheduled: "Scheduled"
};

export const STATUS_TONE: Record<CampaignStatus, "neutral" | "brand" | "good" | "high"> = {
  draft: "neutral",
  sending: "high",
  sent: "good",
  scheduled: "brand"
};

export const AUDIENCE_INCLUDE_OPTIONS: { value: AudienceInclude; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "patients", label: "Patients" },
  { value: "both", label: "Both" }
];

/** Lead stages available to the segment builder (matches core-api leads). */
export const AUDIENCE_LEAD_STAGES: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "booked", label: "Booked" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" }
];

/** Lead sources available to the segment builder. */
export const AUDIENCE_LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "camp", label: "Camp" },
  { value: "meta", label: "Meta" },
  { value: "referral", label: "Referral" },
  { value: "form", label: "Form" },
  { value: "import", label: "Import" },
  { value: "walk_in", label: "Walk-in" }
];

/** Patient lifecycle stages available to the segment builder. */
export const AUDIENCE_PATIENT_STAGES: { value: string; label: string }[] = [
  { value: "no_visit", label: "No visit yet" },
  { value: "scheduled", label: "Scheduled" },
  { value: "checked_in", label: "Checked in" },
  { value: "in_consult", label: "In consult" },
  { value: "opd_done", label: "OPD done" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" }
];

/** Automation triggers (lead/patient events) for automated campaigns. */
export const AUTOMATED_ON_OPTIONS: { value: string; label: string }[] = [
  { value: "lead_created", label: "When a lead is created" },
  { value: "lead_qualified", label: "When a lead is qualified" },
  { value: "lead_converted", label: "When a lead converts to a patient" },
  { value: "appointment_booked", label: "When an appointment is booked" },
  { value: "appointment_missed", label: "When an appointment is missed" },
  { value: "opd_done", label: "When an OPD visit is completed" }
];

export const AUTOMATED_ON_LABELS: Record<string, string> = Object.fromEntries(
  AUTOMATED_ON_OPTIONS.map((o) => [o.value, o.label])
);

export function automatedOnLabel(value?: string): string {
  if (!value) return "—";
  return AUTOMATED_ON_LABELS[value] ?? value.replace(/_/g, " ");
}

export function channelLabel(channel: CampaignChannel): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function statusLabel(status: CampaignStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatCampaignDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatCampaignDateTime(iso?: string): string {
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
