"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  CircleDot,
  Clock,
  GitBranch,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  StickyNote,
  UserPlus,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  CALLBACK_CHANNELS,
  CALLBACK_CHANNEL_TONE,
  CALLBACK_WHEN_PRESETS,
  callbackChannelLabel,
  computeDueAt,
  configLabel,
  formatDueDate,
  formatLeadDate,
  isOverdue,
  relativeDue,
  type CallbackChannel,
  type LeadCallback,
  type LeadDetail,
  type LeadFunnelStage,
  type LeadNote,
  type LeadSourceOption,
  type LeadTimelineEntry
} from "@/lib/leads-types";
import {
  addLeadNoteAction,
  loadLeadDetailAction,
  moveLeadStageAction,
  scheduleCallbackAction,
  updateCallbackAction
} from "@/app/(app)/leads/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

/**
 * Right-side drawer for the lead 360 view. Loads `GET /leads/:leadId` on open and
 * lets staff change the stage, log notes, schedule callbacks (with the "in N
 * days/months" quick-picks) and view the merged timeline. Mutations refetch the
 * detail bundle so the timeline + lists stay in sync.
 */
export function LeadDetailDrawer({
  leadId,
  stages,
  sources,
  onClose
}: {
  leadId: string;
  stages: LeadFunnelStage[];
  sources: LeadSourceOption[];
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumping this refetches the detail bundle after a mutation.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadLeadDetailAction(leadId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setDetail(result.data);
        setLoadError(null);
      } else {
        setLoadError(result.error ?? "Couldn't load this lead.");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [leadId, reloadKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  const lead = detail?.lead;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lead detail"
        className="animate-in relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-pop"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            {lead ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold tracking-tight text-ink">{lead.name}</h2>
                  <Badge tone="neutral">{configLabel(sources, lead.source)}</Badge>
                  {lead.convertedPatientId ? <Badge tone="good" dot>Converted</Badge> : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" /> {lead.phone || "No phone"}
                  </span>
                  {lead.email ? <span>· {lead.email}</span> : null}
                  {lead.assignedTo ? <span>· Owner: {lead.assignedTo}</span> : null}
                </p>
              </>
            ) : (
              <h2 className="text-base font-semibold tracking-tight text-ink">Lead detail</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:bg-fill hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Stage control */}
        {lead ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted/40 px-5 py-3">
            <span className="text-xs font-medium text-ink-soft">Stage</span>
            <StagePicker leadId={lead.id} stage={lead.stage} stages={stages} onChanged={refresh} />
            <span className="ml-auto text-[11px] text-ink-faint">Added {formatLeadDate(lead.createdAt)}</span>
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-sm text-ink-muted">Loading lead…</p>
          ) : loadError ? (
            <div className="p-5">
              <p className="text-sm text-[var(--color-critical)]">{loadError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : detail ? (
            <div className="space-y-6 p-5">
              <ScheduleCallbackCard leadId={detail.lead.id} onScheduled={refresh} />
              <CallbacksSection callbacks={detail.callbacks} onChanged={refresh} />
              <NotesSection leadId={detail.lead.id} notes={detail.notes} onAdded={refresh} />
              <TimelineSection timeline={detail.timeline} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---- Stage picker ----------------------------------------------------------

function StagePicker({
  leadId,
  stage,
  stages,
  onChanged
}: {
  leadId: string;
  stage: string;
  stages: LeadFunnelStage[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(stage);
  const [pending, startTransition] = useTransition();
  const known = stages.some((s) => s.key === value);

  function change(next: string) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const result = await moveLeadStageAction(leadId, next);
      if (!result.ok) {
        setValue(prev);
        toast(result.error ?? "Could not move the lead.", "error");
        return;
      }
      toast(result.message ?? "Lead moved.", "success");
      onChanged();
    });
  }

  return (
    <select
      value={known ? value : ""}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      aria-label="Lead stage"
      className={cn(selectClass, "h-8 w-auto text-xs")}
    >
      {!known ? <option value="">Move to…</option> : null}
      {stages.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

// ---- Schedule a callback ---------------------------------------------------

function ScheduleCallbackCard({ leadId, onScheduled }: { leadId: string; onScheduled: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [whenValue, setWhenValue] = useState(CALLBACK_WHEN_PRESETS[0]?.value ?? "tomorrow");
  const [customDate, setCustomDate] = useState("");
  const [channel, setChannel] = useState<CallbackChannel>("call");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const preset = CALLBACK_WHEN_PRESETS.find((p) => p.value === whenValue) ?? CALLBACK_WHEN_PRESETS[0];
  const previewDue = preset ? computeDueAt(preset, customDate) : null;

  function submit() {
    const t = title.trim();
    if (!t) {
      setError("Give the callback a title.");
      return;
    }
    if (!preset) {
      setError("Pick when to call back.");
      return;
    }
    const dueAt = computeDueAt(preset, customDate);
    if (!dueAt) {
      setError("Pick a valid date.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await scheduleCallbackAction(leadId, { title: t, dueAt, channel });
      if (!result.ok) {
        setError(result.error ?? "Could not schedule the callback.");
        return;
      }
      setTitle("");
      setCustomDate("");
      setChannel("call");
      setWhenValue(CALLBACK_WHEN_PRESETS[0]?.value ?? "tomorrow");
      toast(result.message ?? "Callback scheduled.", "success");
      onScheduled();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-surface-muted/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-brand-600" />
        <h3 className="text-xs font-semibold text-ink-soft">Schedule a callback</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink-soft" htmlFor="cb-title">
            What to talk about
          </label>
          <Input
            id="cb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Follow up on cataract surgery"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-ink-soft">Call back…</span>
          <div className="flex flex-wrap gap-1.5">
            {CALLBACK_WHEN_PRESETS.map((p) => {
              const active = p.value === whenValue;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setWhenValue(p.value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                    active
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-line bg-surface text-ink-soft hover:bg-surface-muted"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {preset?.custom ? (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft" htmlFor="cb-date">
              Custom date
            </label>
            <Input id="cb-date" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          </div>
        ) : null}

        <div className="grid grid-cols-2 items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft" htmlFor="cb-channel">
              Channel
            </label>
            <select
              id="cb-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as CallbackChannel)}
              className={selectClass}
            >
              {CALLBACK_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={submit} disabled={saving}>
            <CalendarClock className="size-3.5" /> {saving ? "Scheduling…" : "Schedule"}
          </Button>
        </div>

        {previewDue ? (
          <p className="text-[11px] text-ink-muted">
            Due {formatDueDate(previewDue)} · {relativeDue(previewDue)}
          </p>
        ) : null}
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>
    </section>
  );
}

// ---- Callbacks list --------------------------------------------------------

function CallbacksSection({
  callbacks,
  onChanged
}: {
  callbacks: LeadCallback[];
  onChanged: () => void;
}) {
  const open = callbacks.filter((c) => c.status === "open");

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <PhoneCall className="size-4 text-ink-soft" />
        <h3 className="text-xs font-semibold text-ink-soft">
          Callbacks {open.length > 0 ? <span className="text-ink-faint">({open.length} open)</span> : null}
        </h3>
      </div>
      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-[11px] text-ink-faint">
          No open callbacks.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((cb) => (
            <CallbackRow key={cb.id} callback={cb} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CallbackRow({ callback, onChanged }: { callback: LeadCallback; onChanged: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const overdue = isOverdue(callback.dueAt);

  function act(status: "done" | "cancelled") {
    startTransition(async () => {
      const result = await updateCallbackAction(callback.id, status);
      if (!result.ok) {
        toast(result.error ?? "Could not update the callback.", "error");
        return;
      }
      toast(result.message ?? "Updated.", "success");
      onChanged();
    });
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{callback.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
            <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-[var(--color-critical)]")}>
              <Clock className="size-3" /> {formatDueDate(callback.dueAt)}
            </span>
            <span className={cn(overdue && "font-semibold text-[var(--color-critical)]")}>· {relativeDue(callback.dueAt)}</span>
          </p>
          {callback.note ? <p className="mt-1 text-[11px] text-ink-faint">{callback.note}</p> : null}
        </div>
        <Badge tone={CALLBACK_CHANNEL_TONE[callback.channel] ?? "neutral"}>
          {callbackChannelLabel(callback.channel)}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => act("done")} disabled={pending}>
          <Check className="size-3.5" /> Mark done
        </Button>
        <Button variant="ghost" size="sm" onClick={() => act("cancelled")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </li>
  );
}

// ---- Notes -----------------------------------------------------------------

function NotesSection({
  leadId,
  notes,
  onAdded
}: {
  leadId: string;
  notes: LeadNote[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const ordered = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function submit() {
    const text = body.trim();
    if (!text) {
      setError("Write a note first.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const result = await addLeadNoteAction(leadId, text);
      if (!result.ok) {
        setError(result.error ?? "Could not add the note.");
        return;
      }
      setBody("");
      toast(result.message ?? "Note added.", "success");
      onAdded();
    });
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <StickyNote className="size-4 text-ink-soft" />
        <h3 className="text-xs font-semibold text-ink-soft">Notes</h3>
      </div>
      <div className="rounded-xl border border-line bg-surface p-2.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note about this lead…"
          className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {error ? (
            <p className="text-[11px] font-medium text-[var(--color-critical)]">{error}</p>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={submit} disabled={saving}>
            <Send className="size-3.5" /> {saving ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="mt-2 text-center text-[11px] text-ink-faint">No notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {ordered.map((note) => (
            <li key={note.id} className="rounded-xl border border-line bg-surface-muted/40 p-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {note.authorName ? `${note.authorName} · ` : ""}
                {formatDueDate(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- Timeline --------------------------------------------------------------

const TIMELINE_ICON: Record<string, typeof Activity> = {
  created: UserPlus,
  note: MessageSquare,
  stage: GitBranch,
  source: GitBranch,
  callback_scheduled: CalendarClock,
  callback_done: Check,
  callback_cancelled: X,
  converted: ArrowRight
};

function TimelineSection({ timeline }: { timeline: LeadTimelineEntry[] }) {
  const ordered = [...timeline].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Activity className="size-4 text-ink-soft" />
        <h3 className="text-xs font-semibold text-ink-soft">Activity</h3>
      </div>
      {ordered.length === 0 ? (
        <p className="text-center text-[11px] text-ink-faint">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((entry) => {
            const Icon = TIMELINE_ICON[entry.type] ?? CircleDot;
            return (
              <li key={entry.id} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{entry.text}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {entry.by ? `${entry.by} · ` : ""}
                    {formatDueDate(entry.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
