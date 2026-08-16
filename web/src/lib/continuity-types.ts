/**
 * Client-safe types + label constants for the Continuity / follow-up surface.
 * No server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's follow-up contract (served under the `{data}`
 * envelope with a Bearer session).
 */

export type FollowUpStatus = "due" | "confirmed" | "completed" | "missed" | "escalated";

export type FollowUp = {
  id: string;
  patientId: string;
  patientName?: string;
  title: string;
  dueAt: string;
  status: FollowUpStatus | string;
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
};

// ---- Presentation ----------------------------------------------------------

export const FOLLOWUP_STATUSES: { value: FollowUpStatus; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "escalated", label: "Escalated" }
];

export const FOLLOWUP_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  FOLLOWUP_STATUSES.map((s) => [s.value, s.label])
);

export type FollowUpBadgeTone = "neutral" | "brand" | "good" | "high" | "critical" | "violet";

export const FOLLOWUP_STATUS_TONE: Record<string, FollowUpBadgeTone> = {
  due: "brand",
  confirmed: "violet",
  completed: "good",
  missed: "high",
  escalated: "critical"
};

export function followUpStatusLabel(status: string): string {
  return FOLLOWUP_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function formatFollowUpDue(iso?: string): string {
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

/** True when the follow-up's due time has already passed (for overdue styling). */
export function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** Convert an ISO datetime to the `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
export function toDatetimeLocal(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
