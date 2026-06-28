"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarDays,
  Loader2,
  Phone,
  RotateCcw,
  Send,
  Stethoscope,
  UserRound,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_ACTIONS,
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
  type BranchOption,
  type Doctor,
  type PatientOption,
  type Slot
} from "@/lib/scheduling-types";
import {
  bookAppointmentAction,
  loadAppointmentsAction,
  loadSlotsAction,
  lookupPatientByPhoneAction,
  sendConfirmationsAction,
  setAppointmentStatusAction,
  type IntakeLookup
} from "@/app/(app)/appointments/actions";

type Props = {
  doctors: Doctor[];
  patients: PatientOption[];
  branches: BranchOption[];
  today: string;
  initialDoctorId: string;
  initialAppointments: Appointment[];
};

const statusTone: Record<AppointmentStatus, "good" | "neutral" | "high" | "brand" | "critical"> = {
  scheduled: "brand",
  confirmed: "good",
  checked_in: "brand",
  in_consult: "brand",
  rescheduled: "brand",
  completed: "good",
  cancelled: "critical",
  no_show: "high"
};

// Slot/appointment times are the doctor's wall-clock hours encoded as UTC
// (e.g. a 09:00 window → ...T09:00:00Z). Read them back in UTC so they display
// as entered (09:00), not shifted into the viewer's timezone (which turned
// 09:00 into 14:30 in IST and pushed evening slots past midnight).
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Bucket a wall-clock slot into Morning / Afternoon / Evening for a readable picker. */
function slotPeriod(iso: string): "Morning" | "Afternoon" | "Evening" {
  const h = new Date(iso).getUTCHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}
const SLOT_PERIODS = ["Morning", "Afternoon", "Evening"] as const;

export function AccessWorkspace({
  doctors,
  patients,
  branches,
  today,
  initialDoctorId,
  initialAppointments
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Appointments</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Book patients into available slots and manage today&apos;s schedule.
        </p>
      </div>

      <BookingTab
        doctors={doctors}
        patients={patients}
        branches={branches}
        today={today}
        initialDoctorId={initialDoctorId}
        initialAppointments={initialAppointments}
      />
    </div>
  );
}

// ---- Booking ---------------------------------------------------------------

function BookingTab({
  doctors,
  patients,
  branches,
  today,
  initialDoctorId,
  initialAppointments
}: {
  doctors: Doctor[];
  patients: PatientOption[];
  branches: BranchOption[];
  today: string;
  initialDoctorId: string;
  initialAppointments: Appointment[];
}) {
  const { toast } = useToast();
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  // Phone-first patient capture: look up by phone → existing patient (prefill) or new.
  const [patientId, setPatientId] = useState("");
  const [phone, setPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [lookup, setLookup] = useState<IntakeLookup | null>(null);
  const [lookingUp, startLookup] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, startLoadSlots] = useTransition();
  const [booking, startBooking] = useTransition();
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [, startStatus] = useTransition();
  const [sending, startSending] = useTransition();

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [branches]);

  const doctorName = useMemo(() => {
    const map = new Map(doctors.map((d) => [d.id, d.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [doctors]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  // Merge open slots with this doctor+date's booked appointments so taken times
  // are shown as blocked (not silently dropped). scheduledAt uses the same
  // UTC-encoded wall-clock as slot.start, so they line up exactly.
  const allSlots = useMemo(() => {
    if (slots === null) return null;
    const map = new Map<string, { start: string; taken: boolean }>();
    for (const s of slots) map.set(s.start, { start: s.start, taken: false });
    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      map.set(a.scheduledAt, { start: a.scheduledAt, taken: true });
    }
    return [...map.values()].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
  }, [slots, appointments]);

  function refresh(nextDoctorId: string, nextDate: string) {
    setError(null);
    setSelectedSlot("");
    if (!nextDoctorId) {
      setSlots([]);
      setAppointments([]);
      return;
    }
    startLoadSlots(async () => {
      const [slotsResult, apptResult] = await Promise.all([
        loadSlotsAction(nextDoctorId, nextDate),
        loadAppointmentsAction(nextDoctorId, nextDate)
      ]);
      if (slotsResult.ok) setSlots(slotsResult.data ?? []);
      else {
        setSlots([]);
        toast(slotsResult.error ?? "Could not load slots.", "error");
      }
      if (apptResult.ok) setAppointments(apptResult.data ?? []);
    });
  }

  function onDoctorChange(id: string) {
    setDoctorId(id);
    refresh(id, date);
  }
  function onDateChange(d: string) {
    setDate(d);
    refresh(doctorId, d);
  }

  function resetPatient() {
    setPhone("");
    setNewName("");
    setPatientId("");
    setLookup(null);
  }

  // Auto-search: once a full phone number is typed, look the patient up
  // (debounced) — no manual button, so ops just types and sees the match.
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    const handle = setTimeout(() => {
      startLookup(async () => {
        const result = await lookupPatientByPhoneAction(phone.trim());
        if (!result.ok || !result.data) {
          setLookup(null);
          return;
        }
        const data = result.data;
        setLookup(data);
        if (data.match === "patient" && data.patient) {
          // existing patient → booking uses patientId; name field stays hidden
          setPatientId(data.patient.id);
        } else if (data.match === "lead" && data.lead) {
          setPatientId("");
          setNewName(data.lead.name);
        } else {
          // no match → keep any name already typed for the new patient
          setPatientId("");
        }
      });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  function book() {
    setError(null);
    if (!selectedSlot) {
      setError("Choose an available slot.");
      return;
    }
    if (!patientId && !newName.trim()) {
      setError("Look up a patient by phone, or enter a name.");
      return;
    }
    const branchId = selectedDoctor?.branchIds[0] ?? branches[0]?.id ?? "";
    startBooking(async () => {
      const result = await bookAppointmentAction({
        patientId: patientId || undefined,
        patient: patientId ? undefined : { name: newName.trim(), phone: phone.trim() || undefined },
        doctorId,
        branchId,
        scheduledAt: selectedSlot,
        reason: reason.trim() || undefined
      });
      if (!result.ok) {
        setError(result.error ?? "Could not book the appointment.");
        return;
      }
      toast(result.message ?? "Appointment booked.", "success");
      setReason("");
      setSelectedSlot("");
      resetPatient();
      refresh(doctorId, date);
    });
  }

  function changeStatus(appointment: Appointment, status: AppointmentStatus) {
    setBusyAppointmentId(appointment.id);
    startStatus(async () => {
      const result = await setAppointmentStatusAction(appointment.id, status);
      setBusyAppointmentId(null);
      if (!result.ok) {
        toast(result.error ?? "Could not update the appointment.", "error");
        return;
      }
      toast(result.message ?? "Appointment updated.", "success");
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointment.id ? { ...a, status } : a))
      );
    });
  }

  function sendConfirmations() {
    startSending(async () => {
      const result = await sendConfirmationsAction();
      if (!result.ok) {
        toast(result.error ?? "Could not send confirmations.", "error");
        return;
      }
      toast(result.message ?? "Confirmations sent.", "success");
    });
  }

  const patientName = useMemo(() => {
    const map = new Map(patients.map((p) => [p.id, p.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [patients]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Book */}
      <Panel>
        <SectionTitle
          icon={<CalendarClock className="size-4" />}
          title="Book an appointment"
          subtitle="Pick a doctor and date, then an available slot"
        />

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Doctor" htmlFor="bk-doctor">
            <select
              id="bk-doctor"
              value={doctorId}
              onChange={(e) => onDoctorChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <option value="">Select a doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id} disabled={d.status !== "active"}>
                  {d.displayName}
                  {d.specialty ? ` · ${d.specialty}` : ""}
                  {d.status !== "active" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" htmlFor="bk-date">
            <Input id="bk-date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </Field>
        </div>

        {/* Slots */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">Available slots</p>
          {loadingSlots ? (
            <p className="py-6 text-center text-xs text-ink-muted">Loading slots…</p>
          ) : !doctorId ? (
            <EmptyState
              icon={<Stethoscope className="size-5" />}
              title="Pick a doctor"
              description="Choose a doctor to see their open slots for the day."
            />
          ) : slots === null ? (
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="Select a date"
              description="Choose a doctor and date to load slots."
            />
          ) : !allSlots || allSlots.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="No slots"
              description="No open slots — set this doctor's schedule on the Doctors screen."
            />
          ) : (
            <div className="space-y-4">
              {SLOT_PERIODS.map((period) => {
                const inPeriod = allSlots.filter((s) => slotPeriod(s.start) === period);
                if (inPeriod.length === 0) return null;
                const openCount = inPeriod.filter((s) => !s.taken).length;
                const bookedCount = inPeriod.length - openCount;
                return (
                  <div key={period}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                      {period} · {openCount} open{bookedCount > 0 ? ` · ${bookedCount} booked` : ""}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {inPeriod.map((slot) =>
                        slot.taken ? (
                          <div
                            key={slot.start}
                            title="Booked"
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-fill px-2 py-2 text-center text-xs font-medium text-ink-faint line-through"
                          >
                            {formatTime(slot.start)}
                          </div>
                        ) : (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => setSelectedSlot(slot.start)}
                            className={cn(
                              "rounded-lg border px-2 py-2 text-center text-xs font-medium transition",
                              slot.start === selectedSlot
                                ? "border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-100"
                                : "border-line-strong bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-muted"
                            )}
                          >
                            {formatTime(slot.start)}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Phone-first patient capture + reason */}
        <div className="mt-4 space-y-3.5">
          <Field label="Patient phone" htmlFor="bk-phone" hint="Searches automatically once the full number is entered.">
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                id="bk-phone"
                type="tel"
                placeholder="+91…"
                value={phone}
                className="pl-9 pr-24"
                onChange={(e) => {
                  setPhone(e.target.value);
                  setLookup(null);
                  setPatientId("");
                }}
                autoComplete="off"
              />
              {lookingUp ? (
                <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-ink-faint">
                  <Loader2 className="size-3 animate-spin" /> Searching…
                </span>
              ) : null}
            </div>
          </Field>

          {lookup ? (
            lookup.match === "patient" && lookup.patient ? (
              <p className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700">
                <UserRound className="size-3.5" /> Existing patient: {lookup.patient.displayName}
                {lookup.patient.age ? ` · ${lookup.patient.age}y` : ""}
                {lookup.patient.gender ? ` · ${lookup.patient.gender}` : ""}
              </p>
            ) : lookup.match === "lead" && lookup.lead ? (
              <p className="rounded-lg border border-[var(--color-high)]/30 bg-[var(--color-high-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-high)]">
                Matched lead: {lookup.lead.name} — a patient will be created on booking.
              </p>
            ) : (
              <p className="rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-xs text-ink-muted">
                No match — booking will register a new patient.
              </p>
            )
          ) : null}

          {/* Existing match → name is locked; otherwise capture the new patient's name. */}
          {patientId ? null : (
            <Field label="Patient name" htmlFor="bk-name">
              <Input
                id="bk-name"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}

          <Field label="Reason / chief complaint (optional)" htmlFor="bk-reason">
            <Input
              id="bk-reason"
              placeholder="e.g. Blurred vision, follow-up consult"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--color-critical)]/30 bg-[var(--color-critical-soft)] px-3 py-2 text-xs font-medium text-[var(--color-critical)]"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={book} disabled={booking || !selectedSlot || (!patientId && !newName.trim())}>
              {booking ? "Booking…" : "Book appointment"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Today's appointments */}
      <Panel padded={false} className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
          <SectionTitle
            icon={<CalendarDays className="size-4" />}
            title="Appointments"
            subtitle={doctorId ? `${doctorName(doctorId)} · ${date}` : "Select a doctor"}
          />
          <Button variant="outline" size="sm" onClick={sendConfirmations} disabled={sending}>
            <Send className="size-3.5" /> {sending ? "Sending…" : "Send doctor confirmations"}
          </Button>
        </div>

        {appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No appointments"
            description="Booked appointments for this doctor and date will appear here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {appointments
              .slice()
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
              .map((appointment) => {
                const busy = busyAppointmentId === appointment.id;
                // Cancelled / no-show can be re-opened back to Scheduled. Completed is final.
                const reopenable = ["cancelled", "no_show"].includes(appointment.status);
                const done = appointment.status === "completed";
                return (
                  <li key={appointment.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{patientName(appointment.patientId)}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatTime(appointment.scheduledAt)} · {appointment.durationMinutes} min
                          {appointment.branchId ? ` · ${branchName(appointment.branchId)}` : ""}
                        </p>
                        {appointment.reason ? (
                          <p className="mt-1 text-xs text-ink-soft">{appointment.reason}</p>
                        ) : null}
                      </div>
                      <Badge tone={statusTone[appointment.status]} dot>
                        {APPOINTMENT_STATUS_LABELS[appointment.status]}
                      </Badge>
                    </div>
                    {reopenable ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => changeStatus(appointment, "scheduled")}>
                          <RotateCcw className="size-3.5" /> Reopen
                        </Button>
                        <span className="text-[11px] text-ink-faint">Re-opens to Scheduled.</span>
                      </div>
                    ) : done ? null : (
                      <>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {APPOINTMENT_ACTIONS.map((action) => (
                            <Button
                              key={action.status}
                              variant={action.status === "cancelled" ? "subtle" : "outline"}
                              size="sm"
                              disabled={busy}
                              onClick={() => changeStatus(appointment, action.status)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-ink-faint">
                          Check-in & completion update automatically when the patient is seen in OPD.
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
