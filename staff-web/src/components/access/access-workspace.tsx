"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Plus,
  Send,
  Stethoscope,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_ACTIONS,
  APPOINTMENT_STATUS_LABELS,
  SLOT_MINUTE_OPTIONS,
  WEEKDAYS,
  type Appointment,
  type AppointmentStatus,
  type BranchOption,
  type Doctor,
  type PatientOption,
  type ScheduleWindow,
  type Slot,
  type WeeklyHours,
  type WeekdayIndex
} from "@/lib/scheduling-types";
import {
  bookAppointmentAction,
  createDoctorAction,
  loadAppointmentsAction,
  loadSlotsAction,
  sendConfirmationsAction,
  setAppointmentStatusAction,
  setDoctorScheduleAction,
  updateDoctorAction
} from "@/app/(app)/access/actions";

type Tab = "book" | "doctors";

type Props = {
  doctors: Doctor[];
  patients: PatientOption[];
  branches: BranchOption[];
  today: string;
  initialDoctorId: string;
  initialAppointments: Appointment[];
  canManageDoctors: boolean;
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
  initialAppointments,
  canManageDoctors
}: Props) {
  const [tab, setTab] = useState<Tab>("book");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Appointments</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Book patients into available slots, manage today&apos;s schedule and doctor availability.
          </p>
        </div>
        <Segmented<Tab>
          options={
            canManageDoctors
              ? [
                  { value: "book", label: "Booking" },
                  { value: "doctors", label: "Doctors" }
                ]
              : [{ value: "book", label: "Booking" }]
          }
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "book" ? (
        <BookingTab
          doctors={doctors}
          patients={patients}
          branches={branches}
          today={today}
          initialDoctorId={initialDoctorId}
          initialAppointments={initialAppointments}
        />
      ) : (
        <DoctorsTab doctors={doctors} branches={branches} />
      )}
    </div>
  );
}

// ---- Booking tab -----------------------------------------------------------

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
              description="No open slots — set this doctor's schedule on the Doctors tab."
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

// ---- Doctors tab -----------------------------------------------------------

function DoctorsTab({ doctors, branches }: { doctors: Doctor[]; branches: BranchOption[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [branches]);

  return (
    <div className="space-y-5">
      <AddDoctorForm branches={branches} onToast={toast} />

      <Panel padded={false}>
        <div className="p-4 pb-3">
          <SectionTitle
            icon={<Stethoscope className="size-4" />}
            title="Doctors"
            subtitle={`${doctors.length} configured`}
          />
        </div>
        {doctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="size-5" />}
            title="No doctors yet"
            description="Add your first doctor above, then set their weekly schedule."
          />
        ) : (
          <ul className="divide-y divide-line">
            {doctors.map((doctor) => (
              <li key={doctor.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{doctor.displayName}</p>
                      <Badge tone={doctor.status === "active" ? "good" : "neutral"} dot className="capitalize">
                        {doctor.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {doctor.specialty ? `${doctor.specialty} · ` : ""}
                      {doctor.slotMinutes} min slots
                      {doctor.phone ? ` · ${doctor.phone}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {doctor.branchIds.length
                        ? doctor.branchIds.map(branchName).join(", ")
                        : "No branches assigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editingId === doctor.id ? null : doctor.id)}
                    >
                      {editingId === doctor.id ? "Close" : "Set schedule"}
                    </Button>
                    <Button
                      variant={doctor.status === "active" ? "subtle" : "secondary"}
                      size="sm"
                      onClick={async () => {
                        const next = doctor.status === "active" ? "inactive" : "active";
                        const result = await updateDoctorAction(doctor.id, { status: next });
                        toast(
                          result.ok
                            ? next === "active"
                              ? "Doctor reactivated."
                              : "Doctor deactivated."
                            : result.error ?? "Could not update the doctor.",
                          result.ok ? "success" : "error"
                        );
                      }}
                    >
                      {doctor.status === "active" ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>

                {editingId === doctor.id ? (
                  <ScheduleEditor doctor={doctor} onToast={toast} onSaved={() => setEditingId(null)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AddDoctorForm({
  branches,
  onToast
}: {
  branches: BranchOption[];
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const displayName = String(fd.get("displayName") ?? "");
    const specialty = String(fd.get("specialty") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const slotMinutes = Number(fd.get("slotMinutes") ?? 20);
    const branchIds = fd.getAll("branchIds").map((b) => String(b));

    startTransition(async () => {
      const result = await createDoctorAction({
        displayName,
        specialty: specialty || undefined,
        phone: phone || undefined,
        slotMinutes,
        branchIds
      });
      if (!result.ok) {
        setError(result.error ?? "Could not add the doctor.");
        return;
      }
      form.reset();
      onToast("Doctor added.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<Plus className="size-4" />}
        title="Add doctor"
        subtitle="Create a doctor, then set their weekly schedule"
      />
      <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Name" htmlFor="dr-name">
            <Input id="dr-name" name="displayName" placeholder="Dr. Asha Rao" disabled={pending} required />
          </Field>
          <Field label="Specialty" htmlFor="dr-specialty">
            <Input id="dr-specialty" name="specialty" placeholder="Ophthalmology" disabled={pending} />
          </Field>
          <Field label="Phone" htmlFor="dr-phone">
            <Input id="dr-phone" name="phone" placeholder="+91…" disabled={pending} />
          </Field>
          <Field label="Slot length" htmlFor="dr-slot">
            <select
              id="dr-slot"
              name="slotMinutes"
              defaultValue={20}
              disabled={pending}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              {SLOT_MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset disabled={pending} className="space-y-1.5">
          <legend className="block text-xs font-medium text-ink-soft">Branches</legend>
          {branches.length === 0 ? (
            <p className="text-[11px] text-ink-muted">No branches available for this tenant.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input type="checkbox" name="branchIds" value={branch.id} className="size-3.5 accent-brand-600" />
                  {branch.displayName}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-critical)]/30 bg-[var(--color-critical-soft)] px-3 py-2 text-xs font-medium text-[var(--color-critical)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add doctor"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ScheduleEditor({
  doctor,
  onToast,
  onSaved
}: {
  doctor: Doctor;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
  onSaved: () => void;
}) {
  const [slotMinutes, setSlotMinutes] = useState(doctor.slotMinutes);
  const [hours, setHours] = useState<WeeklyHours>(() => normalizeWeekly(doctor.weeklyHours));
  const [pending, startTransition] = useTransition();

  function addWindow(day: WeekdayIndex) {
    setHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { start: "09:00", end: "17:00" }]
    }));
  }
  function removeWindow(day: WeekdayIndex, idx: number) {
    setHours((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).filter((_, i) => i !== idx)
    }));
  }
  function updateWindow(day: WeekdayIndex, idx: number, patch: Partial<ScheduleWindow>) {
    setHours((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((w, i) => (i === idx ? { ...w, ...patch } : w))
    }));
  }

  function save() {
    // Drop empty days so we send a clean weeklyHours map.
    const clean: WeeklyHours = {};
    for (const { index } of WEEKDAYS) {
      const windows = (hours[index] ?? []).filter((w) => w.start && w.end);
      if (windows.length) clean[String(index)] = windows;
    }
    startTransition(async () => {
      const result = await setDoctorScheduleAction(doctor.id, slotMinutes, clean);
      if (!result.ok) {
        onToast(result.error ?? "Could not save the schedule.", "error");
        return;
      }
      onToast("Schedule saved.", "success");
      onSaved();
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">Weekly schedule</p>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          Slot length
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            {SLOT_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {WEEKDAYS.map(({ index, label }) => {
          const windows = hours[index] ?? [];
          return (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <span className="mt-1.5 w-20 shrink-0 text-xs font-medium text-ink-soft">{label}</span>
              <div className="flex flex-1 flex-col gap-1.5">
                {windows.length === 0 ? (
                  <span className="mt-1 text-[11px] text-ink-faint">Closed</span>
                ) : (
                  windows.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindow(index, idx, { start: e.target.value })}
                        className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                      />
                      <span className="text-xs text-ink-muted">–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindow(index, idx, { end: e.target.value })}
                        className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeWindow(index, idx)}
                        className="rounded p-1 text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
                        aria-label="Remove window"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => addWindow(index)}
                  className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
                >
                  <Plus className="size-3" /> Add window
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          <CheckCircle2 className="size-3.5" /> {pending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </div>
  );
}

/** Coerce a weeklyHours map (keys may be numbers or strings) into our shape. */
function normalizeWeekly(weekly: WeeklyHours | undefined): WeeklyHours {
  const out: WeeklyHours = {};
  if (!weekly) return out;
  for (const { index } of WEEKDAYS) {
    const windows = weekly[String(index)] ?? weekly[index as unknown as string];
    if (windows && windows.length) {
      out[index] = windows.map((w) => ({ start: w.start, end: w.end, branchId: w.branchId }));
    }
  }
  return out;
}
