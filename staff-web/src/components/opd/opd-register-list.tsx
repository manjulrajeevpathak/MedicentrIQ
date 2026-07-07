"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Paintbrush, Stethoscope, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DISPOSITION_OUTCOMES,
  DISPOSITION_OUTCOME_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONE,
  formatDate,
  formatDateTime,
  visitMeta,
  type Visit,
  type VisitStatus
} from "@/lib/opd-types";

// ---- Row highlight rules -----------------------------------------------------
//
// Users mark the rows they care about (e.g. outcome "Surgery advised") with a
// colour. Rules are keyed `outcome:<value>` / `status:<value>` and kept in
// localStorage — a per-user presentation preference, not clinical data.

export type HighlightColor = "amber" | "red" | "blue" | "green" | "violet";
export type HighlightRules = Record<string, HighlightColor>;

const STORAGE_KEY = "opd:row-highlights";

/** Seed so the feature is discoverable: surgery-advised rows glow amber. */
const DEFAULT_RULES: HighlightRules = { "outcome:surgery_advised": "amber" };

const COLOR_OPTIONS: { value: HighlightColor; label: string; swatch: string }[] = [
  { value: "amber", label: "Amber", swatch: "bg-[var(--color-high)]" },
  { value: "red", label: "Red", swatch: "bg-[var(--color-critical)]" },
  { value: "blue", label: "Blue", swatch: "bg-[var(--color-medium)]" },
  { value: "green", label: "Green", swatch: "bg-[var(--color-good)]" },
  { value: "violet", label: "Violet", swatch: "bg-violet-500" }
];

const ROW_TINT: Record<HighlightColor, string> = {
  amber: "bg-[var(--color-high-soft)]",
  red: "bg-[var(--color-critical-soft)]",
  blue: "bg-[var(--color-medium-soft)]",
  green: "bg-[var(--color-good-soft)]",
  violet: "bg-violet-50 dark:bg-violet-500/15"
};

const ROW_EDGE: Record<HighlightColor, string> = {
  amber: "border-l-[var(--color-high)]",
  red: "border-l-[var(--color-critical)]",
  blue: "border-l-[var(--color-medium)]",
  green: "border-l-[var(--color-good)]",
  violet: "border-l-violet-500"
};

export function useRowHighlights() {
  const [rules, setRules] = useState<HighlightRules>(DEFAULT_RULES);

  // localStorage is browser-only — hydrate after mount to keep SSR markup stable.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRules(JSON.parse(raw) as HighlightRules);
    } catch {
      // Corrupt or blocked storage — fall back to defaults.
    }
  }, []);

  function setRule(key: string, color: HighlightColor | null) {
    setRules((prev) => {
      const next = { ...prev };
      if (color) next[key] = color;
      else delete next[key];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — highlights just won't survive a reload.
      }
      return next;
    });
  }

  return { rules, setRule };
}

function ruleFor(visit: Visit, rules: HighlightRules): HighlightColor | undefined {
  // Outcome is the more specific signal, so it wins over status.
  const outcome = visit.disposition?.outcome;
  if (outcome && rules[`outcome:${outcome}`]) return rules[`outcome:${outcome}`];
  return rules[`status:${visit.status}`];
}

// ---- Highlight menu ----------------------------------------------------------

export function HighlightMenu({
  rules,
  setRule
}: {
  rules: HighlightRules;
  setRule: (key: string, color: HighlightColor | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeCount = Object.keys(rules).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
          open || activeCount > 0
            ? "bg-brand-50 text-brand-700 ring-brand-200"
            : "bg-surface text-ink-soft ring-line-strong hover:bg-surface-muted"
        )}
      >
        <Paintbrush className="size-3.5" /> Highlight rows
        {activeCount > 0 ? (
          <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{activeCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-pop">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink">Row highlights</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Pick a colour for the visits you want to stand out.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-ink-faint hover:bg-surface-muted hover:text-ink"
              aria-label="Close highlight menu"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <HighlightGroup
            title="Outcome"
            items={DISPOSITION_OUTCOMES.map((o) => ({ key: `outcome:${o.value}`, label: o.label }))}
            rules={rules}
            setRule={setRule}
          />
          <HighlightGroup
            title="Status"
            items={(Object.keys(VISIT_STATUS_LABELS) as VisitStatus[])
              // No "start consult" step on the register — in_consult is legacy-only.
              .filter((s) => s !== "in_consult")
              .map((s) => ({
                key: `status:${s}`,
                label: VISIT_STATUS_LABELS[s]
              }))}
            rules={rules}
            setRule={setRule}
          />
        </div>
      ) : null}
    </div>
  );
}

function HighlightGroup({
  title,
  items,
  rules,
  setRule
}: {
  title: string;
  items: { key: string; label: string }[];
  rules: HighlightRules;
  setRule: (key: string, color: HighlightColor | null) => void;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = rules[item.key];
          return (
            <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-muted">
              <span className={cn("text-xs", active ? "font-medium text-ink" : "text-ink-soft")}>{item.label}</span>
              <span className="flex items-center gap-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setRule(item.key, active === c.value ? null : c.value)}
                    aria-label={`${active === c.value ? "Remove" : "Set"} ${c.label.toLowerCase()} highlight for ${item.label}`}
                    aria-pressed={active === c.value}
                    className={cn(
                      "size-4 rounded-full transition",
                      c.swatch,
                      active === c.value
                        ? "ring-2 ring-ink ring-offset-1 ring-offset-surface"
                        : "opacity-40 hover:opacity-100"
                    )}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Register list ---------------------------------------------------------
//
// The OPD register is a persisted list of visits — nothing leaves it. Rows are
// filterable by status/date-range/doctor upstream; the only action per row is
// capturing (or revisiting) the clinical observations.

/** Compact clinical summary for a completed row: diagnosis · revisit · Rx chip. */
function ClinicalSummary({ visit }: { visit: Visit }) {
  const clinical = visit.clinical;
  const rxCount = clinical?.prescriptionDocumentIds?.length ?? 0;
  const diagnosis = clinical?.diagnosisText?.trim();
  const revisitOn = clinical?.revisitAdvised && clinical.revisitDate ? formatDate(clinical.revisitDate) : null;

  if (!diagnosis && !revisitOn && rxCount === 0) {
    // Legacy completed rows may only carry a disposition — keep showing it.
    if (visit.disposition) {
      return (
        <span className="text-xs text-ink-soft">
          {DISPOSITION_OUTCOME_LABELS[visit.disposition.outcome] ?? visit.disposition.outcome}
        </span>
      );
    }
    return <span className="text-ink-faint">—</span>;
  }

  return (
    <span className="flex max-w-64 items-center gap-1.5 text-xs text-ink-soft">
      {diagnosis ? <span className="min-w-0 truncate" title={diagnosis}>{diagnosis}</span> : null}
      {revisitOn ? (
        <span className="shrink-0 whitespace-nowrap text-ink-muted">
          {diagnosis ? "· " : ""}Revisit {revisitOn}
        </span>
      ) : null}
      {rxCount > 0 ? (
        <Badge tone="brand" className="shrink-0 gap-1 px-2">
          <FileText className="size-3" /> Rx{rxCount > 1 ? ` ×${rxCount}` : ""}
        </Badge>
      ) : null}
    </span>
  );
}

export function OpdRegisterList({
  visits,
  rules,
  onObservations
}: {
  visits: Visit[];
  rules: HighlightRules;
  /** Open the clinical observations form for this visit (capture or edit). */
  onObservations: (visit: Visit) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-line bg-surface-muted text-left">
            <Th>Patient</Th>
            <Th>Chief complaint</Th>
            <Th>Doctor</Th>
            <Th>Registered</Th>
            <Th>Status</Th>
            <Th>Clinical summary</Th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visits.map((visit) => {
            const color = ruleFor(visit, rules);
            const meta = visitMeta(visit);
            const complaint = visit.clinical?.chiefComplaints?.trim() || visit.chiefComplaint?.trim();
            return (
              <tr key={visit.id} className={cn("transition", color ? ROW_TINT[color] : "hover:bg-surface-muted")}>
                <td className={cn("border-l-[3px] px-4 py-3", color ? ROW_EDGE[color] : "border-l-transparent")}>
                  <Link href={`/patients/${visit.patientId}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                    {visit.patientName ?? "Walk-in patient"}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-muted">{meta || "No details"}</p>
                </td>
                <td className="max-w-56 px-4 py-3">
                  {complaint ? (
                    <span className="line-clamp-2 text-ink-soft">{complaint}</span>
                  ) : (
                    <span className="italic text-ink-faint">Not captured yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {visit.doctorName ?? visit.department ?? "—"}
                  {visit.doctorName && visit.department ? (
                    <span className="block text-xs text-ink-muted">{visit.department}</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDateTime(visit.registeredAt ?? visit.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={VISIT_STATUS_TONE[visit.status] ?? "neutral"} dot>
                    {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {visit.status === "completed" ? <ClinicalSummary visit={visit} /> : <span className="text-ink-faint">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {visit.status === "completed" ? (
                    <Button size="sm" variant="outline" onClick={() => onObservations(visit)}>
                      <FileText className="size-3.5" /> View / edit observations
                    </Button>
                  ) : visit.status === "left_without_seen" ? (
                    <Link
                      href={`/patients/${visit.patientId}`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Open patient
                    </Link>
                  ) : (
                    // registered (and any legacy in_consult row) → capture observations.
                    <Button size="sm" onClick={() => onObservations(visit)}>
                      <Stethoscope className="size-3.5" /> Clinical observations
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</th>;
}
