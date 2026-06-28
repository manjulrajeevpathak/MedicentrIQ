"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  FileText,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Upload,
  UserPlus,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  CHIEF_COMPLAINT_CHIPS,
  DISPOSITION_OUTCOMES,
  DISPOSITION_OUTCOME_LABELS,
  GENDER_OPTIONS,
  QUEUE_FILTERS,
  VISIT_DOCUMENT_TYPES,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONE,
  formatTime,
  visitMeta,
  type ConditionCatalogEntry,
  type Disposition,
  type IntakeCondition,
  type IntakeDoctor,
  type IntakeLookupResult,
  type IntakeTodayAppointment,
  type Visit,
  type VisitStatus,
  type Vitals
} from "@/lib/opd-types";
import {
  intakeLookupAction,
  loadVisitAction,
  refreshVisitsAction,
  registerVisitAction,
  updateVisitAction,
  uploadVisitDocumentAction
} from "@/app/(app)/opd/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

const textareaClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Props = {
  today: string;
  visits: Visit[];
  doctors: IntakeDoctor[];
  conditionCatalog: ConditionCatalogEntry[];
};

export function OpdWorkspace({ today, visits: initialVisits, doctors, conditionCatalog }: Props) {
  const { toast } = useToast();
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [filter, setFilter] = useState<VisitStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [consultVisit, setConsultVisit] = useState<Visit | null>(null);
  const [, startRefresh] = useTransition();

  async function refresh() {
    const result = await refreshVisitsAction(today);
    if (result.ok && result.data) setVisits(result.data);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visits.length };
    for (const v of visits) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [visits]);

  const filtered = useMemo(
    () => (filter === "all" ? visits : visits.filter((v) => v.status === filter)),
    [visits, filter]
  );

  function progressStatus(visit: Visit, status: VisitStatus) {
    startRefresh(async () => {
      const result = await updateVisitAction(visit.id, { status });
      if (!result.ok) {
        toast(result.error ?? "Could not update the visit.", "error");
        return;
      }
      toast(status === "in_consult" ? "Consult started." : "Visit updated.", "success");
      await refresh();
    });
  }

  async function openConsult(visit: Visit) {
    // Pull the freshest copy so the drawer shows persisted diagnosis/disposition.
    const result = await loadVisitAction(visit.id);
    setConsultVisit(result.ok && result.data ? result.data : visit);
  }

  return (
    <>
      <div className="space-y-5">
        <Panel>
          <SectionTitle
            icon={<ClipboardPlus className="size-4" />}
            title="OPD walk-in intake"
            subtitle="Register walk-ins, run the queue and capture the consult"
            action={
              <Button onClick={() => setRegisterOpen(true)}>
                <UserPlus className="size-3.5" /> Register walk-in
              </Button>
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {QUEUE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                  filter === f.value
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-surface text-ink-soft ring-line-strong hover:bg-surface-muted"
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    filter === f.value ? "bg-white/20" : "bg-fill text-ink-muted"
                  )}
                >
                  {counts[f.value] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<ClipboardPlus className="size-5" />}
              title={filter === "all" ? "No walk-ins today" : `Nothing ${VISIT_STATUS_LABELS[filter].toLowerCase()}`}
              description={
                filter === "all"
                  ? "Register your first walk-in to start the OPD queue for today."
                  : "Switch filters or register a new walk-in."
              }
            />
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((visit) => (
              <QueueCard
                key={visit.id}
                visit={visit}
                busy={false}
                onStart={() => progressStatus(visit, "in_consult")}
                onConsult={() => openConsult(visit)}
              />
            ))}
          </div>
        )}
      </div>

      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        doctors={doctors}
        conditionCatalog={conditionCatalog}
        onRegistered={async () => {
          setRegisterOpen(false);
          toast("Walk-in registered.", "success");
          await refresh();
        }}
      />

      {consultVisit ? (
        <ConsultDrawer
          key={consultVisit.id}
          visit={consultVisit}
          conditionCatalog={conditionCatalog}
          onClose={() => setConsultVisit(null)}
          onSaved={async () => {
            setConsultVisit(null);
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}

// ---- Queue card ------------------------------------------------------------

function QueueCard({
  visit,
  busy,
  onStart,
  onConsult
}: {
  visit: Visit;
  busy: boolean;
  onStart: () => void;
  onConsult: () => void;
}) {
  const meta = visitMeta(visit);
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{visit.patientName ?? "Walk-in patient"}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{meta || "No details"}</p>
        </div>
        <Badge tone={VISIT_STATUS_TONE[visit.status] ?? "neutral"} dot>
          {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{visit.chiefComplaint}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {visit.doctorName || visit.department ? (
          <span className="inline-flex items-center gap-1.5">
            <Stethoscope className="size-3.5 text-ink-faint" />
            {visit.doctorName ?? visit.department}
            {visit.doctorName && visit.department ? ` · ${visit.department}` : ""}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 text-ink-faint" /> {formatTime(visit.registeredAt ?? visit.createdAt)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
        {visit.status === "registered" ? (
          <Button size="sm" onClick={onStart} disabled={busy}>
            <Activity className="size-3.5" /> Start consult
          </Button>
        ) : null}
        {visit.status === "in_consult" ? (
          <Button size="sm" onClick={onConsult}>
            <ClipboardPlus className="size-3.5" /> Record consult
          </Button>
        ) : null}
        {visit.status === "completed" ? (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-ink-soft">
              {visit.disposition ? (
                <>
                  Outcome:{" "}
                  <span className="font-medium text-ink">
                    {DISPOSITION_OUTCOME_LABELS[visit.disposition.outcome] ?? visit.disposition.outcome}
                  </span>
                </>
              ) : (
                "Completed"
              )}
            </span>
            <Link
              href={`/patients/${visit.patientId}`}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Open patient
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// ---- Register walk-in modal ------------------------------------------------

function RegisterModal({
  open,
  onClose,
  doctors,
  conditionCatalog,
  onRegistered
}: {
  open: boolean;
  onClose: () => void;
  doctors: IntakeDoctor[];
  conditionCatalog: ConditionCatalogEntry[];
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

  // Visit
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [conditions, setConditions] = useState<IntakeCondition[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [vitals, setVitals] = useState<Vitals>({});
  const [showVitals, setShowVitals] = useState(false);
  const [notes, setNotes] = useState("");

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
    setChiefComplaint("");
    setConditions([]);
    setAllergies([]);
    setDoctorId("");
    setVitals({});
    setShowVitals(false);
    setNotes("");
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
        if (data.clinical?.conditions?.length) setConditions(data.clinical.conditions);
        if (data.clinical?.allergies?.length) setAllergies(data.clinical.allergies);
        setRecentCount(data.recentVisits?.length ?? 0);
        // Reflect today's appointment(s): default to linking the first, and adopt
        // its doctor so the walk-in lands in the right queue.
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

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  function submit() {
    const cc = chiefComplaint.trim();
    if (!cc) {
      setError("Enter the chief complaint.");
      return;
    }
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
        chiefComplaint: cc,
        doctorId: doctorId || undefined,
        appointmentId: linkedApptId || undefined,
        department: selectedDoctor?.specialty || undefined,
        intakeConditions: conditions,
        intakeAllergies: allergies,
        vitals: Object.keys(vitals).length ? vitals : undefined,
        intakeNotes: notes || undefined
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
          <p className="mt-1 text-xs text-ink-muted">Phone-first intake — look up, then capture the visit.</p>
        </div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[68vh] space-y-5 overflow-y-auto p-5">
        {/* Step 1 — lookup */}
        <div className="rounded-xl border border-line bg-surface-muted p-3.5">
          <p className="mb-2 text-xs font-medium text-ink-soft">Look up by phone</p>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
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
            </div>
            <Button variant="outline" onClick={runLookup} disabled={lookingUp}>
              <Search className="size-3.5" /> {lookingUp ? "Looking…" : "Look up"}
            </Button>
          </div>

          {lookup ? (
            <div className="mt-3">
              {lookup.match === "patient" ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                    Existing patient: <span className="font-semibold">{lookup.patient?.displayName}</span>
                    {recentCount > 0 ? <span className="text-brand-600"> · {recentCount} recent visit{recentCount === 1 ? "" : "s"}</span> : null}
                    <span className="text-brand-600"> · conditions & allergies prefilled</span>
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

        {/* Chief complaint */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Chief complaint *</p>
          <textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            rows={2}
            placeholder="What brings the patient in today…"
            className={textareaClass}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHIEF_COMPLAINT_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  setChiefComplaint((prev) => {
                    const t = prev.trim();
                    if (!t) return chip;
                    if (t.toLowerCase().includes(chip.toLowerCase())) return prev;
                    return `${t}, ${chip}`;
                  })
                }
                className="rounded-full bg-fill px-2.5 py-1 text-xs text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-existing conditions */}
        <ConditionPicker
          label="Pre-existing conditions"
          catalog={conditionCatalog}
          value={conditions}
          onChange={setConditions}
        />

        {/* Allergies */}
        <AllergyInput value={allergies} onChange={setAllergies} />

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

        {/* Notes */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Intake notes…" className={textareaClass} />
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

// ---- Consult drawer --------------------------------------------------------

function ConsultDrawer({
  visit,
  conditionCatalog,
  onClose,
  onSaved
}: {
  /** Always non-null — the parent keys this component by visit id. */
  visit: Visit;
  conditionCatalog: ConditionCatalogEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [diagnosis, setDiagnosis] = useState<IntakeCondition[]>(visit.diagnosis ?? []);
  const [outcome, setOutcome] = useState(visit.disposition?.outcome ?? DISPOSITION_OUTCOMES[0]?.value ?? "");
  const [dispNotes, setDispNotes] = useState(visit.disposition?.notes ?? "");
  const [nextStep, setNextStep] = useState(visit.disposition?.nextStep ?? "");
  const [nextActionDate, setNextActionDate] = useState(visit.disposition?.nextActionDate ?? "");
  const [vitals, setVitals] = useState<Vitals>(visit.vitals ?? {});
  const [consultNotes, setConsultNotes] = useState(visit.consultNotes ?? "");
  const [saving, startSaving] = useTransition();

  function complete() {
    if (!outcome) {
      toast("Pick a disposition outcome to complete the visit.", "error");
      return;
    }
    const disposition: Disposition = {
      outcome,
      ...(dispNotes.trim() ? { notes: dispNotes.trim() } : {}),
      ...(nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
      ...(nextActionDate ? { nextActionDate } : {})
    };
    startSaving(async () => {
      const result = await updateVisitAction(visit.id, {
        status: "completed",
        diagnosis,
        disposition,
        vitals: Object.keys(vitals).length ? vitals : undefined,
        consultNotes: consultNotes || undefined
      });
      if (!result.ok) {
        toast(result.error ?? "Could not complete the visit.", "error");
        return;
      }
      toast("Visit completed.", "success");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record consult"
        className="animate-in relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <ClipboardPlus className="size-4 text-brand-600" /> Record consult
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {visit.patientName ?? "Walk-in patient"} · {visit.chiefComplaint}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Diagnosis */}
          <ConditionPicker
            label="Diagnosis"
            catalog={conditionCatalog}
            value={diagnosis}
            onChange={setDiagnosis}
            placeholder="Add a diagnosis — search ICD-10 code or name…"
          />

          {/* Disposition */}
          <div className="rounded-xl border border-line p-3.5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Disposition *</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Outcome" htmlFor="opd-disp-outcome">
                <select id="opd-disp-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={selectClass}>
                  {DISPOSITION_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Next action date" htmlFor="opd-disp-date">
                <Input id="opd-disp-date" type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Next step" htmlFor="opd-disp-next">
                <Input id="opd-disp-next" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Review in 2 weeks" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Notes" htmlFor="opd-disp-notes">
                <textarea id="opd-disp-notes" value={dispNotes} onChange={(e) => setDispNotes(e.target.value)} rows={2} placeholder="Disposition notes…" className={textareaClass} />
              </Field>
            </div>
          </div>

          {/* Vitals */}
          <div className="rounded-xl border border-line p-3.5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Vitals</p>
            <VitalsFields value={vitals} onChange={setVitals} />
          </div>

          {/* Consult notes */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Consult notes</p>
            <textarea value={consultNotes} onChange={(e) => setConsultNotes(e.target.value)} rows={3} placeholder="Clinical notes from the consult…" className={textareaClass} />
          </div>

          {/* Documents */}
          <VisitDocuments visit={visit} />
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button onClick={complete} disabled={saving}>
            <CheckCircle2 className="size-3.5" /> {saving ? "Completing…" : "Complete visit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Visit documents (reuses the patient documents upload flow) ------------

function VisitDocuments({ visit }: { visit: Visit }) {
  const { toast } = useToast();
  const [type, setType] = useState<string>("prescription");
  const [uploading, startUpload] = useTransition();
  const [uploaded, setUploaded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("Choose a file to upload.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("patientId", visit.patientId);
    fd.set("visitId", visit.id);
    fd.set("type", type);
    fd.set("file", file);
    startUpload(async () => {
      const result = await uploadVisitDocumentAction(fd);
      if (!result.ok) {
        toast(result.error ?? "Could not upload the document.", "error");
        return;
      }
      toast(result.message ?? "Document uploaded.", "success");
      setUploaded((prev) => [...prev, file.name]);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="rounded-xl border border-line p-3.5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        <FileText className="size-3.5 text-ink-faint" /> Documents
      </p>
      {uploaded.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {uploaded.map((n, i) => (
            <li key={`${n}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-ink-soft">
              <CheckCircle2 className="size-3.5 text-[var(--color-good)]" /> {n}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={type} onChange={(e) => setType(e.target.value)} className={cn(selectClass, "sm:w-48")}>
          {VISIT_DOCUMENT_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          className="flex-1 text-xs text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <Button onClick={upload} disabled={uploading}>
          <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </div>
  );
}

// ---- Shared: ICD-10 condition picker ---------------------------------------

function ConditionPicker({
  label,
  catalog,
  value,
  onChange,
  placeholder = "Add a condition — search ICD-10 code or name…"
}: {
  label: string;
  catalog: ConditionCatalogEntry[];
  value: IntakeCondition[];
  onChange: (next: IntakeCondition[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (c) =>
          !value.some((existing) => existing.icd10Code === c.icd10Code) &&
          (c.icd10Code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [catalog, query, value]);

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>
      {value.length > 0 ? (
        <ul className="mb-2 space-y-1.5">
          {value.map((c) => (
            <li
              key={c.icd10Code}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2"
            >
              <span className="min-w-0 text-sm text-ink">
                <span className="font-mono text-xs text-brand-700">{c.icd10Code}</span>{" "}
                <span className="text-ink-soft">{c.label}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.icd10Code !== c.icd10Code))}
                className="rounded p-1 text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
                aria-label={`Remove ${c.label}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <Input placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        {matches.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
            {matches.map((m) => (
              <li key={m.icd10Code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...value, { icd10Code: m.icd10Code, label: m.label }]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-muted"
                >
                  <span className="font-mono text-xs text-brand-700">{m.icd10Code}</span>
                  <span className="min-w-0 truncate">{m.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <p className="mt-1 px-1 text-[11px] text-ink-muted">No catalog match for “{query}”.</p>
        ) : null}
      </div>
    </div>
  );
}

// ---- Shared: allergies chip input ------------------------------------------

function AllergyInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (!v || value.includes(v)) {
      setInput("");
      return;
    }
    onChange([...value, v]);
    setInput("");
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-soft">Allergies</p>
      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-high-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-high)]"
            >
              {a}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== a))}
                className="rounded-full p-0.5 hover:bg-black/5"
                aria-label={`Remove ${a}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Penicillin"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" onClick={add} disabled={!input.trim()}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
    </div>
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
