/**
 * Client-safe types for the Appointments / scheduling surface. No server-only
 * imports (next/headers) so client components can import these freely.
 * Mirrors core-api's scheduling contract.
 */

/** 0 = Sunday … 6 = Saturday. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleWindow = {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  branchId?: string;
};

export type WeeklyHours = Record<string, ScheduleWindow[]>;

export type DoctorStatus = "active" | "inactive";

export type Doctor = {
  id: string;
  displayName: string;
  specialty?: string;
  branchIds: string[];
  slotMinutes: number;
  phone?: string;
  weeklyHours: WeeklyHours;
  status: DoctorStatus;
};

export type Slot = {
  start: string; // ISO
  end: string; // ISO
};

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_consult"
  | "cancelled"
  | "completed"
  | "no_show"
  | "rescheduled";

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  branchId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  status: AppointmentStatus;
  reason?: string;
  doctorName?: string;
};

export type PatientOption = {
  id: string;
  displayName: string;
};

export type BranchOption = {
  id: string;
  displayName: string;
  city?: string;
};

export const WEEKDAYS: { index: WeekdayIndex; label: string; short: string }[] = [
  { index: 0, label: "Sunday", short: "Sun" },
  { index: 1, label: "Monday", short: "Mon" },
  { index: 2, label: "Tuesday", short: "Tue" },
  { index: 3, label: "Wednesday", short: "Wed" },
  { index: 4, label: "Thursday", short: "Thu" },
  { index: 5, label: "Friday", short: "Fri" },
  { index: 6, label: "Saturday", short: "Sat" }
];

export const SLOT_MINUTE_OPTIONS = [15, 20, 30] as const;

/** Statuses a staff member can transition an appointment to from the day list. */
export const APPOINTMENT_ACTIONS: { status: Extract<AppointmentStatus, "confirmed" | "completed" | "no_show" | "cancelled">; label: string }[] = [
  { status: "confirmed", label: "Confirm" },
  { status: "completed", label: "Complete" },
  { status: "no_show", label: "No-show" },
  { status: "cancelled", label: "Cancel" }
];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_consult: "In consult",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
  rescheduled: "Rescheduled"
};

/** Today's date as YYYY-MM-DD in the browser/server local timezone. */
export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
