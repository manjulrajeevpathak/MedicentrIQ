/**
 * Client-safe types + label constants for the Campaigns surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's campaign + audience-preview contracts (served
 * under the `{data}` envelope with a Bearer session).
 */

// ---- Channel & trigger -----------------------------------------------------

export type CampaignChannel = "transactional" | "marketing";

/** Delivery provider — decoupled from the marketing/transactional category, so a
 *  marketing broadcast can go via UltraMsg (free text) or AISensy (template). */
export type CampaignProvider = "ultramsg" | "aisensy";

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
  provider?: CampaignProvider;
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
  provider: CampaignProvider;
  audience: CampaignAudience;
  body?: string;
  aisensyCampaign?: string;
  templateParams?: string[];
  trigger: CampaignTrigger;
  automatedOn?: AutomatedOn;
};

/** Resolve a campaign's effective delivery provider (explicit, else from category). */
export function campaignProvider(c: { provider?: CampaignProvider; channelType: CampaignChannel }): CampaignProvider {
  return c.provider ?? (c.channelType === "marketing" ? "aisensy" : "ultramsg");
}

export const PROVIDER_OPTIONS: { value: CampaignProvider; label: string; hint: string }[] = [
  {
    value: "ultramsg",
    label: "UltraMsg (free text)",
    hint: "Sends a free-text WhatsApp message — supports a {{name}} merge field."
  },
  {
    value: "aisensy",
    label: "AISensy (approved template)",
    hint: "Sends an approved WhatsApp template — required for first contact with a number."
  }
];

export const PROVIDER_LABELS: Record<CampaignProvider, string> = {
  ultramsg: "UltraMsg",
  aisensy: "AISensy"
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
    hint: "Service/utility message (confirmations, reminders) to people already in contact."
  },
  {
    value: "marketing",
    label: "Marketing",
    hint: "Promotional broadcast (offers, camps, re-engagement) to a lead/patient segment."
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

// Lead stages + sources for the segment builder are now read from the tenant's
// configured funnel (GET /tenant/lead-config), threaded in via the Campaigns
// page → CampaignsWorkspace → AudienceBuilder. The old hardcoded lists were
// removed; see src/lib/leads-types.ts for the funnel config types.

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
