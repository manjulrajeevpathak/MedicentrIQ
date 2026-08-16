/**
 * Client-safe types + label constants for the Journeys surface. No server-only
 * imports (next/headers) so client components can import these freely. Mirrors
 * core-api's journey-template and patient-journey contracts (served under the
 * `{data}` envelope with a Bearer session).
 */

// ---- Journey templates -----------------------------------------------------

export type JourneyStep = {
  label: string;
  description?: string;
  offset?: string;
  channel?: string;
};

export type JourneyTemplateStatus = "draft" | "active" | "archived";

export type JourneyTemplate = {
  id: string;
  name: string;
  description?: string;
  steps: JourneyStep[];
  status: JourneyTemplateStatus | string;
  createdAt?: string;
};

// ---- Patient journeys ------------------------------------------------------

export type PatientJourneyStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type JourneyEvent = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  occurredAt?: string;
  createdAt?: string;
};

export type JourneyTask = {
  id: string;
  label: string;
  status?: string;
  dueAt?: string;
};

export type PatientJourney = {
  id: string;
  patientId: string;
  patientName?: string;
  templateId: string;
  templateName?: string;
  status: PatientJourneyStatus | string;
  tasks?: JourneyTask[];
  events?: JourneyEvent[];
  createdAt?: string;
  updatedAt?: string;
};

// ---- Presentation ----------------------------------------------------------

export const JOURNEY_STATUSES: { value: PatientJourneyStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

export const JOURNEY_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  JOURNEY_STATUSES.map((s) => [s.value, s.label])
);

export type JourneyBadgeTone = "neutral" | "brand" | "good" | "high" | "critical" | "violet";

export const JOURNEY_STATUS_TONE: Record<string, JourneyBadgeTone> = {
  planned: "neutral",
  active: "brand",
  paused: "high",
  completed: "good",
  cancelled: "critical"
};

export const TEMPLATE_STATUS_TONE: Record<string, JourneyBadgeTone> = {
  draft: "high",
  active: "good",
  archived: "neutral"
};

export function journeyStatusLabel(status: string): string {
  return JOURNEY_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function formatJourneyDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",  day: "numeric", month: "short", year: "numeric" });
}

export function formatJourneyDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}
