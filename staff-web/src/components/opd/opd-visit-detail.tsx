"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Phone,
  Stethoscope,
  Upload
} from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ConditionPicker } from "@/components/opd/condition-picker";
import {
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

  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const busy = saving || uploading;
  const attachedCount = attachedIds.length + newDocs.length;

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
      setNewDocs((prev) => [...prev, { id: result.data!.id, name: file.name }]);
      if (fileRef.current) fileRef.current.value = "";
      toast("Prescription attached — it saves with the observations.", "success");
    });
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
      adviseProcedureAdmission,
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
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-brand-600" />
          <h2 className="text-sm font-semibold tracking-tight text-ink">Clinical observations</h2>
        </div>

        {/* 1 — Outcome (the key field) */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
          <Field
            label="Outcome"
            htmlFor="clinical-outcome"
            hint="The clinical outcome of this visit — required to complete it."
          >
            <select
              id="clinical-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as VisitOutcome | "")}
              className={selectClass}
            >
              <option value="">Select an outcome…</option>
              {VISIT_OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 2 — Chief Complaints */}
        <div className="space-y-2">
          <ConditionPicker
            label="Chief Complaints"
            value={chiefComplaintCodes}
            onChange={setChiefComplaintCodes}
            placeholder="Search a symptom — ICD-10 code or name…"
          />
          <textarea
            value={chiefComplaints}
            onChange={(e) => setChiefComplaints(e.target.value)}
            rows={2}
            placeholder="Free-text note — what brings the patient in…"
            className={textareaClass}
          />
        </div>

        {/* 3 — Pre-existing Diseases */}
        <div className="space-y-2">
          <ConditionPicker
            label="Pre-existing Diseases"
            value={preExistingCodes}
            onChange={setPreExistingCodes}
            placeholder="Search a comorbidity — ICD-10 code or name…"
          />
          <textarea
            value={preExistingDiseases}
            onChange={(e) => setPreExistingDiseases(e.target.value)}
            rows={2}
            placeholder="Free-text note — diabetes, hypertension, prior surgeries…"
            className={textareaClass}
          />
        </div>

        {/* 4 — Diagnosis */}
        <div className="space-y-2">
          <ConditionPicker
            label="Diagnosis"
            value={diagnosisCodes}
            onChange={setDiagnosisCodes}
            placeholder="Search a diagnosis — ICD-10 code or name…"
          />
          <textarea
            value={diagnosisText}
            onChange={(e) => setDiagnosisText(e.target.value)}
            rows={2}
            placeholder="Free-text note — clinical diagnosis…"
            className={textareaClass}
          />
        </div>

        {/* 5 — Advise */}
        <div className="rounded-xl border border-line p-3.5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Advise</p>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Pharmacy</p>
              <textarea
                value={advisePharmacy}
                onChange={(e) => setAdvisePharmacy(e.target.value)}
                rows={2}
                placeholder="Medicines advised…"
                className={textareaClass}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Diagnostics</p>
              <textarea
                value={adviseDiagnostics}
                onChange={(e) => setAdviseDiagnostics(e.target.value)}
                rows={2}
                placeholder="Tests / scans advised…"
                className={textareaClass}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Procedure / Admission</p>
              <textarea
                value={adviseProcedureAdmission}
                onChange={(e) => setAdviseProcedureAdmission(e.target.value)}
                rows={2}
                placeholder="Procedure or admission advised…"
                className={textareaClass}
              />
            </div>
          </div>
        </div>

        {/* 6 — Revisit */}
        <div className="rounded-xl border border-line bg-surface-muted p-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
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
        </div>

        {/* 7 — Prescriptions */}
        <div className="rounded-xl border border-line p-3.5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <FileText className="size-3.5 text-ink-faint" /> Prescriptions
            {attachedCount > 0 ? (
              <span className="rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">{attachedCount}</span>
            ) : null}
          </p>

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
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">Image or PDF. Upload as many as needed — they attach when you save.</p>
        </div>

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
          <Stethoscope className="size-3.5" />
          {saving ? "Saving…" : isCompleted ? "Save observations" : "Save & complete visit"}
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
