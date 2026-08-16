"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { searchConditionsAction } from "@/app/clinician/actions";
import type { CodedCondition } from "@clinician/lib/types";

// (default catalog search kept as the default `search` prop below)

/**
 * ICD-10 chip picker for the clinical form: type to search the catalog, tap a
 * result to add a coded chip. The selection is emitted as a JSON string in a
 * hidden input (named `name`) so it rides the surrounding <form> action.
 */
export function ConditionChips({
  label,
  value = [],
  placeholder = "Search ICD-10 or condition…",
  search = searchConditionsAction,
  onChange
}: {
  label: string;
  value?: CodedCondition[];
  placeholder?: string;
  /** Catalog search (defaults to ICD-10 conditions; pass a procedure search to reuse). */
  search?: (q: string) => Promise<{ icd10Code: string; label: string }[]>;
  /** Controlled: emit the selected chips to the parent. */
  onChange?: (chips: CodedCondition[]) => void;
}) {
  const [chips, setChipsState] = useState<CodedCondition[]>(value);
  const setChips = (next: CodedCondition[]) => {
    setChipsState(next);
    onChange?.(next);
  };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CodedCondition[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const found = await search(q);
      if (alive) {
        setResults(found.map((f) => ({ icd10Code: f.icd10Code, label: f.label })));
        setOpen(true);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const add = (c: CodedCondition) => {
    if (!chips.some((x) => x.icd10Code === c.icd10Code)) setChips([...chips, c]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };
  const remove = (code: string) => setChips(chips.filter((c) => c.icd10Code !== code));

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-ink-soft">{label}</label>

      {chips.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.icd10Code}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700"
            >
              {c.label}
              <span className="text-[10px] text-brand-500">{c.icd10Code}</span>
              <button type="button" onClick={() => remove(c.icd10Code)} aria-label={`Remove ${c.label}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
      />

      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
          {results.map((r) => (
            <li key={r.icd10Code}>
              <button
                type="button"
                onClick={() => add(r)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
              >
                <span className="min-w-0 truncate text-ink">{r.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                  {r.icd10Code} <Plus className="h-3 w-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
