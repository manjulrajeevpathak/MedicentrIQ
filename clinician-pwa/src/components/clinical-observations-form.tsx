"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, RefreshCw, Sparkles, Stethoscope } from "lucide-react";
import {
  extractPrescriptionAction,
  saveClinicalObjectAction,
  searchProceduresAction
} from "@/app/actions";
import { ConditionChips } from "@/components/condition-chips";
import { VISIT_OUTCOME_OPTIONS, type CodedCondition, type OpdVisit } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

/** A numbered, titled section block — clear visual separation on the consult form. */
function Section({
  n,
  title,
  hint,
  children
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {n}
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * OPD clinical observations — Rx-first: upload the prescription, optionally let AI
 * pre-fill the fields, then the doctor reviews/edits and completes the visit.
 * Fields are ordered Prescription → Complaints → Pre-existing → Diagnosis →
 * Advise → Outcome/Revisit. Controlled state so AI extraction can pre-fill.
 */
export function ClinicalObservationsForm({ patientId, visit }: { patientId: string; visit: OpdVisit }) {
  const router = useRouter();
  const c = visit.clinical;

  // Prescription (uploaded immediately so AI can read it before save).
  const [docs, setDocs] = useState<{ id: string; name: string }[]>(
    (c?.prescriptionDocumentIds ?? []).map((id, i) => ({ id, name: `Prescription ${i + 1}` }))
  );
  const [uploading, startUpload] = useTransition();
  const [extracting, startExtract] = useTransition();
  const [aiFilled, setAiFilled] = useState(false);

  // Coded + free-text fields (controlled).
  const [chiefCodes, setChiefCodes] = useState<CodedCondition[]>(c?.chiefComplaintCodes ?? []);
  const [chiefText, setChiefText] = useState(c?.chiefComplaints ?? visit.chiefComplaint ?? "");
  const [preCodes, setPreCodes] = useState<CodedCondition[]>(c?.preExistingCodes ?? []);
  const [preText, setPreText] = useState(c?.preExistingDiseases ?? "");
  const [dxCodes, setDxCodes] = useState<CodedCondition[]>(visit.diagnosis ?? []);
  const [dxText, setDxText] = useState(c?.diagnosisText ?? "");
  const [pharmacy, setPharmacy] = useState(c?.advisePharmacy ?? "");
  const [diagnostics, setDiagnostics] = useState(c?.adviseDiagnostics ?? "");
  const [procCodes, setProcCodes] = useState<CodedCondition[]>(c?.adviseProcedureCodes ?? []);
  const [procText, setProcText] = useState(c?.adviseProcedureAdmission ?? "");
  const [noProcedure, setNoProcedure] = useState(c?.adviseProcedureAdmission === "None");
  const [outcome, setOutcome] = useState(c?.outcome ?? "");
  const [revisit, setRevisit] = useState(Boolean(c?.revisitAdvised));
  const [revisitDate, setRevisitDate] = useState(c?.revisitDate ?? "");

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, startSaving] = useTransition();

  function upload(file: File) {
    startUpload(async () => {
      const fd = new FormData();
      fd.set("patientId", patientId);
      fd.set("file", file);
      const { uploadPrescriptionAction } = await import("@/app/actions");
      const res = await uploadPrescriptionAction({}, fd);
      if (!res.ok || !res.doc) {
        setError(res.error ?? "Upload failed.");
        return;
      }
      const doc = res.doc!;
      setDocs((prev) => [...prev, doc]);
      setError(null);
      // Auto-read + pre-fill (its own transition → distinct "Reading…" state).
      startExtract(() => runExtract(doc.id));
    });
  }

  // Reads the latest prescription with AI vision and pre-fills the free-text
  // fields; runs automatically right after an upload. `docId` targets the
  // just-uploaded prescription. Nothing is saved — the doctor reviews + submits.
  async function runExtract(docId?: string) {
    const targetId = docId ?? docs[docs.length - 1]?.id;
    if (!targetId) return;
    const res = await extractPrescriptionAction(visit.id, targetId);
    if (!res.ok || !res.data) {
      // Non-fatal — the prescription is attached; the AI read may be unavailable.
      setError(res.error ?? "Attached, but couldn't auto-read it — fill the fields manually.");
      return;
    }
    const d = res.data;
    // Pre-fill the free-text fields + outcome + revisit; the doctor adds ICD chips.
    if (d.chiefComplaints) setChiefText(d.chiefComplaints);
    if (d.preExistingDiseases) setPreText(d.preExistingDiseases);
    if (d.diagnosisText) setDxText(d.diagnosisText);
    if (d.advisePharmacy) setPharmacy(d.advisePharmacy);
    if (d.adviseDiagnostics) setDiagnostics(d.adviseDiagnostics);
    if (d.adviseProcedureAdmission) {
      setProcText(d.adviseProcedureAdmission);
      setNoProcedure(false);
    }
    if (d.suggestedOutcome) setOutcome(d.suggestedOutcome);
    if (d.revisitAdvised) setRevisit(true);
    if (d.revisitDate) setRevisitDate(d.revisitDate);
    setAiFilled(true);
    setError(null);
  }

  function save() {
    startSaving(async () => {
      const res = await saveClinicalObjectAction({
        patientId,
        visitId: visit.id,
        chiefComplaintCodes: chiefCodes,
        chiefComplaints: chiefText,
        preExistingCodes: preCodes,
        preExistingDiseases: preText,
        diagnosis: dxCodes,
        diagnosisText: dxText,
        advisePharmacy: pharmacy,
        adviseDiagnostics: diagnostics,
        adviseProcedureAdmission: noProcedure ? "None" : procText,
        adviseProcedureCodes: noProcedure ? [] : procCodes,
        outcome: outcome || undefined,
        revisitAdvised: revisit,
        revisitDate,
        prescriptionDocumentIds: docs.map((x) => x.id)
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <section className="surface-card p-4">
        <div className="flex items-center gap-2 rounded-xl bg-good-soft px-3 py-3 text-sm font-medium text-good">
          <CheckCircle2 className="h-5 w-5" /> Observations saved — visit completed.
        </div>
      </section>
    );
  }

  const busy = saving || uploading || extracting;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Stethoscope className="h-4.5 w-4.5 text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Clinical observations</h2>
        <span className="ml-auto text-xs text-ink-muted">
          Registered {formatDateTime(visit.registeredAt)}
        </span>
      </div>

      {aiFilled ? (
        <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pre-filled by AI from the prescription — please review and edit before submitting.</span>
        </div>
      ) : null}

      {/* 1. Prescription (first — the OCR source) */}
      <Section n={1} title="Prescription" hint="Upload the prescription — AI reads it and pre-fills the fields below for review.">
        {docs.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <li key={d.id} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-soft">
                {d.name}
              </li>
            ))}
          </ul>
        ) : null}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm font-medium text-ink-soft">
          <FileUp className="h-4 w-4" />{" "}
          {uploading ? "Uploading…" : extracting ? "Reading prescription…" : "Upload prescription (photo / PDF)"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={uploading || extracting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {docs.length > 0 ? (
          <button
            type="button"
            onClick={() => startExtract(() => runExtract())}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-line-strong px-3 py-2 text-sm font-medium text-ink-soft disabled:opacity-50"
          >
            {extracting ? <Sparkles className="h-4 w-4 animate-pulse" /> : <RefreshCw className="h-4 w-4" />}
            {extracting ? "Reading prescription…" : "Re-read with AI"}
          </button>
        ) : null}
      </Section>

      {/* 2. Chief Complaints */}
      <Section n={2} title="Chief Complaints" hint="Presenting symptoms.">
        <ConditionChips label="ICD-10 / symptom" value={chiefCodes} onChange={setChiefCodes} placeholder="Search symptom / ICD-10…" />
        <textarea rows={2} value={chiefText} onChange={(e) => setChiefText(e.target.value)} placeholder="Notes…" className={inputCls} />
      </Section>

      {/* 3. Pre-existing Diseases */}
      <Section n={3} title="Pre-existing Diseases" hint="Comorbidities / history.">
        <ConditionChips label="ICD-10 / comorbidity" value={preCodes} onChange={setPreCodes} placeholder="Search comorbidity / ICD-10…" />
        <textarea rows={2} value={preText} onChange={(e) => setPreText(e.target.value)} placeholder="Notes…" className={inputCls} />
      </Section>

      {/* 4. Diagnosis */}
      <Section n={4} title="Diagnosis" hint="Working / final diagnosis.">
        <ConditionChips label="ICD-10 / diagnosis" value={dxCodes} onChange={setDxCodes} placeholder="Search diagnosis / ICD-10…" />
        <textarea rows={2} value={dxText} onChange={(e) => setDxText(e.target.value)} placeholder="Notes…" className={inputCls} />
      </Section>

      {/* 5. Advise */}
      <Section n={5} title="Advise" hint="Pharmacy, diagnostics and any procedure / admission.">
        <div>
          <label className={labelCls}>Pharmacy</label>
          <textarea rows={2} value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} placeholder="Medicines advised…" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Diagnostics</label>
          <textarea rows={2} value={diagnostics} onChange={(e) => setDiagnostics(e.target.value)} placeholder="Tests / scans advised…" className={inputCls} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className={`${labelCls} mb-0`}>Procedure</label>
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={noProcedure}
                onChange={(e) => {
                  setNoProcedure(e.target.checked);
                  if (e.target.checked) {
                    setProcCodes([]);
                    // Surgery is a procedure — clear it if the outcome was surgery.
                    if (outcome === "surgery_advised") setOutcome("");
                  }
                }}
                className="h-4 w-4"
              />
              Not required
            </label>
          </div>
          {!noProcedure ? (
            <>
              <ConditionChips
                label=""
                value={procCodes}
                search={searchProceduresAction}
                onChange={setProcCodes}
                placeholder="Search procedure (e.g. phaco, trabeculectomy)…"
              />
              <input value={procText} onChange={(e) => setProcText(e.target.value)} placeholder="Extra detail (eye, timing)…" className={`${inputCls} mt-2`} />
            </>
          ) : (
            <p className="text-xs text-ink-muted">No procedure advised.</p>
          )}
        </div>
      </Section>

      {/* 6. Outcome & Revisit */}
      <Section n={6} title="Outcome & Revisit" hint="Used to re-engage the patient later (e.g. surgery advised).">
        <div>
          <label className={labelCls}>Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>
            <option value="">Select an outcome…</option>
            {VISIT_OUTCOME_OPTIONS.filter((o) => !(noProcedure && o.value === "surgery_advised")).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={revisit} onChange={(e) => setRevisit(e.target.checked)} className="h-4 w-4" /> Revisit advised
        </label>
        {revisit ? (
          <div>
            <label className={labelCls}>Revisit date</label>
            <input type="date" value={revisitDate} onChange={(e) => setRevisitDate(e.target.value)} className={inputCls} />
          </div>
        ) : null}
      </Section>

      {error ? (
        <p className="rounded-xl bg-critical-soft px-3 py-2 text-sm font-medium text-critical">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="sticky bottom-3 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
      >
        {saving ? "Saving…" : aiFilled ? "Validate & submit" : "Save & complete visit"}
      </button>
    </div>
  );
}
