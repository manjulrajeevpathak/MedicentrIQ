"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarDays,
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
  sendConfirmationsAction,
  setAppointmentStatusAction
} from "@/app/(app)/access/actions";

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
  rescheduled: "brand",
  completed: "good",
  cancelled: "critical",
  no_show: "high"
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

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
  const [patientId, setPatientId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
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

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    const list = q ? patients.filter((p) => p.displayName.toLowerCase().includes(q)) : patients;
    return list.slice(0, 8);
  }, [patients, patientQuery]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

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

  function book() {
    setError(null);
    if (!patientId) {
      setError("Choose a patient.");
      return;
    }
    if (!selectedSlot) {
      setError("Choose an available slot.");
      return;
    }
    const branchId = selectedDoctor?.branchIds[0] ?? branches[0]?.id ?? "";
    startBooking(async () => {
      const result = await bookAppointmentAction({
        patientId,
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
      setPatientId("");
      setPatientQuery("");
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
          ) : slots.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="No slots"
              description="No open slots — set this doctor's schedule on the Doctors screen."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
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
              ))}
            </div>
          )}
        </div>

        {/* Patient picker + reason */}
        <div className="mt-4 space-y-3.5">
          <Field label="Patient" htmlFor="bk-patient">
            <Input
              id="bk-patient"
              placeholder="Search patients by name…"
              value={patientQuery}
              onChange={(e) => {
                setPatientQuery(e.target.value);
                setPatientId("");
              }}
              autoComplete="off"
            />
            {patientId ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-brand-700">
                <UserRound className="size-3.5" /> {patientName(patientId)}
                <button
                  type="button"
                  onClick={() => {
                    setPatientId("");
                    setPatientQuery("");
                  }}
                  className="rounded p-0.5 text-ink-faint hover:text-ink-soft"
                  aria-label="Clear patient"
                >
                  <X className="size-3" />
                </button>
              </p>
            ) : patientQuery.trim() ? (
              <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-line">
                {filteredPatients.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-ink-muted">No matching patients.</li>
                ) : (
                  filteredPatients.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientQuery(p.displayName);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-muted"
                      >
                        <UserRound className="size-3.5 text-ink-faint" /> {p.displayName}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </Field>

          <Field label="Reason (optional)" htmlFor="bk-reason">
            <Input
              id="bk-reason"
              placeholder="e.g. Follow-up consult"
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
            <Button onClick={book} disabled={booking || !selectedSlot || !patientId}>
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
                const terminal = ["cancelled", "completed", "no_show"].includes(appointment.status);
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
                    {!terminal ? (
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
                    ) : null}
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
