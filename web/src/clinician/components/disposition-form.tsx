"use client";

import { useActionState } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { dispositionAction, type ActionResult } from "@/app/clinician/actions";
import { DISPOSITION_OUTCOMES, type Appointment } from "@clinician/lib/types";
import { formatDateTime, titleCase } from "@clinician/lib/utils";

export function DispositionForm({
  patientId,
  appointment
}: {
  patientId: string;
  appointment: Appointment | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(dispositionAction, {});

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="h-4.5 w-4.5 text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Visit disposition</h2>
      </div>

      {!appointment ? (
        <p className="text-sm text-ink-muted">No appointment found to record a disposition against.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-muted">
            For visit on {formatDateTime(appointment.startsAt)}
            {appointment.status ? ` · ${titleCase(appointment.status)}` : ""}
          </p>

          {state.ok ? (
            <div className="flex items-center gap-2 rounded-xl bg-good-soft px-3 py-3 text-sm font-medium text-good">
              <CheckCircle2 className="h-5 w-5" />
              Disposition recorded.
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="patientId" value={patientId} />
              <input type="hidden" name="appointmentId" value={appointment.id} />

              <div>
                <label htmlFor="outcome" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Outcome
                </label>
                <select
                  id="outcome"
                  name="outcome"
                  defaultValue=""
                  required
                  className="tap w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                >
                  <option value="" disabled>
                    Select an outcome…
                  </option>
                  {DISPOSITION_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Clinical notes for this visit"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                />
              </div>

              <div>
                <label htmlFor="nextStep" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Next step
                </label>
                <input
                  id="nextStep"
                  name="nextStep"
                  type="text"
                  placeholder="e.g. Review in 2 weeks"
                  className="tap w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {state.error ? <p className="text-sm text-critical">{state.error}</p> : null}

              <button
                type="submit"
                disabled={pending}
                className="tap w-full rounded-xl bg-brand-600 text-[15px] font-semibold text-white active:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Record disposition"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
