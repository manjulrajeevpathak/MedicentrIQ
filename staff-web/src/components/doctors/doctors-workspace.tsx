"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Plus, Stethoscope, Trash2 } from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import {
  SLOT_MINUTE_OPTIONS,
  WEEKDAYS,
  type BranchOption,
  type Doctor,
  type ScheduleWindow,
  type WeeklyHours,
  type WeekdayIndex
} from "@/lib/scheduling-types";
import {
  createDoctorAction,
  setDoctorScheduleAction,
  updateDoctorAction
} from "@/app/(app)/doctors/actions";

/** Curated specialty suggestions, merged with specialties already in use. */
const DEFAULT_SPECIALTIES = [
  "Ophthalmology",
  "Optometry",
  "Cataract & IOL",
  "Glaucoma",
  "Retina",
  "Cornea",
  "Pediatric Ophthalmology",
  "Oculoplasty",
  "General Medicine",
  "ENT",
  "Dental"
];

type Props = {
  doctors: Doctor[];
  branches: BranchOption[];
};

export function DoctorsWorkspace({ doctors, branches }: Props) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const branchName = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, b.displayName]));
    return (id: string) => map.get(id) ?? id;
  }, [branches]);

  // Curated list augmented with specialties already in use (deduped, sorted).
  const specialtyOptions = useMemo(() => {
    const set = new Set(DEFAULT_SPECIALTIES);
    for (const d of doctors) {
      const s = d.specialty?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Doctors</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Add doctors, set specialties and manage weekly availability.
        </p>
      </div>

      <AddDoctorForm branches={branches} specialtyOptions={specialtyOptions} onToast={toast} />

      <Panel padded={false}>
        <div className="p-4 pb-3">
          <SectionTitle
            icon={<Stethoscope className="size-4" />}
            title="Doctors"
            subtitle={`${doctors.length} configured`}
          />
        </div>
        {doctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="size-5" />}
            title="No doctors yet"
            description="Add your first doctor above, then set their weekly schedule."
          />
        ) : (
          <ul className="divide-y divide-line">
            {doctors.map((doctor) => (
              <li key={doctor.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{doctor.displayName}</p>
                      <Badge tone={doctor.status === "active" ? "good" : "neutral"} dot className="capitalize">
                        {doctor.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {doctor.specialty ? `${doctor.specialty} · ` : ""}
                      {doctor.slotMinutes} min slots
                      {doctor.phone ? ` · ${doctor.phone}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {doctor.branchIds.length
                        ? doctor.branchIds.map(branchName).join(", ")
                        : "No branches assigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editingId === doctor.id ? null : doctor.id)}
                    >
                      {editingId === doctor.id ? "Close" : "Set schedule"}
                    </Button>
                    <Button
                      variant={doctor.status === "active" ? "subtle" : "secondary"}
                      size="sm"
                      onClick={async () => {
                        const next = doctor.status === "active" ? "inactive" : "active";
                        const result = await updateDoctorAction(doctor.id, { status: next });
                        toast(
                          result.ok
                            ? next === "active"
                              ? "Doctor reactivated."
                              : "Doctor deactivated."
                            : result.error ?? "Could not update the doctor.",
                          result.ok ? "success" : "error"
                        );
                      }}
                    >
                      {doctor.status === "active" ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>

                {editingId === doctor.id ? (
                  <ScheduleEditor doctor={doctor} onToast={toast} onSaved={() => setEditingId(null)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AddDoctorForm({
  branches,
  specialtyOptions,
  onToast
}: {
  branches: BranchOption[];
  specialtyOptions: string[];
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const displayName = String(fd.get("displayName") ?? "");
    const specialty = String(fd.get("specialty") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const slotMinutes = Number(fd.get("slotMinutes") ?? 20);
    const branchIds = fd.getAll("branchIds").map((b) => String(b));

    startTransition(async () => {
      const result = await createDoctorAction({
        displayName,
        specialty: specialty || undefined,
        phone: phone || undefined,
        slotMinutes,
        branchIds
      });
      if (!result.ok) {
        setError(result.error ?? "Could not add the doctor.");
        return;
      }
      form.reset();
      onToast("Doctor added.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<Plus className="size-4" />}
        title="Add doctor"
        subtitle="Create a doctor, then set their weekly schedule"
      />
      <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Name" htmlFor="dr-name">
            <Input id="dr-name" name="displayName" placeholder="Dr. Asha Rao" disabled={pending} required />
          </Field>
          <Field label="Specialty" htmlFor="dr-specialty">
            <Input
              id="dr-specialty"
              name="specialty"
              list="dr-specialty-options"
              placeholder="Ophthalmology"
              autoComplete="off"
              disabled={pending}
            />
            <datalist id="dr-specialty-options">
              {specialtyOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Phone" htmlFor="dr-phone">
            <Input id="dr-phone" name="phone" placeholder="+91…" disabled={pending} />
          </Field>
          <Field label="Slot length" htmlFor="dr-slot">
            <select
              id="dr-slot"
              name="slotMinutes"
              defaultValue={20}
              disabled={pending}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              {SLOT_MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset disabled={pending} className="space-y-1.5">
          <legend className="block text-xs font-medium text-ink-soft">Branches</legend>
          {branches.length === 0 ? (
            <p className="text-[11px] text-ink-muted">No branches available for this tenant.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input type="checkbox" name="branchIds" value={branch.id} className="size-3.5 accent-brand-600" />
                  {branch.displayName}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-critical)]/30 bg-[var(--color-critical-soft)] px-3 py-2 text-xs font-medium text-[var(--color-critical)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add doctor"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ScheduleEditor({
  doctor,
  onToast,
  onSaved
}: {
  doctor: Doctor;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
  onSaved: () => void;
}) {
  const [slotMinutes, setSlotMinutes] = useState(doctor.slotMinutes);
  const [hours, setHours] = useState<WeeklyHours>(() => normalizeWeekly(doctor.weeklyHours));
  const [pending, startTransition] = useTransition();

  function addWindow(day: WeekdayIndex) {
    setHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { start: "09:00", end: "17:00" }]
    }));
  }
  function removeWindow(day: WeekdayIndex, idx: number) {
    setHours((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).filter((_, i) => i !== idx)
    }));
  }
  function updateWindow(day: WeekdayIndex, idx: number, patch: Partial<ScheduleWindow>) {
    setHours((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((w, i) => (i === idx ? { ...w, ...patch } : w))
    }));
  }
  /** Copy one day's windows onto a set of target days (deep copy). */
  function copyWindowsTo(sourceDay: WeekdayIndex, targets: number[]) {
    setHours((prev) => {
      const src = (prev[sourceDay] ?? []).map((w) => ({ ...w }));
      const next = { ...prev };
      for (const d of targets) {
        if (d === sourceDay) continue;
        next[d as WeekdayIndex] = src.map((w) => ({ ...w }));
      }
      return next;
    });
  }
  /** Pull another day's windows into this (closed) day. */
  function copyWindowsFrom(targetDay: WeekdayIndex, sourceDay: WeekdayIndex) {
    setHours((prev) => ({ ...prev, [targetDay]: (prev[sourceDay] ?? []).map((w) => ({ ...w })) }));
  }
  /** "Copy to…" preset → target day indices (Sun=0 … Sat=6). */
  function applyCopyTo(sourceDay: WeekdayIndex, preset: string) {
    const targets = preset === "weekdays" ? [1, 2, 3, 4, 5] : preset === "weekend" ? [0, 6] : [0, 1, 2, 3, 4, 5, 6];
    copyWindowsTo(sourceDay, targets);
    onToast("Hours copied.", "success");
  }

  function save() {
    // Drop empty days so we send a clean weeklyHours map.
    const clean: WeeklyHours = {};
    for (const { index } of WEEKDAYS) {
      const windows = (hours[index] ?? []).filter((w) => w.start && w.end);
      if (windows.length) clean[String(index)] = windows;
    }
    startTransition(async () => {
      const result = await setDoctorScheduleAction(doctor.id, slotMinutes, clean);
      if (!result.ok) {
        onToast(result.error ?? "Could not save the schedule.", "error");
        return;
      }
      onToast("Schedule saved.", "success");
      onSaved();
    });
  }

  const daysWithWindows = WEEKDAYS.filter((d) => (hours[d.index] ?? []).length > 0);

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">Weekly schedule</p>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          Slot length
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            {SLOT_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {WEEKDAYS.map(({ index, label }) => {
          const windows = hours[index] ?? [];
          return (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <span className="mt-1.5 w-20 shrink-0 text-xs font-medium text-ink-soft">{label}</span>
              <div className="flex flex-1 flex-col gap-1.5">
                {windows.length === 0 ? (
                  <span className="mt-1 text-[11px] text-ink-faint">Closed</span>
                ) : (
                  windows.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindow(index, idx, { start: e.target.value })}
                        className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                      />
                      <span className="text-xs text-ink-muted">–</span>
                      <input
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindow(index, idx, { end: e.target.value })}
                        className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeWindow(index, idx)}
                        className="rounded p-1 text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
                        aria-label="Remove window"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => addWindow(index)}
                    className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    <Plus className="size-3" /> Add window
                  </button>
                  {windows.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyCopyTo(index, e.target.value);
                        e.target.value = "";
                      }}
                      aria-label={`Copy ${label} hours to other days`}
                      className="h-7 rounded-lg border border-line-strong bg-surface px-2 text-[11px] text-ink-soft focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    >
                      <option value="" disabled>
                        Copy to…
                      </option>
                      <option value="weekdays">All weekdays (Mon–Fri)</option>
                      <option value="weekend">Weekend (Sat–Sun)</option>
                      <option value="all">All days</option>
                    </select>
                  ) : daysWithWindows.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value !== "") {
                          copyWindowsFrom(index, Number(e.target.value) as WeekdayIndex);
                          onToast("Hours copied.", "success");
                        }
                        e.target.value = "";
                      }}
                      aria-label={`Copy hours from another day into ${label}`}
                      className="h-7 rounded-lg border border-line-strong bg-surface px-2 text-[11px] text-ink-soft focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    >
                      <option value="" disabled>
                        Copy from…
                      </option>
                      {daysWithWindows.map((d) => (
                        <option key={d.index} value={d.index}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          <CheckCircle2 className="size-3.5" /> {pending ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </div>
  );
}

/** Coerce a weeklyHours map (keys may be numbers or strings) into our shape. */
function normalizeWeekly(weekly: WeeklyHours | undefined): WeeklyHours {
  const out: WeeklyHours = {};
  if (!weekly) return out;
  for (const { index } of WEEKDAYS) {
    const windows = weekly[String(index)] ?? weekly[index as unknown as string];
    if (windows && windows.length) {
      out[index] = windows.map((w) => ({ start: w.start, end: w.end, branchId: w.branchId }));
    }
  }
  return out;
}
