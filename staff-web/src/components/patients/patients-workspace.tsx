"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  FileText,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DISPOSITION_OUTCOMES,
  DISPOSITION_OUTCOME_LABELS,
  DOCUMENT_TYPES,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_TONE,
  VISIT_STATUS_TONE,
  documentDate,
  documentFilename,
  documentTypeLabel,
  formatDate,
  formatDateTime,
  type ClinicalCondition,
  type ClinicalRecord,
  type ConditionCatalogEntry,
  type DirectoryPatient,
  type LifecycleStage,
  type PatientDetail,
  type PatientDocument,
  type PatientVisit,
  type TimelineEvent
} from "@/lib/patients-types";
import {
  createPatientAction,
  getDocumentUrlAction,
  loadDocumentsAction,
  loadVisitsAction,
  recordDispositionAction,
  saveClinicalAction,
  uploadDocumentAction
} from "@/app/(app)/patients/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Props = {
  directory: DirectoryPatient[];
  conditionCatalog: ConditionCatalogEntry[];
  selectedId?: string;
  notFound?: boolean;
  detail?: PatientDetail;
  clinical?: ClinicalRecord;
  documents?: PatientDocument[];
  visits?: PatientVisit[];
  timeline?: TimelineEvent[];
};

export function PatientsWorkspace({
  directory,
  conditionCatalog,
  selectedId,
  notFound,
  detail,
  clinical,
  documents,
  visits,
  timeline
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const hasSelection = Boolean(selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        (p.primaryPhone ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [directory, query]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Directory */}
        <Panel padded={false} className={cn("flex max-h-[calc(100dvh-7.5rem)] flex-col", hasSelection && "hidden lg:flex")}>
          <div className="border-b border-line p-4">
            <SectionTitle
              icon={<Users className="size-4" />}
              title="Patient directory"
              subtitle={`${directory.length} ${directory.length === 1 ? "record" : "records"}`}
            />
            {/* Actions on their own row — the 340px column can't fit them beside the title. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/opd" className="min-w-0">
                <Button size="sm" className="w-full">
                  <ClipboardPlus className="size-3.5" /> Walk-in (OPD)
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setComposerOpen(true)}>
                <UserPlus className="size-3.5" /> Add patient
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
              <Search className="size-4 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, phone, tag…"
                aria-label="Search patients"
                className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>
          {directory.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No patients yet"
              description="Add your first patient to start building their 360 record."
            />
          ) : (
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {filtered.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/patients/${patient.id}`}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      patient.id === selectedId ? "bg-brand-50" : "hover:bg-surface-muted"
                    )}
                  >
                    <Avatar name={patient.displayName} size="md" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{patient.displayName}</span>
                      <p className="truncate text-xs text-ink-muted">
                        {[
                          patient.age ? `${patient.age}y` : null,
                          patient.gender && patient.gender !== "unknown" ? patient.gender : null,
                          patient.primaryPhone
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No details"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {filtered.length === 0 ? (
                <EmptyState icon={<Search className="size-5" />} title="No matches" description={`Nothing for “${query}”.`} />
              ) : null}
            </ul>
          )}
        </Panel>

        {/* Patient 360 */}
        {hasSelection ? (
          <div className={cn("space-y-5", !hasSelection && "hidden lg:block")}>
            <button
              onClick={() => router.push("/patients")}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden"
            >
              <ArrowLeft className="size-4" /> Directory
            </button>

            {notFound || !detail ? (
              <Panel>
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="Patient not found"
                  description="This record may have been removed or is outside your branch scope."
                />
              </Panel>
            ) : (
              <Patient360
                key={detail.id}
                detail={detail}
                conditionCatalog={conditionCatalog}
                initialClinical={clinical ?? { conditions: [], allergies: [] }}
                initialDocuments={documents ?? []}
                initialVisits={visits ?? []}
                timeline={timeline ?? []}
              />
            )}
          </div>
        ) : (
          <Panel className="hidden lg:block">
            <EmptyState
              icon={<Users className="size-5" />}
              title="Select a patient"
              description="Choose a patient from the directory to open their 360 record."
            />
          </Panel>
        )}
      </div>

      <AddPatientModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={(id) => {
          setComposerOpen(false);
          toast("Patient added.", "success");
          router.push(`/patients/${id}`);
        }}
      />
    </>
  );
}

// ---- Patient 360 -----------------------------------------------------------

function Patient360({
  detail,
  conditionCatalog,
  initialClinical,
  initialDocuments,
  initialVisits,
  timeline
}: {
  detail: PatientDetail;
  conditionCatalog: ConditionCatalogEntry[];
  initialClinical: ClinicalRecord;
  initialDocuments: PatientDocument[];
  initialVisits: PatientVisit[];
  timeline: TimelineEvent[];
}) {
  const stage = detail.lifecycle.stage as LifecycleStage;
  const meta = [
    detail.age ? `${detail.age}y` : null,
    detail.gender && detail.gender !== "unknown" ? detail.gender : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={detail.displayName} size="lg" className="size-14 text-lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{detail.displayName}</h2>
                <Badge tone={LIFECYCLE_STAGE_TONE[stage] ?? "neutral"} dot>
                  {LIFECYCLE_STAGE_LABELS[stage] ?? stage}
                </Badge>
              </div>
              {meta ? <p className="mt-0.5 text-sm text-ink-muted">{meta}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                {detail.primaryPhone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-ink-faint" /> {detail.primaryPhone}
                  </span>
                ) : null}
                {detail.lifecycle.lastVisitAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-ink-faint" /> Last visit {formatDate(detail.lifecycle.lastVisitAt)}
                  </span>
                ) : null}
              </div>
              {detail.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">{tag}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {detail.lifecycle.openNextAction ? (
          <div className="mt-4 rounded-xl bg-brand-50 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              <Activity className="size-3" /> Open next action
            </p>
            <p className="mt-1 text-sm text-ink">
              {detail.lifecycle.openNextAction.description}
              {detail.lifecycle.openNextAction.dueAt ? (
                <span className="text-ink-muted"> · {formatDateTime(detail.lifecycle.openNextAction.dueAt)}</span>
              ) : null}
            </p>
          </div>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ClinicalCard patientId={detail.id} catalog={conditionCatalog} initial={initialClinical} />
        <DocumentsCard patientId={detail.id} initial={initialDocuments} />
      </div>

      <VisitsCard patientId={detail.id} initial={initialVisits} />
      <TimelineCard events={timeline} />
    </>
  );
}

// ---- Clinical history card -------------------------------------------------

function ClinicalCard({
  patientId,
  catalog,
  initial
}: {
  patientId: string;
  catalog: ConditionCatalogEntry[];
  initial: ClinicalRecord;
}) {
  const { toast } = useToast();
  const [conditions, setConditions] = useState<ClinicalCondition[]>(initial.conditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(initial.allergies ?? []);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionQuery, setConditionQuery] = useState("");
  const [saving, startSaving] = useTransition();

  const matches = useMemo(() => {
    const q = conditionQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (c) =>
          !conditions.some((existing) => existing.icd10Code === c.icd10Code) &&
          (c.icd10Code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [catalog, conditionQuery, conditions]);

  function addCondition(entry: ConditionCatalogEntry) {
    setConditions((prev) => [...prev, { icd10Code: entry.icd10Code, label: entry.label }]);
    setConditionQuery("");
  }
  function removeCondition(code: string) {
    setConditions((prev) => prev.filter((c) => c.icd10Code !== code));
  }
  function addAllergy() {
    const v = allergyInput.trim();
    if (!v || allergies.includes(v)) {
      setAllergyInput("");
      return;
    }
    setAllergies((prev) => [...prev, v]);
    setAllergyInput("");
  }
  function removeAllergy(value: string) {
    setAllergies((prev) => prev.filter((a) => a !== value));
  }

  function save() {
    startSaving(async () => {
      const result = await saveClinicalAction(patientId, { conditions, allergies, notes });
      if (!result.ok) {
        toast(result.error ?? "Could not save clinical history.", "error");
        return;
      }
      if (result.data) {
        setConditions(result.data.conditions ?? []);
        setAllergies(result.data.allergies ?? []);
        setNotes(result.data.notes ?? "");
      }
      toast(result.message ?? "Clinical history saved.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<Stethoscope className="size-4" />}
        title="Clinical history"
        subtitle="ICD-10 conditions, allergies and notes"
      />

      {/* Conditions */}
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-ink-soft">Conditions</p>
        {conditions.length === 0 ? (
          <p className="text-xs text-ink-muted">No conditions recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {conditions.map((c) => (
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
                  onClick={() => removeCondition(c.icd10Code)}
                  className="rounded p-1 text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
                  aria-label={`Remove ${c.label}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ICD-10 picker */}
        <div className="relative mt-2">
          <Input
            placeholder="Add a condition — search ICD-10 code or name…"
            value={conditionQuery}
            onChange={(e) => setConditionQuery(e.target.value)}
            autoComplete="off"
          />
          {matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
              {matches.map((m) => (
                <li key={m.icd10Code}>
                  <button
                    type="button"
                    onClick={() => addCondition(m)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-muted"
                  >
                    <span className="font-mono text-xs text-brand-700">{m.icd10Code}</span>
                    <span className="min-w-0 truncate">{m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : conditionQuery.trim() ? (
            <p className="mt-1 px-1 text-[11px] text-ink-muted">No catalog match for “{conditionQuery}”.</p>
          ) : null}
        </div>
      </div>

      {/* Allergies */}
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-ink-soft">Allergies</p>
        {allergies.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {allergies.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-high-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-high)]"
              >
                {a}
                <button
                  type="button"
                  onClick={() => removeAllergy(a)}
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
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAllergy();
              }
            }}
          />
          <Button variant="outline" onClick={addAllergy} disabled={!allergyInput.trim()}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-ink-soft">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Clinical notes…"
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          <CheckCircle2 className="size-3.5" /> {saving ? "Saving…" : "Save clinical history"}
        </Button>
      </div>
    </Panel>
  );
}

// ---- Documents card --------------------------------------------------------

function DocumentsCard({ patientId, initial }: { patientId: string; initial: PatientDocument[] }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<PatientDocument[]>(initial);
  const [type, setType] = useState<string>("prescription");
  const [uploading, startUpload] = useTransition();
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const result = await loadDocumentsAction(patientId);
    if (result.ok && result.data) setDocuments(result.data);
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("Choose a file to upload.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("type", type);
    fd.set("file", file);
    startUpload(async () => {
      const result = await uploadDocumentAction(fd);
      if (!result.ok) {
        toast(result.error ?? "Could not upload the document.", "error");
        return;
      }
      toast(result.message ?? "Document uploaded.", "success");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    });
  }

  async function download(docId: string) {
    setBusyDocId(docId);
    const result = await getDocumentUrlAction(docId);
    setBusyDocId(null);
    if (!result.ok || !result.data) {
      toast(result.error ?? "Could not open the document.", "error");
      return;
    }
    window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Panel padded={false} className="flex flex-col">
      <div className="p-4 pb-3">
        <SectionTitle icon={<FileText className="size-4" />} title="Documents" subtitle={`${documents.length} on file`} />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No documents"
          description="Upload prescriptions, discharge summaries or lab reports below."
        />
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{documentFilename(doc)}</p>
                <p className="text-xs text-ink-muted">
                  {documentTypeLabel(doc)}
                  {documentDate(doc) ? ` · ${formatDate(documentDate(doc))}` : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => download(doc.id)} disabled={busyDocId === doc.id}>
                {busyDocId === doc.id ? "Opening…" : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto border-t border-line p-4">
        <p className="mb-2 text-xs font-medium text-ink-soft">Upload a document</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(selectClass, "sm:w-44")}>
            {DOCUMENT_TYPES.map((d) => (
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
    </Panel>
  );
}

// ---- Visits card -----------------------------------------------------------

function VisitsCard({ patientId, initial }: { patientId: string; initial: PatientVisit[] }) {
  const { toast } = useToast();
  const [visits, setVisits] = useState<PatientVisit[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    const result = await loadVisitsAction(patientId);
    if (result.ok && result.data) setVisits(result.data);
  }

  const sorted = useMemo(
    () => visits.slice().sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [visits]
  );

  return (
    <Panel padded={false}>
      <div className="p-4 pb-3">
        <SectionTitle icon={<CalendarClock className="size-4" />} title="Visits" subtitle={`${visits.length} appointments`} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="No visits"
          description="This patient's appointments will appear here once booked."
        />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((visit) => {
            const completed = visit.status === "completed";
            return (
              <li key={visit.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{formatDateTime(visit.scheduledAt)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {visit.doctorName ? `${visit.doctorName}` : "Doctor"}
                      {visit.reason ? ` · ${visit.reason}` : ""}
                    </p>
                    {visit.disposition ? (
                      <p className="mt-1 text-xs text-ink-soft">
                        Outcome:{" "}
                        <span className="font-medium text-ink">
                          {DISPOSITION_OUTCOME_LABELS[visit.disposition.outcome] ?? visit.disposition.outcome}
                        </span>
                        {visit.disposition.nextStep ? ` · Next: ${visit.disposition.nextStep}` : ""}
                        {visit.disposition.nextActionDate ? ` (${formatDate(visit.disposition.nextActionDate)})` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={VISIT_STATUS_TONE[visit.status] ?? "neutral"} dot className="capitalize">
                      {visit.status.replace(/_/g, " ")}
                    </Badge>
                    {completed && !visit.disposition ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenId(openId === visit.id ? null : visit.id)}
                      >
                        {openId === visit.id ? "Close" : "Record disposition"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {openId === visit.id ? (
                  <DispositionForm
                    appointmentId={visit.id}
                    onCancel={() => setOpenId(null)}
                    onSaved={async () => {
                      setOpenId(null);
                      toast("Visit completed.", "success");
                      await refresh();
                    }}
                    onError={(m) => toast(m, "error")}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function DispositionForm({
  appointmentId,
  onCancel,
  onSaved,
  onError
}: {
  appointmentId: string;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [outcome, setOutcome] = useState(DISPOSITION_OUTCOMES[0]?.value ?? "");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await recordDispositionAction(appointmentId, {
        outcome,
        notes: notes || undefined,
        nextStep: nextStep || undefined,
        nextActionDate: nextActionDate || undefined
      });
      if (!result.ok) {
        onError(result.error ?? "Could not record the disposition.");
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-muted p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Outcome" htmlFor={`disp-outcome-${appointmentId}`}>
          <select
            id={`disp-outcome-${appointmentId}`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className={selectClass}
          >
            {DISPOSITION_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next action date (optional)" htmlFor={`disp-date-${appointmentId}`}>
          <Input
            id={`disp-date-${appointmentId}`}
            type="date"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Next step (optional)" htmlFor={`disp-next-${appointmentId}`}>
        <Input
          id={`disp-next-${appointmentId}`}
          placeholder="e.g. Review post-op in 1 week"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
        />
      </Field>
      <Field label="Notes (optional)" htmlFor={`disp-notes-${appointmentId}`}>
        <textarea
          id={`disp-notes-${appointmentId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Visit notes…"
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <CheckCircle2 className="size-3.5" /> {saving ? "Saving…" : "Complete visit"}
        </Button>
      </div>
    </div>
  );
}

// ---- Timeline card ---------------------------------------------------------

function TimelineCard({ events }: { events: TimelineEvent[] }) {
  return (
    <Panel>
      <SectionTitle icon={<Activity className="size-4" />} title="Timeline" subtitle="Everything across this patient" />
      {events.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-5" />}
          title="Nothing yet"
          description="Interactions, appointments, documents and tasks will appear here."
        />
      ) : (
        <ol className="mt-4 space-y-0">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < events.length - 1 ? (
                <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" />
              ) : null}
              <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                <Activity className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{event.title}</p>
                  <span className="text-[11px] text-ink-faint">{formatDateTime(event.occurredAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{event.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ---- Add patient modal -----------------------------------------------------

function AddPatientModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("female");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function reset() {
    setName("");
    setAge("");
    setGender("female");
    setPhone("");
    setLanguage("English");
    setError(null);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a patient name.");
      return;
    }
    const parsedAge = age ? Number(age) : undefined;
    if (age && (Number.isNaN(parsedAge) || (parsedAge as number) < 0 || (parsedAge as number) > 130)) {
      setError("Enter a valid age between 0 and 130.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await createPatientAction({
        displayName: trimmed,
        age: parsedAge,
        gender,
        primaryPhone: phone,
        preferredLanguage: language
      });
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not create the patient.");
        return;
      }
      reset();
      onCreated(result.data.id);
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="add-patient-title" className="max-w-lg">
      <div className="border-b border-line p-5">
        <h2 id="add-patient-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <UserPlus className="size-4 text-brand-600" /> New patient
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Creates a record and opens their Patient 360.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Full name" htmlFor="np-name">
          <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Sharma" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" htmlFor="np-age">
            <Input id="np-age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="e.g. 54" />
          </Field>
          <Field label="Gender" htmlFor="np-gender">
            <select id="np-gender" value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unknown">Prefer not to say</option>
            </select>
          </Field>
        </div>
        <Field label="Phone" htmlFor="np-phone">
          <Input id="np-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91…" />
        </Field>
        <Field label="Preferred language" htmlFor="np-lang">
          <select id="np-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
            {["English", "Hindi", "Marathi", "Tamil", "Telugu", "Bengali", "Kannada"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          <UserPlus className="size-3.5" /> {saving ? "Adding…" : "Add patient"}
        </Button>
      </div>
    </Modal>
  );
}
