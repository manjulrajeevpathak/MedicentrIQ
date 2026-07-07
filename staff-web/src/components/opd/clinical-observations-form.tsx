"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2, Stethoscope, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { visitMeta, type Visit } from "@/lib/opd-types";
import {
  getDocumentUrlAction,
  updateVisitClinicalAction,
  uploadVisitDocumentAction,
  type VisitClinicalInput
} from "@/app/(app)/opd/actions";

const textareaClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

/**
 * Clinical observations — the single post-registration action on the OPD
 * register. Saving completes the visit (the backend derives the disposition and
 * fires workflows); "Save draft" (`complete: false`) parks the observations
 * without completing. For already-completed visits the same form edits in place.
 */
export function ClinicalObservationsForm({
  visit,
  onClose,
  onSaved
}: {
  /** Always non-null — the parent keys this component by visit id. */
  visit: Visit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const clinical = visit.clinical;
  const isCompleted = visit.status === "completed";

  const [chiefComplaints, setChiefComplaints] = useState(clinical?.chiefComplaints ?? visit.chiefComplaint ?? "");
  const [preExistingDiseases, setPreExistingDiseases] = useState(clinical?.preExistingDiseases ?? "");
  const [diagnosisText, setDiagnosisText] = useState(clinical?.diagnosisText ?? "");
  const [advisePharmacy, setAdvisePharmacy] = useState(clinical?.advisePharmacy ?? "");
  const [adviseDiagnostics, setAdviseDiagnostics] = useState(clinical?.adviseDiagnostics ?? "");
  const [adviseProcedureAdmission, setAdviseProcedureAdmission] = useState(clinical?.adviseProcedureAdmission ?? "");
  const [revisitAdvised, setRevisitAdvised] = useState(Boolean(clinical?.revisitAdvised));
  const [revisitDate, setRevisitDate] = useState(clinical?.revisitDate ?? "");

  // Prescriptions: already-attached ids come with the visit; new uploads collect
  // locally and ride along on the next save (the backend unions + dedupes).
  const attachedIds = clinical?.prescriptionDocumentIds ?? [];
  const [newDocs, setNewDocs] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

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
      const documentId = result.data.id;
      setNewDocs((prev) => [...prev, { id: documentId, name: file.name }]);
      if (fileRef.current) fileRef.current.value = "";
      toast("Prescription attached — it saves with the observations.", "success");
    });
  }

  /** asDraft → PATCH with complete:false; otherwise the backend completes the visit. */
  function save(asDraft: boolean) {
    if (revisitAdvised && !revisitDate) {
      setError("Pick the revisit date (or turn off Revisit Advised).");
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
      revisitAdvised,
      revisitDate: revisitAdvised ? revisitDate : "",
      ...(newDocs.length ? { prescriptionDocumentIds: newDocs.map((d) => d.id) } : {}),
      ...(asDraft ? { complete: false as const } : {})
    };
    startSaving(async () => {
      const result = await updateVisitClinicalAction(visit.id, input);
      if (!result.ok) {
        toast(result.error ?? "Could not save the observations.", "error");
        return;
      }
      if (asDraft) {
        toast("Draft saved — the visit stays registered.", "success");
      } else if (isCompleted) {
        toast("Observations updated.", "success");
      } else {
        toast("Visit completed — workflows (revisit reminders etc.) will follow the observations.", "success");
      }
      onSaved();
    });
  }

  const busy = saving || uploading;

  return (
    <Modal open onClose={onClose} labelledBy="opd-clinical-title" align="top" className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div>
          <h2 id="opd-clinical-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <Stethoscope className="size-4 text-brand-600" /> Clinical observations
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {visit.patientName ?? "Walk-in patient"}
            {visitMeta(visit) ? ` · ${visitMeta(visit)}` : ""}
            {visit.doctorName ? ` · ${visit.doctorName}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[68vh] space-y-5 overflow-y-auto p-5">
        {/* 1 — Chief Complaints */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Chief Complaints</p>
          <textarea
            value={chiefComplaints}
            onChange={(e) => setChiefComplaints(e.target.value)}
            rows={2}
            placeholder="What brings the patient in…"
            className={textareaClass}
          />
        </div>

        {/* 2 — Pre-existing Diseases */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Pre-existing Diseases</p>
          <textarea
            value={preExistingDiseases}
            onChange={(e) => setPreExistingDiseases(e.target.value)}
            rows={2}
            placeholder="Diabetes, hypertension, prior surgeries…"
            className={textareaClass}
          />
        </div>

        {/* 3 — Diagnosis */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Diagnosis</p>
          <textarea
            value={diagnosisText}
            onChange={(e) => setDiagnosisText(e.target.value)}
            rows={2}
            placeholder="Clinical diagnosis…"
            className={textareaClass}
          />
        </div>

        {/* 4 — Advise */}
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

        {/* 5 — Revisit Advised */}
        <div className="rounded-xl border border-line bg-surface-muted p-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={revisitAdvised}
              onChange={(e) => setRevisitAdvised(e.target.checked)}
              className="size-4 rounded border-line-strong text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-200"
            />
            <span className="font-medium">Revisit Advised</span>
          </label>
          {revisitAdvised ? (
            <div className="mt-3 max-w-56">
              <Field label="Revisit on" htmlFor="opd-clinical-revisit-date">
                <Input
                  id="opd-clinical-revisit-date"
                  type="date"
                  value={revisitDate}
                  onChange={(e) => setRevisitDate(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {/* 6 — Upload prescription */}
        <div className="rounded-xl border border-line p-3.5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <FileText className="size-3.5 text-ink-faint" /> Upload prescription
            {attachedCount > 0 ? (
              <span className="rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">{attachedCount}</span>
            ) : null}
          </p>

          {attachedCount > 0 ? (
            <ul className="mb-3 space-y-1.5">
              {attachedIds.map((id, i) => (
                <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-ink-soft">
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
                <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-700">
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

      <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
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
    </Modal>
  );
}
