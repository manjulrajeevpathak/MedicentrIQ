"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  FileText,
  Flag,
  HeartPulse,
  Loader2,
  Phone,
  Pill,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Upload,
  X
} from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ConditionPicker } from "@/components/opd/condition-picker";
import { ProcedurePicker } from "@/components/opd/procedure-picker";
import {
  codeConditionsAction,
  extractPrescriptionAction,
  getDocumentUrlAction,
  updateVisitClinicalAction,
  uploadVisitDocumentAction,
  type VisitClinicalInput
} from "@/app/(app)/opd/actions";
import {
  VISIT_OUTCOME_OPTIONS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONE,
  formatDateTime,
  type IntakeCondition,
  type Visit,
  type VisitOutcome
} from "@/lib/opd-types";
import type { PatientDetail } from "@/lib/patients-types";

const textareaClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";
const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

/**
 * The OPD visit's OWN page — everything about this encounter in one place
 * (the register links here; the full Patient 360 is a secondary link, not the
 * default destination). The clinical observations are captured INLINE below,
 * not in a modal.
 */
export function OpdVisitDetail({ visit, patient }: { visit: Visit; patient: PatientDetail | null }) {
  const meta = [
    patient?.age != null ? `${patient.age}y` : null,
    patient?.gender && patient.gender !== "unknown" ? patient.gender : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/opd"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> OPD register
        </Link>
        <Link
          href={`/patients/${visit.patientId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
        >
          Patient 360 <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* Visit header */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-ink">
                {visit.patientName ?? patient?.displayName ?? "Walk-in patient"}
              </h1>
              <Badge tone={VISIT_STATUS_TONE[visit.status] ?? "neutral"} dot>
                {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
              {meta ? <span>{meta}</span> : null}
              {patient?.primaryPhone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {patient.primaryPhone}
                </span>
              ) : null}
              <span>· Registered {formatDateTime(visit.registeredAt ?? visit.createdAt)}</span>
              {visit.doctorName || visit.department ? (
                <span>· {[visit.doctorName, visit.department].filter(Boolean).join(" — ")}</span>
              ) : null}
            </p>
          </div>
        </div>
      </Panel>

      {/* Vitals (when captured at registration) */}
      {visit.vitals && Object.values(visit.vitals).some((v) => v !== undefined && v !== "") ? (
        <Panel>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Vitals at registration</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            {Object.entries(visit.vitals)
              .filter(([, v]) => v !== undefined && v !== "")
              .map(([k, v]) => (
                <span key={k}>
                  <span className="text-ink-faint">{vitalsLabel(k)}:</span> {String(v)}
                </span>
              ))}
          </div>
        </Panel>
      ) : null}

      {/* Inline clinical observations — the founder's #1: no popup. */}
      <InlineClinicalObservations key={visit.id} visit={visit} />
    </div>
  );
}

// ---- Inline clinical observations form -------------------------------------

/**
 * A guided-consult section: numbered pill + bold title + one-line helper, in its
 * own bordered block. Replaces the old micro-uppercase labels so the form reads
 * top-to-bottom as distinct, scannable steps (founder feedback: headers were
 * confusing).
 */
function Section({
  n,
  title,
  helper,
  icon,
  children
}: {
  n: number;
  title: string;
  helper: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <header className="mb-3.5 flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ink">
            {icon}
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">{helper}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Readable inline field label (not micro-uppercase). */
function NoteLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-ink-soft">{children}</p>;
}

/**
 * "Accept the notes → auto-fill ICD-10." Sends the field's free-text note to the
 * AI coder and merges the returned codes into that field's chips (de-duped). Sits
 * under each coded section's notes; disabled when the note is empty or busy.
 */
function CodeFromNotesButton({
  text,
  kind,
  value,
  onChange,
  disabled
}: {
  text: string;
  kind: "symptom" | "comorbidity" | "diagnosis";
  value: IntakeCondition[];
  onChange: (next: IntakeCondition[]) => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [coding, startCoding] = useTransition();
  const empty = text.trim().length === 0;

  function run() {
    startCoding(async () => {
      const result = await codeConditionsAction(text, kind);
      if (!result.ok) {
        toast(result.error ?? "Could not code the notes.", "error");
        return;
      }
      const suggestions = result.data ?? [];
      if (suggestions.length === 0) {
        toast("No ICD-10 match found in the notes.", "info");
        return;
      }
      const existing = new Set(value.map((c) => c.icd10Code));
      const added = suggestions.filter((c) => !existing.has(c.icd10Code));
      if (added.length === 0) {
        toast("Those codes are already added.", "info");
        return;
      }
      onChange([...value, ...added]);
      toast(`Added ${added.length} ICD-10 code${added.length === 1 ? "" : "s"} — review before saving.`, "success");
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || coding || empty}
      title={empty ? "Add a note first, then code it" : "Read the note above and add matching ICD-10 codes"}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {coding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-brand-600" />}
      {coding ? "Coding…" : "Auto-code from notes"}
    </button>
  );
}

function InlineClinicalObservations({ visit }: { visit: Visit }) {
  const router = useRouter();
  const { toast } = useToast();
  const clinical = visit.clinical;
  const isCompleted = visit.status === "completed";

  // Outcome — the key field that completes the visit.
  const [outcome, setOutcome] = useState<VisitOutcome | "">(clinical?.outcome ?? "");

  // Chief complaints (coded + free text).
  const [chiefComplaintCodes, setChiefComplaintCodes] = useState<IntakeCondition[]>(
    clinical?.chiefComplaintCodes ?? []
  );
  const [chiefComplaints, setChiefComplaints] = useState(clinical?.chiefComplaints ?? visit.chiefComplaint ?? "");

  // Pre-existing diseases (coded + free text).
  const [preExistingCodes, setPreExistingCodes] = useState<IntakeCondition[]>(clinical?.preExistingCodes ?? []);
  const [preExistingDiseases, setPreExistingDiseases] = useState(clinical?.preExistingDiseases ?? "");

  // Diagnosis (coded → Visit.diagnosis + free text).
  const [diagnosisCodes, setDiagnosisCodes] = useState<IntakeCondition[]>(visit.diagnosis ?? []);
  const [diagnosisText, setDiagnosisText] = useState(clinical?.diagnosisText ?? "");

  // Advise.
  const [advisePharmacy, setAdvisePharmacy] = useState(clinical?.advisePharmacy ?? "");
  const [adviseDiagnostics, setAdviseDiagnostics] = useState(clinical?.adviseDiagnostics ?? "");
  const [adviseProcedureAdmission, setAdviseProcedureAdmission] = useState(clinical?.adviseProcedureAdmission ?? "");
  // Coded procedures advised (picker chips → adviseProcedureCodes).
  const [adviseProcedureCodes, setAdviseProcedureCodes] = useState<IntakeCondition[]>(
    clinical?.adviseProcedureCodes ?? []
  );
  // "No procedure / admission required" — inferred when the free-text is exactly
  // "None" with no coded procedures.
  const [noProcedure, setNoProcedure] = useState(
    (clinical?.adviseProcedureAdmission ?? "") === "None" && (clinical?.adviseProcedureCodes ?? []).length === 0
  );

  // Revisit.
  const [revisitAdvised, setRevisitAdvised] = useState(Boolean(clinical?.revisitAdvised));
  const [revisitDate, setRevisitDate] = useState(clinical?.revisitDate ?? "");

  // Picking "Revisit advised" as the outcome implies a revisit.
  useEffect(() => {
    if (outcome === "revisit_advised") setRevisitAdvised(true);
  }, [outcome]);

  // Prescriptions: attached ids come with the visit; new uploads collect locally
  // and ride along on the next save (the backend unions + dedupes).
  const attachedIds = clinical?.prescriptionDocumentIds ?? [];
  const [newDocs, setNewDocs] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  // AI prescription extraction.
  const [extracting, startExtract] = useTransition();
  const [aiPrefilled, setAiPrefilled] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const busy = saving || uploading || extracting;
  const attachedCount = attachedIds.length + newDocs.length;

  /** Toggle the "Not required" (no procedure) checkbox. */
  function toggleNoProcedure(next: boolean) {
    setNoProcedure(next);
    if (next) {
      setAdviseProcedureCodes([]);
      setAdviseProcedureAdmission("None");
      // Surgery is a procedure — drop the outcome if it was surgery.
      if (outcome === "surgery_advised") setOutcome("");
    } else if (adviseProcedureAdmission === "None") {
      setAdviseProcedureAdmission("");
    }
  }

  async function viewDocument(id: string) {
    const result = await getDocumentUrlAction(id);
    if (!result.ok || !result.data) {
      toast(result.error ?? "Could not open the prescription.", "error");
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("Choose a prescription file (image or PDF) to upload.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("patientId", visit.patientId);
    fd.set("visitId", visit.id);
    fd.set("type", "prescription");
    fd.set("file", file);
    startUpload(async () => {
      const result = await uploadVisitDocumentAction(fd);
      if (!result.ok || !result.data) {
        toast(result.error ?? "Could not upload the prescription.", "error");
        return;
      }
      const docId = result.data.id;
      setNewDocs((prev) => [...prev, { id: docId, name: file.name }]);
      if (fileRef.current) fileRef.current.value = "";
      toast("Prescription attached — reading it with AI…", "success");
      // Auto-read + pre-fill (its own transition → distinct "Reading…" state).
      startExtract(() => runExtract(docId));
    });
  }

  /**
   * Read the latest prescription with AI vision and pre-fill the free-text fields
   * (never the ICD chips — OCR gives text; the doctor codes it). Nothing is saved
   * server-side; the doctor reviews, then submits. Runs automatically right after
   * an upload; `docId` targets the just-uploaded (still-unsaved) prescription.
   */
  async function runExtract(docId?: string) {
    const latestDocId = docId ?? newDocs.at(-1)?.id ?? attachedIds.at(-1);
    if (!latestDocId) return;
    const result = await extractPrescriptionAction(visit.id, latestDocId);
    if (!result.ok || !result.data) {
      // Non-fatal — the prescription is attached; the AI read may be unavailable.
      toast(result.error ?? "Attached, but couldn't auto-read it — fill the fields manually.", "error");
      return;
    }
    const x = result.data;
    // Overwrite only the fields the extract returned non-empty; keep the rest.
    if (x.chiefComplaints) setChiefComplaints(x.chiefComplaints);
    if (x.preExistingDiseases) setPreExistingDiseases(x.preExistingDiseases);
    if (x.diagnosisText) setDiagnosisText(x.diagnosisText);
    if (x.advisePharmacy) setAdvisePharmacy(x.advisePharmacy);
    if (x.adviseDiagnostics) setAdviseDiagnostics(x.adviseDiagnostics);
    if (x.adviseProcedureAdmission) {
      setNoProcedure(false);
      setAdviseProcedureAdmission(x.adviseProcedureAdmission);
    }
    if (x.suggestedOutcome) setOutcome(x.suggestedOutcome);
    setRevisitAdvised(x.revisitAdvised);
    if (x.revisitDate) setRevisitDate(x.revisitDate);
    setAiPrefilled(true);
    setError(null);
    toast("Pre-filled from prescription — review and submit.", "success");
  }

  /** asDraft → PATCH with complete:false; otherwise the backend completes the visit. */
  function save(asDraft: boolean) {
    if (!asDraft && !outcome) {
      setError("Pick the visit outcome to complete this visit.");
      return;
    }
    if (revisitAdvised && !revisitDate) {
      setError("Pick the revisit date (or turn off Revisit advised).");
      return;
    }
    setError(null);
    const input: VisitClinicalInput = {
      chiefComplaints,
      preExistingDiseases,
      diagnosisText,
      advisePharmacy,
      adviseDiagnostics,
      adviseProcedureAdmission: noProcedure ? "None" : adviseProcedureAdmission,
      adviseProcedureCodes: noProcedure ? [] : adviseProcedureCodes,
      chiefComplaintCodes,
      preExistingCodes,
      diagnosis: diagnosisCodes,
      revisitAdvised,
      revisitDate: revisitAdvised ? revisitDate : "",
      ...(outcome ? { outcome } : {}),
      ...(newDocs.length ? { prescriptionDocumentIds: newDocs.map((d) => d.id) } : {}),
      ...(asDraft ? { complete: false as const } : {})
    };
    startSaving(async () => {
      const result = await updateVisitClinicalAction(visit.id, input);
      if (!result.ok) {
        toast(result.error ?? "Could not save the observations.", "error");
        return;
      }
      // Attached docs are now persisted on the visit — clear the local buffer so
      // the refreshed props don't double-list them.
      setNewDocs([]);
      setAiPrefilled(false);
      if (asDraft) {
        toast("Draft saved — the visit stays registered.", "success");
      } else if (isCompleted) {
        toast("Observations updated.", "success");
      } else {
        toast("Visit completed — workflows (revisit reminders etc.) will follow the observations.", "success");
      }
      // The server component re-renders with the updated visit.
      router.refresh();
    });
  }

  return (
    <Panel className="p-0">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-brand-600" />
          <h2 className="text-sm font-semibold tracking-tight text-ink">Clinical observations</h2>
        </div>

        {/* AI pre-fill banner */}
        {aiPrefilled ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="flex-1 text-xs text-ink-soft">
              These fields were pre-filled by AI from the prescription — please review and edit before submitting.
            </p>
            <button
              type="button"
              onClick={() => setAiPrefilled(false)}
              className="rounded-full p-0.5 text-ink-muted hover:bg-black/5 hover:text-ink"
              aria-label="Dismiss AI pre-fill notice"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        {/* 1 — Prescription (first: upload + AI extract) */}
        <Section
          n={1}
          title="Prescription"
          helper="Attach the written prescription, then let AI pre-fill the fields below."
          icon={<FileText className="size-3.5 text-brand-600" />}
        >
          {attachedCount > 0 ? (
            <ul className="mb-3 space-y-1.5">
              {attachedIds.map((id, i) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-ink-soft"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <FileText className="size-3.5 shrink-0 text-ink-faint" /> Prescription {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => viewDocument(id)}
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline"
                  >
                    View <ExternalLink className="size-3" />
                  </button>
                </li>
              ))}
              {newDocs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-700"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <FileText className="size-3.5 shrink-0" /> <span className="truncate">{doc.name}</span>
                    <span className="shrink-0 text-[10px] font-medium">new</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => viewDocument(doc.id)}
                    className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline"
                  >
                    View <ExternalLink className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              aria-label="Prescription file"
              className="flex-1 text-xs text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <Button variant="secondary" onClick={upload} disabled={busy}>
              {uploading || extracting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? "Uploading…" : extracting ? "Reading prescription…" : "Upload & pre-fill"}
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Sparkles className="size-3 text-brand-600" />
              On upload, AI reads the prescription and pre-fills the notes below for your review.
            </p>
            {attachedCount > 0 ? (
              <button
                type="button"
                onClick={() => startExtract(() => runExtract())}
                disabled={busy}
                title="Read the latest prescription again and re-fill the notes below"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extracting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {extracting ? "Reading…" : "Re-read with AI"}
              </button>
            ) : null}
          </div>
        </Section>

        {/* 2 — Chief Complaints */}
        <Section
          n={2}
          title="Chief Complaints"
          helper="What brings the patient in — code it and add a note."
          icon={<ClipboardList className="size-3.5 text-brand-600" />}
        >
          <ConditionPicker
            label="ICD-10 codes"
            value={chiefComplaintCodes}
            onChange={setChiefComplaintCodes}
            placeholder="Search a symptom — ICD-10 code or name…"
          />
          <div className="mt-2">
            <NoteLabel>Notes</NoteLabel>
            <textarea
              value={chiefComplaints}
              onChange={(e) => setChiefComplaints(e.target.value)}
              rows={2}
              placeholder="Free-text note — what brings the patient in…"
              className={textareaClass}
            />
            <CodeFromNotesButton
              text={chiefComplaints}
              kind="symptom"
              value={chiefComplaintCodes}
              onChange={setChiefComplaintCodes}
              disabled={busy}
            />
          </div>
        </Section>

        {/* 3 — Pre-existing Diseases */}
        <Section
          n={3}
          title="Pre-existing Diseases"
          helper="Known comorbidities and prior history."
          icon={<HeartPulse className="size-3.5 text-brand-600" />}
        >
          <ConditionPicker
            label="ICD-10 codes"
            value={preExistingCodes}
            onChange={setPreExistingCodes}
            placeholder="Search a comorbidity — ICD-10 code or name…"
          />
          <div className="mt-2">
            <NoteLabel>Notes</NoteLabel>
            <textarea
              value={preExistingDiseases}
              onChange={(e) => setPreExistingDiseases(e.target.value)}
              rows={2}
              placeholder="Free-text note — diabetes, hypertension, prior surgeries…"
              className={textareaClass}
            />
            <CodeFromNotesButton
              text={preExistingDiseases}
              kind="comorbidity"
              value={preExistingCodes}
              onChange={setPreExistingCodes}
              disabled={busy}
            />
          </div>
        </Section>

        {/* 4 — Diagnosis */}
        <Section
          n={4}
          title="Diagnosis"
          helper="The clinical diagnosis for this encounter."
          icon={<Stethoscope className="size-3.5 text-brand-600" />}
        >
          <ConditionPicker
            label="ICD-10 codes"
            value={diagnosisCodes}
            onChange={setDiagnosisCodes}
            placeholder="Search a diagnosis — ICD-10 code or name…"
          />
          <div className="mt-2">
            <NoteLabel>Notes</NoteLabel>
            <textarea
              value={diagnosisText}
              onChange={(e) => setDiagnosisText(e.target.value)}
              rows={2}
              placeholder="Free-text note — clinical diagnosis…"
              className={textareaClass}
            />
            <CodeFromNotesButton
              text={diagnosisText}
              kind="diagnosis"
              value={diagnosisCodes}
              onChange={setDiagnosisCodes}
              disabled={busy}
            />
          </div>
        </Section>

        {/* 5 — Advise */}
        <Section
          n={5}
          title="Advise"
          helper="What the patient should do next — pharmacy, diagnostics, procedure."
          icon={<Pill className="size-3.5 text-brand-600" />}
        >
          <div className="space-y-3.5">
            <div>
              <NoteLabel>Pharmacy</NoteLabel>
              <textarea
                value={advisePharmacy}
                onChange={(e) => setAdvisePharmacy(e.target.value)}
                rows={2}
                placeholder="Medicines advised…"
                className={textareaClass}
              />
            </div>
            <div>
              <NoteLabel>Diagnostics</NoteLabel>
              <textarea
                value={adviseDiagnostics}
                onChange={(e) => setAdviseDiagnostics(e.target.value)}
                rows={2}
                placeholder="Tests / scans advised…"
                className={textareaClass}
              />
            </div>
            <div className="rounded-lg border border-line bg-surface-muted/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <NoteLabel>Procedure</NoteLabel>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={noProcedure}
                    onChange={(e) => toggleNoProcedure(e.target.checked)}
                    className="size-4 rounded border-line-strong text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200"
                  />
                  <span className="font-medium">Not required</span>
                </label>
              </div>
              {noProcedure ? (
                <p className="text-xs text-ink-muted">No procedure advised.</p>
              ) : (
                <>
                  <ProcedurePicker
                    value={adviseProcedureCodes}
                    onChange={setAdviseProcedureCodes}
                    placeholder="Search a procedure — cataract, DCR, trabeculectomy…"
                  />
                  <input
                    type="text"
                    value={adviseProcedureAdmission}
                    onChange={(e) => setAdviseProcedureAdmission(e.target.value)}
                    placeholder="Extra detail — laterality, urgency, prep…"
                    className="mt-2.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                  />
                </>
              )}
            </div>
          </div>
        </Section>

        {/* 6 — Outcome & Revisit */}
        <Section
          n={6}
          title="Outcome & Revisit"
          helper="The visit outcome (required to complete) drives revisit reminders and campaigns."
          icon={<Flag className="size-3.5 text-brand-600" />}
        >
          <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
            <Field label="Outcome" htmlFor="clinical-outcome" hint="Required to complete the visit.">
              <select
                id="clinical-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as VisitOutcome | "")}
                className={selectClass}
              >
                <option value="">Select an outcome…</option>
                {VISIT_OUTCOME_OPTIONS.filter((o) => !(noProcedure && o.value === "surgery_advised")).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={revisitAdvised}
              onChange={(e) => setRevisitAdvised(e.target.checked)}
              className="size-4 rounded border-line-strong text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200"
            />
            <span className="font-medium">Revisit advised</span>
          </label>
          {revisitAdvised ? (
            <div className="mt-3 max-w-56">
              <Field label="Revisit on" htmlFor="clinical-revisit-date">
                <Input
                  id="clinical-revisit-date"
                  type="date"
                  value={revisitDate}
                  onChange={(e) => setRevisitDate(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </Section>

        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-[var(--radius-card)] border-t border-line bg-surface/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        {!isCompleted ? (
          <Button variant="subtle" onClick={() => save(true)} disabled={busy}>
            Save draft
          </Button>
        ) : null}
        <Button onClick={() => save(false)} disabled={busy}>
          {aiPrefilled ? <Sparkles className="size-3.5" /> : <Stethoscope className="size-3.5" />}
          {saving
            ? "Saving…"
            : aiPrefilled
              ? "Validate & submit"
              : isCompleted
                ? "Save observations"
                : "Save & complete visit"}
        </Button>
      </div>
    </Panel>
  );
}

function vitalsLabel(key: string): string {
  const labels: Record<string, string> = {
    bp: "BP",
    pulseBpm: "Pulse",
    spo2: "SpO₂",
    tempC: "Temp °C",
    weightKg: "Weight kg",
    visualAcuityRight: "VA (R)",
    visualAcuityLeft: "VA (L)",
    iopRight: "IOP (R)",
    iopLeft: "IOP (L)"
  };
  return labels[key] ?? key;
}
