"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, UserRound } from "lucide-react";
import { StageChip } from "@clinician/components/badge";
import type { Patient } from "@clinician/lib/types";

export function PatientSearch({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.displayName ?? "").toLowerCase();
      const phone = (p.primaryPhone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [patients, query]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone"
          aria-label="Search patients"
          className="tap w-full rounded-xl border border-line bg-surface pl-10 pr-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-2 px-4 py-12 text-center">
          <UserRound className="h-8 w-8 text-ink-faint" />
          <p className="text-sm font-medium text-ink">
            {patients.length === 0 ? "No patients yet" : "No matches"}
          </p>
          <p className="text-xs text-ink-muted">
            {patients.length === 0
              ? "Patients added in the clinic will appear here."
              : "Try a different name or phone number."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/clinician/patients/${p.id}`}
                className="surface-card flex items-center gap-3 px-3.5 py-3 active:bg-surface-muted"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{p.displayName || "Unnamed patient"}</span>
                    <StageChip stage={p.lifecycleStage} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {[
                      p.age != null ? `${p.age}y` : null,
                      p.gender ? p.gender : null,
                      p.primaryPhone ? p.primaryPhone : null
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No details"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
