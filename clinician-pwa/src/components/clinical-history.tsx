"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { AlertTriangle, Check, Plus, Stethoscope } from "lucide-react";
import { addConditionAction, type ActionResult } from "@/app/actions";
import type { ClinicalRecord, ConditionOption } from "@/lib/types";

export function ClinicalHistory({
  patientId,
  clinical
}: {
  patientId: string;
  clinical: ClinicalRecord;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Stethoscope className="h-4.5 w-4.5 text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Clinical history</h2>
      </div>

      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Conditions</h3>
      {clinical.conditions.length === 0 ? (
        <p className="mb-3 text-sm text-ink-muted">No conditions recorded.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {clinical.conditions.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
            >
              <span className="text-sm text-ink">{c.label}</span>
              <span className="shrink-0 rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-ink-soft">
                {c.code}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Allergies</h3>
      {clinical.allergies.length === 0 ? (
        <p className="mb-3 text-sm text-ink-muted">No known allergies.</p>
      ) : (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {clinical.allergies.map((a, i) => (
            <li
              key={`${a.label}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-high-soft px-2.5 py-1 text-xs font-medium text-high"
            >
              <AlertTriangle className="h-3 w-3" />
              {a.label}
              {a.severity ? <span className="opacity-70">· {a.severity}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <AddConditionForm patientId={patientId} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-sm font-medium text-brand-700 active:bg-brand-50"
        >
          <Plus className="h-4 w-4" />
          Add condition
        </button>
      )}
    </section>
  );
}

function AddConditionForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(addConditionAction, {});
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ConditionOption[]>([]);
  const [selected, setSelected] = useState<ConditionOption | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On a successful append, collapse the form.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  useEffect(() => {
    if (selected) return; // don't re-search once a pick is locked in
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/conditions?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = (await res.json()) as { options?: ConditionOption[] };
        setOptions(data.options ?? []);
      } catch {
        setOptions([]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, selected]);

  return (
    <form action={formAction} className="mt-1 rounded-xl border border-line bg-surface-muted p-3">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="code" value={selected?.code ?? ""} />
      <input type="hidden" name="label" value={selected?.label ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
          <span className="text-sm text-ink">
            {selected.label} <span className="font-mono text-xs text-ink-muted">({selected.code})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="text-xs font-medium text-brand-700"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search ICD-10 conditions"
            aria-label="Search conditions"
            autoFocus
            className="tap w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          />
          {options.length > 0 ? (
            <ul className="mt-1.5 max-h-56 overflow-auto rounded-lg border border-line bg-surface shadow-lift">
              {options.map((o) => (
                <li key={o.code}>
                  <button
                    type="button"
                    onClick={() => setSelected(o)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm active:bg-surface-muted"
                  >
                    <span className="text-ink">{o.label}</span>
                    <span className="shrink-0 font-mono text-xs text-ink-muted">{o.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {state.error ? <p className="mt-2 text-sm text-critical">{state.error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="tap flex-1 rounded-xl border border-line text-sm font-medium text-ink-soft active:bg-fill"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!selected || pending}
          className="tap flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
