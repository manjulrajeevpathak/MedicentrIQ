"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { searchProceduresAction } from "@/app/staff/(app)/opd/actions";
import type { IntakeCondition, ProcedureCatalogEntry } from "@/lib/opd-types";

/**
 * Typeahead chip picker over the curated procedure catalog (GET
 * /clinical/procedures?q= via searchProceduresAction). Powers the
 * "Advise → Procedure / Admission" field on the OPD visit page. A chosen catalog
 * entry `{code,label}` is stored on the shared `IntakeCondition` shape — `code`
 * maps to `icd10Code` — so it round-trips through `adviseProcedureCodes`.
 *
 * When `disabled` (the "No procedure / admission required" checkbox is ticked)
 * the input is inert and existing chips are hidden; the parent clears the value.
 */
export function ProcedurePicker({
  value,
  onChange,
  disabled = false,
  placeholder
}: {
  value: IntakeCondition[];
  onChange: (next: IntakeCondition[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProcedureCatalogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startSearch] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  // Guards against out-of-order responses — only the latest keystroke wins.
  const reqId = useRef(0);

  // Debounced search-as-you-type (~200ms). Empty query still lists the catalog
  // on focus, so the doctor can browse without knowing a code.
  useEffect(() => {
    if (disabled) return;
    const handle = setTimeout(() => {
      const id = ++reqId.current;
      startSearch(async () => {
        const result = await searchProceduresAction(query.trim());
        if (id !== reqId.current) return;
        setResults(result.ok && result.data ? result.data : []);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, disabled]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function add(entry: ProcedureCatalogEntry) {
    if (!value.some((c) => c.icd10Code === entry.code)) {
      onChange([...value, { icd10Code: entry.code, label: entry.label }]);
    }
    setQuery("");
    setOpen(false);
  }

  function remove(code: string) {
    onChange(value.filter((c) => c.icd10Code !== code));
  }

  const suggestions = results.filter((r) => !value.some((c) => c.icd10Code === r.code)).slice(0, 8);

  return (
    <div>
      {!disabled && value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c.icd10Code}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-black/5"
            >
              <span className="font-mono text-[10px] text-brand-600">{c.icd10Code}</span>
              {c.label}
              <button
                type="button"
                onClick={() => remove(c.icd10Code)}
                className="rounded-full p-0.5 hover:bg-black/5"
                aria-label={`Remove ${c.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div ref={rootRef} className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder={placeholder ?? "Search a procedure — cataract, DCR, admission…"}
          autoComplete="off"
        />
        {searching ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
        ) : null}

        {!disabled && open && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface py-1 shadow-lg">
            {suggestions.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => add(r)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-surface-muted"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-[10px] text-brand-700">{r.code}</span>{" "}
                    <span>{r.label}</span>
                  </span>
                  {r.category ? <span className="shrink-0 text-[10px] text-ink-muted">{r.category}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : !disabled && open && query.trim() && !searching ? (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-line-strong bg-surface py-1 shadow-lg">
            <li className="px-3 py-1.5 text-[11px] text-ink-muted">No procedure matches “{query.trim()}”.</li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
