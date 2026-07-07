"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Stethoscope } from "lucide-react";
import { saveClinicalAction, type ActionResult } from "@/app/actions";
import type { OpdVisit } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-sm font-medium text-ink-soft";

/**
 * Clinical observations for the patient's OPEN OPD visit. Saving completes the
 * visit — there is no separate "start consult" step. Same structure as the
 * staff console's form: Chief Complaints → Pre-existing Diseases → Diagnosis →
 * Advise (Pharmacy / Diagnostics / Procedure-Admission) → Revisit → Prescription.
 */
export function ClinicalObservationsForm({
  patientId,
  visit
}: {
  patientId: string;
  visit: OpdVisit;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveClinicalAction, {});
  const [revisit, setRevisit] = useState(Boolean(visit.clinical?.revisitAdvised));

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Stethoscope className="h-4.5 w-4.5 text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Clinical observations</h2>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        OPD visit registered {formatDateTime(visit.registeredAt)}
        {visit.doctorName ? ` · ${visit.doctorName}` : ""} — saving completes the visit.
      </p>

      {state.ok ? (
        <div className="flex items-center gap-2 rounded-xl bg-good-soft px-3 py-3 text-sm font-medium text-good">
          <CheckCircle2 className="h-5 w-5" />
          Observations saved — visit completed.
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="visitId" value={visit.id} />

          <div>
            <label htmlFor="co-chief" className={labelCls}>Chief Complaints</label>
            <textarea
              id="co-chief"
              name="chiefComplaints"
              rows={2}
              defaultValue={visit.clinical?.chiefComplaints ?? visit.chiefComplaint ?? ""}
              placeholder="e.g. Blurred vision in right eye, 2 weeks"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="co-pre" className={labelCls}>Pre-existing Diseases</label>
            <textarea
              id="co-pre"
              name="preExistingDiseases"
              rows={2}
              defaultValue={visit.clinical?.preExistingDiseases ?? ""}
              placeholder="e.g. Type 2 diabetes (8 years), hypertension"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="co-dx" className={labelCls}>Diagnosis</label>
            <textarea
              id="co-dx"
              name="diagnosisText"
              rows={2}
              defaultValue={visit.clinical?.diagnosisText ?? ""}
              placeholder="e.g. Early cataract, right eye"
              className={inputCls}
            />
          </div>

          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-medium text-ink-soft">Advise</legend>
            <div className="flex flex-col gap-2.5">
              <div>
                <label htmlFor="co-rx" className={labelCls}>Pharmacy</label>
                <input
                  id="co-rx"
                  name="advisePharmacy"
                  defaultValue={visit.clinical?.advisePharmacy ?? ""}
                  placeholder="e.g. Lubricant eye drops BD × 4 weeks"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="co-diag" className={labelCls}>Diagnostics</label>
                <input
                  id="co-diag"
                  name="adviseDiagnostics"
                  defaultValue={visit.clinical?.adviseDiagnostics ?? ""}
                  placeholder="e.g. HbA1c, fasting sugar"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="co-proc" className={labelCls}>Procedure / Admission</label>
                <input
                  id="co-proc"
                  name="adviseProcedureAdmission"
                  defaultValue={visit.clinical?.adviseProcedureAdmission ?? ""}
                  placeholder="e.g. Phaco + IOL, left eye"
                  className={inputCls}
                />
              </div>
            </div>
          </fieldset>

          <div className="rounded-xl border border-line p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name="revisitAdvised"
                checked={revisit}
                onChange={(e) => setRevisit(e.target.checked)}
                className="h-4 w-4"
              />
              Revisit Advised
            </label>
            {revisit ? (
              <div className="mt-2.5">
                <label htmlFor="co-revisit" className={labelCls}>Revisit date</label>
                <input
                  id="co-revisit"
                  type="date"
                  name="revisitDate"
                  defaultValue={visit.clinical?.revisitDate ?? ""}
                  className={inputCls}
                />
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="co-file" className={labelCls}>
              Upload prescription
              {visit.clinical?.prescriptionDocumentIds?.length
                ? ` (${visit.clinical.prescriptionDocumentIds.length} attached)`
                : ""}
            </label>
            <input
              id="co-file"
              type="file"
              name="prescription"
              accept="image/*,application/pdf"
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Photo or PDF — we&rsquo;ll process it to auto-fill these fields in future.
            </p>
          </div>

          {state.error ? (
            <p className="rounded-xl bg-critical-soft px-3 py-2 text-sm font-medium text-critical">{state.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save & complete visit"}
          </button>
        </form>
      )}
    </section>
  );
}
