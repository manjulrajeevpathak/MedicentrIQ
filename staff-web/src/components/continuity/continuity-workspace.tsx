"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Plus
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import {
  FOLLOWUP_STATUSES,
  FOLLOWUP_STATUS_TONE,
  followUpStatusLabel,
  formatFollowUpDue,
  isOverdue,
  toDatetimeLocal,
  type FollowUp,
  type FollowUpStatus
} from "@/lib/continuity-types";
import type { DirectoryPatient } from "@/lib/patients-types";
import {
  createFollowUpAction,
  remindFollowUpAction,
  updateFollowUpAction
} from "@/app/(app)/continuity/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Filter = "all" | FollowUpStatus;

type Props = {
  followUps: FollowUp[];
  patients: DirectoryPatient[];
};

const ROW_ACTIONS: { status: FollowUpStatus; label: string }[] = [
  { status: "confirmed", label: "Confirm" },
  { status: "completed", label: "Complete" },
  { status: "missed", label: "Missed" },
  { status: "escalated", label: "Escalate" }
];

export function ContinuityWorkspace({ followUps, patients }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const due = followUps.filter((f) => f.status === "due").length;
    const overdue = followUps.filter((f) => f.status === "due" && isOverdue(f.dueAt)).length;
    const escalated = followUps.filter((f) => f.status === "escalated").length;
    return { total: followUps.length, due, overdue, escalated };
  }, [followUps]);

  const visible =
    filter === "all" ? followUps : followUps.filter((f) => f.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Activity className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Continuity</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Follow-up queue — keep patients in care and close the loop.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Open follow-ups" value={counts.due} icon={<ClipboardList className="size-4" />} />
        <StatTile label="Overdue" value={counts.overdue} tone="risk" icon={<AlertTriangle className="size-4" />} />
        <StatTile label="Escalated" value={counts.escalated} tone="high" icon={<BellRing className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <SectionTitle
              icon={<Activity className="size-4" />}
              title="Follow-up queue"
              subtitle={`${followUps.length} total`}
            />
            <Segmented
              size="sm"
              options={[
                { value: "all", label: "All", count: followUps.length },
                ...FOLLOWUP_STATUSES.map((s) => ({
                  value: s.value,
                  label: s.label,
                  count: followUps.filter((f) => f.status === s.value).length
                }))
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title={filter === "all" ? "No follow-ups" : "Nothing here"}
              description={
                filter === "all"
                  ? "Create a follow-up to start tracking continuity of care."
                  : "No follow-ups match this filter."
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((followUp) => (
                <FollowUpRow key={followUp.id} followUp={followUp} />
              ))}
            </ul>
          )}
        </Panel>

        <NewFollowUpForm patients={patients} />
      </div>
    </div>
  );
}

function FollowUpRow({ followUp }: { followUp: FollowUp }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const overdue = followUp.status === "due" && isOverdue(followUp.dueAt);

  const setStatus = (status: FollowUpStatus) => {
    if (status === followUp.status) return;
    startTransition(async () => {
      const result = await updateFollowUpAction(followUp.id, { status });
      if (!result.ok) {
        toast(result.error ?? "Could not update the follow-up.", "error");
        return;
      }
      toast(result.message ?? "Follow-up updated.", "success");
    });
  };

  const remind = () => {
    startTransition(async () => {
      const result = await remindFollowUpAction(followUp.id);
      toast(
        result.ok ? result.message ?? "Reminder sent." : result.error ?? "Could not send the reminder.",
        result.ok ? "success" : "error"
      );
    });
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={followUp.patientName ?? "Patient"} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{followUp.title}</p>
          <p className="truncate text-[11px] text-ink-muted">
            {followUp.patientName ?? "Unknown patient"}
          </p>
        </div>
        <div className="text-right">
          <Badge tone={FOLLOWUP_STATUS_TONE[followUp.status] ?? "neutral"} dot>
            {followUpStatusLabel(followUp.status)}
          </Badge>
          <p
            className={`mt-1 text-[11px] ${overdue ? "font-medium text-[var(--color-critical)]" : "text-ink-muted"}`}
          >
            {overdue ? "Overdue · " : "Due "}
            {formatFollowUpDue(followUp.dueAt)}
          </p>
        </div>
      </div>
      {followUp.instructions ? (
        <p className="mt-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs text-ink-soft">
          {followUp.instructions}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {ROW_ACTIONS.map((action) => (
          <Button
            key={action.status}
            size="sm"
            variant="outline"
            disabled={pending || followUp.status === action.status}
            onClick={() => setStatus(action.status)}
          >
            {action.label}
          </Button>
        ))}
        <Button size="sm" className="ml-auto" disabled={pending} onClick={remind}>
          <BellRing className="size-3.5" /> Remind
        </Button>
      </div>
    </li>
  );
}

function NewFollowUpForm({ patients }: { patients: DirectoryPatient[] }) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState("");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(toDatetimeLocal());
  const [instructions, setInstructions] = useState("");
  const [saving, startSaving] = useTransition();

  const submit = () => {
    startSaving(async () => {
      const result = await createFollowUpAction({
        patientId,
        title,
        dueAt,
        instructions: instructions || undefined
      });
      if (!result.ok) {
        toast(result.error ?? "Could not create the follow-up.", "error");
        return;
      }
      toast(result.message ?? "Follow-up created.", "success");
      setPatientId("");
      setTitle("");
      setDueAt(toDatetimeLocal());
      setInstructions("");
    });
  };

  return (
    <Panel>
      <SectionTitle
        icon={<Plus className="size-4" />}
        title="New follow-up"
        subtitle="Schedule a continuity touchpoint"
      />
      <div className="mt-4 space-y-4">
        <Field label="Patient" htmlFor="followup-patient">
          <select
            id="followup-patient"
            className={selectClass}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Select a patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.primaryPhone ? ` · ${p.primaryPhone}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" htmlFor="followup-title">
          <Input
            id="followup-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Post-op review reminder"
          />
        </Field>
        <Field label="Due" htmlFor="followup-due">
          <input
            id="followup-due"
            type="datetime-local"
            className={selectClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <Field label="Instructions" htmlFor="followup-instructions" hint="Optional">
          <textarea
            id="followup-instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="What the patient should do or be told"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          />
        </Field>
        {patients.length === 0 ? (
          <p className="text-[11px] text-ink-muted">No patients yet — add patients first.</p>
        ) : null}
        <Button
          className="w-full"
          onClick={submit}
          disabled={saving || !patientId || !title.trim() || !dueAt}
        >
          <CheckCircle2 className="size-3.5" /> Create follow-up
        </Button>
      </div>
    </Panel>
  );
}
