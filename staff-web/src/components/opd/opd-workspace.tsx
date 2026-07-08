"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Phone,
  UserPlus,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  GENDER_OPTIONS,
  REGISTER_STATUS_FILTERS,
  VISIT_STATUS_LABELS,
  formatTime,
  isoDateDaysAgo,
  type IntakeDoctor,
  type IntakeLookupResult,
  type IntakeTodayAppointment,
  type Visit,
  type VisitListFilters,
  type VisitStatus,
  type Vitals
} from "@/lib/opd-types";
import {
  intakeLookupAction,
  listVisitsAction,
  registerVisitAction
} from "@/app/(app)/opd/actions";
import { HighlightMenu, OpdRegisterList, useRowHighlights } from "@/components/opd/opd-register-list";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type DateMode = "today" | "week" | "all" | "custom";

const DATE_MODE_OPTIONS: { value: DateMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "custom", label: "Custom" }
];

type Props = {
  today: string;
  visits: Visit[];
  doctors: IntakeDoctor[];
};

export function OpdWorkspace({ today, visits: initialVisits, doctors }: Props) {
  const { toast } = useToast();
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [statusFilter, setStatusFilter] = useState<VisitStatus | "all">("all");
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const { rules, setRule } = useRowHighlights();

  // Date-range + doctor filter server-side (GET /visits); the status chips
  // filter client-side so every chip keeps a live count for the loaded range.
  function serverFilters(): VisitListFilters {
    const filters: VisitListFilters = {};
    if (dateMode === "today") {
      filters.date = today;
    } else if (dateMode === "week") {
      filters.from = isoDateDaysAgo(6);
      filters.to = today;
    } else if (dateMode === "custom") {
      if (customFrom) filters.from = customFrom;
      if (customTo) filters.to = customTo;
    }
    if (doctorId) filters.doctorId = doctorId;
    return filters;
  }

  function refresh() {
    startRefresh(async () => {
      const result = await listVisitsAction(serverFilters());
      if (!result.ok || !result.data) {
        toast(result.error ?? "Could not load the register.", "error");
        return;
      }
      setVisits(result.data);
    });
  }

  // Refetch when the server-side filters change. The first render already has
  // today's list from the server, so skip it.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, customFrom, customTo, doctorId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visits.length };
    for (const v of visits) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [visits]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? visits : visits.filter((v) => v.status === statusFilter)),
    [visits, statusFilter]
  );

  return (
    <>
      <div className="space-y-5">
        <Panel>
          <SectionTitle
            icon={<ClipboardList className="size-4" />}
            title="OPD register"
            subtitle="The OPD register — every visit, its clinical record and prescriptions"
            action={
              <Button onClick={() => setRegisterOpen(true)}>
                <UserPlus className="size-3.5" /> Register walk-in
              </Button>
            }
          />

          {/* Status chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {REGISTER_STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                  statusFilter === f.value
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-surface text-ink-soft ring-line-strong hover:bg-surface-muted"
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    statusFilter === f.value ? "bg-white/20" : "bg-fill text-ink-muted"
                  )}
                >
                  {counts[f.value] ?? 0}
                </span>
              </button>
            ))}
            <div className="ml-auto">
              <HighlightMenu rules={rules} setRule={setRule} />
            </div>
          </div>

          {/* Date range + doctor */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Segmented options={DATE_MODE_OPTIONS} value={dateMode} onChange={setDateMode} size="sm" />
            {dateMode === "custom" ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="From date"
                  className="h-8 w-36 px-2 text-xs"
                />
                <span className="text-xs text-ink-faint">to</span>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="To date"
                  className="h-8 w-36 px-2 text-xs"
                />
              </div>
            ) : null}
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              aria-label="Filter by doctor"
              className={cn(selectClass, "h-8 w-auto min-w-40 py-0 text-xs")}
            >
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
            {refreshing ? <Loader2 className="size-4 animate-spin text-ink-faint" aria-label="Loading visits" /> : null}
          </div>
        </Panel>

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title={
                statusFilter !== "all"
                  ? `No ${VISIT_STATUS_LABELS[statusFilter].toLowerCase()} visits here`
                  : dateMode === "today"
                    ? "No visits registered today"
                    : "No visits in this range"
              }
              description={
                statusFilter === "all" && dateMode === "today"
                  ? "Register a walk-in to add the first visit to today's page of the register."
                  : "Adjust the filters — every registered visit stays in the register."
              }
            />
          </Panel>
        ) : (
          <Panel className="p-0">
            <OpdRegisterList visits={filtered} rules={rules} />
          </Panel>
        )}
      </div>

      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        doctors={doctors}
        onRegistered={() => {
          setRegisterOpen(false);
          toast("Walk-in registered.", "success");
          refresh();
        }}
      />
    </>
  );
}

// ---- Register walk-in modal ------------------------------------------------

function RegisterModal({
  open,
  onClose,
  doctors,
  onRegistered
}: {
  open: boolean;
  onClose: () => void;
  doctors: IntakeDoctor[];
  onRegistered: () => void;
}) {
  const { toast } = useToast();

  // Lookup
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<IntakeLookupResult | null>(null);
  const [matchedPatientId, setMatchedPatientId] = useState<string | null>(null);
  const [recentCount, setRecentCount] = useState(0);
  const [todaysAppts, setTodaysAppts] = useState<IntakeTodayAppointment[]>([]);
  const [linkedApptId, setLinkedApptId] = useState<string | null>(null);
  const [lookingUp, startLookup] = useTransition();

  // Identity
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("female");

  // Visit — identity-only registration; clinical capture moves to the encounter.
  const [doctorId, setDoctorId] = useState("");
  const [vitals, setVitals] = useState<Vitals>({});
  const [showVitals, setShowVitals] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function resetAll() {
    setPhone("");
    setLookup(null);
    setMatchedPatientId(null);
    setRecentCount(0);
    setTodaysAppts([]);
    setLinkedApptId(null);
    setName("");
    setAge("");
    setGender("female");
    setDoctorId("");
    setVitals({});
    setShowVitals(false);
    setError(null);
  }

  function close() {
    resetAll();
    onClose();
  }

  function runLookup() {
    const raw = phone.trim();
    if (!raw) {
      setError("Enter a phone number to look up.");
      return;
    }
    setError(null);
    startLookup(async () => {
      const result = await intakeLookupAction(raw);
      if (!result.ok || !result.data) {
        toast(result.error ?? "Could not look up that number.", "error");
        return;
      }
      const data = result.data;
      setLookup(data);
      setMatchedPatientId(null);
      setRecentCount(0);
      setTodaysAppts([]);
      setLinkedApptId(null);
      if (data.match === "patient" && data.patient) {
        setMatchedPatientId(data.patient.id);
        setName(data.patient.displayName);
        setAge(data.patient.age ? String(data.patient.age) : "");
        if (data.patient.gender) setGender(data.patient.gender);
        setRecentCount(data.recentVisits?.length ?? 0);
        // Reflect today's appointment(s): default to linking the first, and adopt
        // its doctor so the visit registers under the right doctor.
        const appts = data.todaysAppointments ?? [];
        setTodaysAppts(appts);
        if (appts.length > 0) {
          setLinkedApptId(appts[0].id);
          if (appts[0].doctorId && doctors.some((d) => d.id === appts[0].doctorId)) {
            setDoctorId(appts[0].doctorId);
          }
        }
      } else if (data.match === "lead" && data.lead) {
        setName(data.lead.name);
      }
    });
  }

  // Auto-lookup: once a full phone number is typed, look the patient up (debounced)
  // — no manual button press needed.
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    const handle = setTimeout(() => runLookup(), 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  function submit() {
    if (!matchedPatientId && !name.trim()) {
      setError("Enter the patient's name (or look up an existing patient).");
      return;
    }
    const parsedAge = age ? Number(age) : undefined;
    if (age && (Number.isNaN(parsedAge) || (parsedAge as number) < 0 || (parsedAge as number) > 130)) {
      setError("Enter a valid age between 0 and 130.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await registerVisitAction({
        ...(matchedPatientId
          ? { patientId: matchedPatientId }
          : { name: name.trim(), age: parsedAge, gender, phone: phone.trim() || undefined }),
        doctorId: doctorId || undefined,
        appointmentId: linkedApptId || undefined,
        department: selectedDoctor?.specialty || undefined,
        vitals: Object.keys(vitals).length ? vitals : undefined
      });
      if (!result.ok) {
        setError(result.error ?? "Could not register the walk-in.");
        return;
      }
      resetAll();
      onRegistered();
    });
  }

  return (
    <Modal open={open} onClose={close} labelledBy="opd-register-title" align="top" className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div>
          <h2 id="opd-register-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <UserPlus className="size-4 text-brand-600" /> Register walk-in
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Just register the patient — the doctor or staff capture the clinical observations after.</p>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[68vh] space-y-5 overflow-y-auto p-5">
        {/* Step 1 — lookup */}
        <div className="rounded-xl border border-line bg-surface-muted p-3.5">
          <p className="mb-2 text-xs font-medium text-ink-soft">
            Find patient by phone <span className="font-normal text-ink-faint">— searches as you type</span>
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
            <Phone className="size-4 text-ink-faint" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runLookup();
                }
              }}
              inputMode="tel"
              placeholder="+91…"
              aria-label="Phone number"
              className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            {lookingUp ? (
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
                <Loader2 className="size-3.5 animate-spin" /> Searching…
              </span>
            ) : null}
          </div>

          {lookup ? (
            <div className="mt-3">
              {lookup.match === "patient" ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                    Existing patient: <span className="font-semibold">{lookup.patient?.displayName}</span>
                    {recentCount > 0 ? <span className="text-brand-600"> · {recentCount} recent visit{recentCount === 1 ? "" : "s"}</span> : null}
                  </div>
                  {todaysAppts.length > 0 ? (
                    <div className="rounded-lg border border-[var(--color-good)]/30 bg-[var(--color-good-soft)] px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-good)]">
                        <Clock className="size-3.5" /> Has an appointment today
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {todaysAppts.map((a) => {
                          const linked = linkedApptId === a.id;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setLinkedApptId(linked ? null : a.id)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                                linked
                                  ? "border-[var(--color-good)]/40 bg-white text-ink"
                                  : "border-transparent bg-white/50 text-ink-muted hover:bg-white"
                              )}
                            >
                              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", linked ? "border-[var(--color-good)] bg-[var(--color-good)] text-white" : "border-line")}>
                                {linked ? <CheckCircle2 className="size-3" /> : null}
                              </span>
                              <span className="font-semibold">{formatTime(a.scheduledAt)}</span>
                              <span className="text-ink-soft">{a.doctorName ?? "Doctor"}{a.specialty ? ` · ${a.specialty}` : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink-muted">
                        {linkedApptId ? "This walk-in will be linked and the appointment checked in." : "Not linked — registering as a fresh walk-in."}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : lookup.match === "lead" ? (
                <div className="rounded-lg bg-[var(--color-medium-soft)] px-3 py-2 text-xs text-[var(--color-medium)]">
                  Matched lead: <span className="font-semibold">{lookup.lead?.name}</span> — name prefilled, will create a new patient.
                </div>
              ) : (
                <div className="rounded-lg bg-fill px-3 py-2 text-xs text-ink-soft">
                  New patient — enter details below.
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Step 2 — identity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Name" htmlFor="opd-name">
              <Input
                id="opd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anita Sharma"
                disabled={Boolean(matchedPatientId)}
              />
            </Field>
          </div>
          <Field label="Age" htmlFor="opd-age">
            <Input id="opd-age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="54" disabled={Boolean(matchedPatientId)} />
          </Field>
          <Field label="Gender" htmlFor="opd-gender">
            <select id="opd-gender" value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass} disabled={Boolean(matchedPatientId)}>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Doctor / department */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Doctor / department" htmlFor="opd-doctor">
            <select id="opd-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={selectClass}>
              <option value="">Unassigned</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {selectedDoctor?.specialty ? (
            <div className="flex items-end pb-2.5 text-xs text-ink-muted">Department: {selectedDoctor.specialty}</div>
          ) : null}
        </div>

        {/* Vitals (collapsible) */}
        <div className="rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setShowVitals((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-ink-soft"
          >
            <span className="inline-flex items-center gap-1.5">
              <Activity className="size-3.5 text-ink-faint" /> Add vitals
            </span>
            <span className="text-ink-faint">{showVitals ? "Hide" : "Show"}</span>
          </button>
          {showVitals ? (
            <div className="border-t border-line p-3.5">
              <VitalsFields value={vitals} onChange={setVitals} />
            </div>
          ) : null}
        </div>

        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          <UserPlus className="size-3.5" /> {saving ? "Registering…" : "Register walk-in"}
        </Button>
      </div>
    </Modal>
  );
}

// ---- Shared: vitals fields -------------------------------------------------

function VitalsFields({ value, onChange }: { value: Vitals; onChange: (next: Vitals) => void }) {
  function setText(key: "bp" | "visualAcuityOD" | "visualAcuityOS", v: string) {
    onChange({ ...value, [key]: v || undefined });
  }
  function setNum(key: "pulseBpm" | "spo2" | "tempC" | "weightKg" | "heightCm" | "iopOD" | "iopOS", v: string) {
    const n = v === "" ? undefined : Number(v);
    onChange({ ...value, [key]: typeof n === "number" && Number.isNaN(n) ? undefined : n });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="BP" htmlFor="vt-bp">
          <Input id="vt-bp" value={value.bp ?? ""} onChange={(e) => setText("bp", e.target.value)} placeholder="120/80" />
        </Field>
        <Field label="Pulse (bpm)" htmlFor="vt-pulse">
          <Input id="vt-pulse" value={value.pulseBpm ?? ""} onChange={(e) => setNum("pulseBpm", e.target.value)} inputMode="numeric" placeholder="72" />
        </Field>
        <Field label="SpO₂ (%)" htmlFor="vt-spo2">
          <Input id="vt-spo2" value={value.spo2 ?? ""} onChange={(e) => setNum("spo2", e.target.value)} inputMode="numeric" placeholder="98" />
        </Field>
        <Field label="Temp (°C)" htmlFor="vt-temp">
          <Input id="vt-temp" value={value.tempC ?? ""} onChange={(e) => setNum("tempC", e.target.value)} inputMode="decimal" placeholder="37.0" />
        </Field>
        <Field label="Weight (kg)" htmlFor="vt-weight">
          <Input id="vt-weight" value={value.weightKg ?? ""} onChange={(e) => setNum("weightKg", e.target.value)} inputMode="decimal" placeholder="68" />
        </Field>
        <Field label="Height (cm)" htmlFor="vt-height">
          <Input id="vt-height" value={value.heightCm ?? ""} onChange={(e) => setNum("heightCm", e.target.value)} inputMode="numeric" placeholder="165" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Eye</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visual acuity OD" htmlFor="vt-vaod">
            <Input id="vt-vaod" value={value.visualAcuityOD ?? ""} onChange={(e) => setText("visualAcuityOD", e.target.value)} placeholder="6/6" />
          </Field>
          <Field label="Visual acuity OS" htmlFor="vt-vaos">
            <Input id="vt-vaos" value={value.visualAcuityOS ?? ""} onChange={(e) => setText("visualAcuityOS", e.target.value)} placeholder="6/9" />
          </Field>
          <Field label="IOP OD (mmHg)" htmlFor="vt-iopod">
            <Input id="vt-iopod" value={value.iopOD ?? ""} onChange={(e) => setNum("iopOD", e.target.value)} inputMode="numeric" placeholder="16" />
          </Field>
          <Field label="IOP OS (mmHg)" htmlFor="vt-iopos">
            <Input id="vt-iopos" value={value.iopOS ?? ""} onChange={(e) => setNum("iopOS", e.target.value)} inputMode="numeric" placeholder="15" />
          </Field>
        </div>
      </div>
    </div>
  );
}
