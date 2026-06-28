"use client";

import { useCallback, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GitBranch,
  LayoutList,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
  Zap
} from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { saveWorkflowAction, archiveWorkflowAction } from "@/app/(app)/communications/actions";
import {
  ANCHOR_LABELS,
  STAGE_ACTION_LABELS,
  STAGE_ACTIONS_NEEDING_TEMPLATE,
  STAGE_ANCHOR_EVENTS,
  STAGE_EVENTS,
  STATUS_LABELS,
  type CommTemplate,
  type StageAction,
  type StageTrigger,
  type Workflow,
  type WorkflowAnchor,
  type WorkflowStage,
  type WorkflowStatus
} from "@/lib/comms-types";

/* ------------------------------ flow view -------------------------------- */

const ACTION_ICON: Record<StageAction, typeof MessageSquare> = {
  message: MessageSquare,
  call: Phone,
  form: ClipboardList,
  task: CheckSquare
};

// Per-action accent (border + icon tint) for the flow nodes.
const ACTION_ACCENT: Record<StageAction, string> = {
  message: "border-brand-200 bg-brand-50/60 text-brand-700",
  call: "border-violet-200 bg-violet-50/60 text-violet-700",
  form: "border-amber-200 bg-amber-50/60 text-amber-700",
  task: "border-emerald-200 bg-emerald-50/60 text-emerald-700"
};

function eventLabel(value: string): string {
  return STAGE_EVENTS.find((e) => e.value === value)?.label ?? value;
}
function anchorEventLabel(value: string): string {
  return (STAGE_ANCHOR_EVENTS.find((e) => e.value === value)?.label ?? value).toLowerCase();
}

function triggerLabel(trigger: StageTrigger): string {
  if (trigger.type === "on_enroll") return "At booking";
  if (trigger.type === "on_event") return `On ${eventLabel(trigger.event).toLowerCase()}`;
  const mag = Math.abs(trigger.offsetHours);
  const sense = trigger.offsetHours < 0 ? "before" : trigger.offsetHours > 0 ? "after" : "at";
  return `${mag}h ${sense} ${anchorEventLabel(trigger.anchorEvent)}`;
}

/** Time-rank a stage so the rail reads booking → before-reminders → after. */
function timeRank(stage: WorkflowStage): number {
  if (stage.trigger.type === "on_enroll") return Number.NEGATIVE_INFINITY;
  if (stage.trigger.type === "relative") return stage.trigger.offsetHours;
  return 0;
}

function FlowNode({ stage, templates }: { stage: WorkflowStage; templates: CommTemplate[] }) {
  const Icon = ACTION_ICON[stage.action];
  const templateName = stage.templateId ? templates.find((t) => t.id === stage.templateId)?.name : undefined;
  return (
    <div
      className={`relative w-44 shrink-0 rounded-xl border bg-surface p-3 shadow-sm transition ${
        stage.enabled ? ACTION_ACCENT[stage.action] : "border-line bg-fill/40 text-ink-muted opacity-60"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{STAGE_ACTION_LABELS[stage.action]}</span>
        {!stage.enabled ? <span className="ml-auto text-[9px] font-medium text-ink-faint">off</span> : null}
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={stage.name}>
        {stage.name}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-ink-muted" title={triggerLabel(stage.trigger)}>
        {triggerLabel(stage.trigger)}
      </p>
      {templateName ? (
        <p className="mt-1.5 truncate rounded bg-fill px-1.5 py-0.5 font-mono text-[10px] text-ink-soft" title={templateName}>
          {templateName}
        </p>
      ) : null}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      <div className="h-px w-6 bg-line-strong" />
      <div className="-ml-1 size-1.5 rotate-45 border-r border-t border-line-strong" />
    </div>
  );
}

function WorkflowFlow({
  stages,
  anchor,
  templates
}: {
  stages: WorkflowStage[];
  anchor: WorkflowAnchor;
  templates: CommTemplate[];
}) {
  if (stages.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-xs text-ink-muted">
        No stages yet — switch to Cards to add some, then come back to see the flow.
      </p>
    );
  }

  const railStages = [...stages.filter((s) => s.trigger.type !== "on_event")].sort((a, b) => timeRank(a) - timeRank(b));
  const eventStages = stages.filter((s) => s.trigger.type === "on_event");

  // Insert the anchor marker after the last "before"/enrollment node.
  type Item = { kind: "stage"; stage: WorkflowStage } | { kind: "anchor" };
  const rail: Item[] = [];
  let anchorPlaced = false;
  for (const s of railStages) {
    const t = timeRank(s);
    if (!anchorPlaced && t >= 0) {
      rail.push({ kind: "anchor" });
      anchorPlaced = true;
    }
    rail.push({ kind: "stage", stage: s });
  }
  if (!anchorPlaced) rail.push({ kind: "anchor" });

  return (
    <div className="space-y-5">
      {/* Lifecycle rail */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          <CalendarClock className="size-3.5" /> Lifecycle timeline
        </p>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-0">
            {rail.map((item, i) => (
              <div key={i} className="flex items-center">
                {i > 0 ? <Connector /> : null}
                {item.kind === "anchor" ? (
                  <div className="flex w-32 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-3 text-center">
                    <CalendarClock className="size-4 text-brand-600" />
                    <span className="mt-1 text-xs font-semibold text-brand-700">{ANCHOR_LABELS[anchor]}</span>
                    <span className="text-[10px] text-ink-muted">the moment itself</span>
                  </div>
                ) : (
                  <FlowNode stage={item.stage} templates={templates} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reactive lane */}
      {eventStages.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <Zap className="size-3.5" /> Reactive — fire only if the event happens
          </p>
          <div className="flex flex-wrap gap-3">
            {eventStages.map((s) => (
              <FlowNode key={s.key} stage={s} templates={templates} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const selectCls =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200";

type Draft = {
  id?: string;
  name: string;
  description: string;
  anchor: WorkflowAnchor;
  status: WorkflowStatus;
  stages: WorkflowStage[];
};

const NEW_DRAFT: Draft = { name: "", description: "", anchor: "appointment", status: "draft", stages: [] };

function toDraft(w: Workflow): Draft {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? "",
    anchor: w.anchor,
    status: w.status,
    stages: w.stages.map((s) => ({ ...s }))
  };
}

function newStage(): WorkflowStage {
  return {
    key: `stage_${Math.random().toString(36).slice(2, 8)}`,
    name: "New stage",
    action: "message",
    templateId: null,
    trigger: { type: "on_enroll" },
    enabled: true
  };
}

const statusTone: Record<WorkflowStatus, "neutral" | "good" | "medium"> = {
  draft: "medium",
  active: "good",
  archived: "neutral"
};

function StageCard({
  stage,
  index,
  total,
  templates,
  onChange,
  onRemove,
  onMove
}: {
  stage: WorkflowStage;
  index: number;
  total: number;
  templates: CommTemplate[];
  onChange: (s: WorkflowStage) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const needsTemplate = STAGE_ACTIONS_NEEDING_TEMPLATE.includes(stage.action);
  const triggerType = stage.trigger.type;

  function setTriggerType(type: StageTrigger["type"]) {
    let trigger: StageTrigger;
    if (type === "on_enroll") trigger = { type: "on_enroll" };
    else if (type === "on_event") trigger = { type: "on_event", event: STAGE_EVENTS[0].value };
    else trigger = { type: "relative", anchorEvent: STAGE_ANCHOR_EVENTS[0].value, offsetHours: -24 };
    onChange({ ...stage, trigger });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={stage.name}
              onChange={(e) => onChange({ ...stage, name: e.target.value })}
              placeholder="Stage name"
              className="h-9"
            />
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={index === 0}
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-fill hover:text-ink disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={index === total - 1}
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-fill hover:text-ink disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)]"
                aria-label="Remove stage"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Action</label>
              <select
                value={stage.action}
                onChange={(e) => onChange({ ...stage, action: e.target.value as StageAction })}
                className={selectCls}
              >
                {(Object.keys(STAGE_ACTION_LABELS) as StageAction[]).map((a) => (
                  <option key={a} value={a}>
                    {STAGE_ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            {needsTemplate ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-soft">Template</label>
                <select
                  value={stage.templateId ?? ""}
                  onChange={(e) => onChange({ ...stage, templateId: e.target.value || null })}
                  className={selectCls}
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-[11px] text-ink-muted">No template needed for a task.</p>
              </div>
            )}
          </div>

          {/* Trigger editor */}
          <div className="rounded-lg border border-line bg-fill/40 p-2.5">
            <label className="mb-1.5 block text-[11px] font-medium text-ink-soft">Trigger</label>
            <div className="flex flex-wrap items-center gap-2">
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as StageTrigger["type"])} className={`${selectCls} w-auto`}>
                <option value="on_enroll">When enrolled</option>
                <option value="on_event">On event</option>
                <option value="relative">Timed</option>
              </select>

              {stage.trigger.type === "on_event" ? (
                <select
                  value={stage.trigger.event}
                  onChange={(e) => onChange({ ...stage, trigger: { type: "on_event", event: e.target.value } })}
                  className={`${selectCls} w-auto`}
                >
                  {STAGE_EVENTS.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {stage.trigger.type === "relative" ? (
                <RelativeTrigger trigger={stage.trigger} onChange={(t) => onChange({ ...stage, trigger: t })} />
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <input
              type="checkbox"
              checked={stage.enabled}
              onChange={(e) => onChange({ ...stage, enabled: e.target.checked })}
              className="size-4"
            />
            {stage.enabled ? "Enabled" : "Disabled"}
          </label>
        </div>
      </div>
    </div>
  );
}

function RelativeTrigger({
  trigger,
  onChange
}: {
  trigger: Extract<StageTrigger, { type: "relative" }>;
  onChange: (t: StageTrigger) => void;
}) {
  const magnitude = Math.abs(trigger.offsetHours);
  const sense = trigger.offsetHours < 0 ? "before" : "after";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        value={magnitude}
        onChange={(e) => {
          const m = Math.max(0, Number(e.target.value) || 0);
          onChange({ ...trigger, offsetHours: sense === "before" ? -m : m });
        }}
        className={`${selectCls} w-20 text-center`}
      />
      <span className="text-xs text-ink-muted">hours</span>
      <select
        value={sense}
        onChange={(e) =>
          onChange({ ...trigger, offsetHours: e.target.value === "before" ? -magnitude : magnitude })
        }
        className={`${selectCls} w-auto`}
      >
        <option value="before">before</option>
        <option value="after">after</option>
      </select>
      <select
        value={trigger.anchorEvent}
        onChange={(e) => onChange({ ...trigger, anchorEvent: e.target.value })}
        className={`${selectCls} w-auto`}
      >
        {STAGE_ANCHOR_EVENTS.map((ev) => (
          <option key={ev.value} value={ev.value}>
            {ev.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function WorkflowsBuilder({
  workflows,
  templates
}: {
  workflows: Workflow[];
  templates: CommTemplate[];
}) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(workflows[0]?.id ?? null);
  const [creating, setCreating] = useState(workflows.length === 0);
  const [draft, setDraft] = useState<Draft>(workflows[0] ? toDraft(workflows[0]) : NEW_DRAFT);
  const [stageView, setStageView] = useState<"cards" | "flow">("cards");
  const [pending, startTransition] = useTransition();

  const activeTemplates = templates.filter((t) => t.status === "active");

  const selectWorkflow = useCallback((w: Workflow) => {
    setCreating(false);
    setSelectedId(w.id);
    setDraft(toDraft(w));
  }, []);

  const startNew = useCallback(() => {
    setCreating(true);
    setSelectedId(null);
    setDraft(NEW_DRAFT);
  }, []);

  function updateStage(index: number, stage: WorkflowStage) {
    setDraft((d) => ({ ...d, stages: d.stages.map((s, i) => (i === index ? stage : s)) }));
  }

  function removeStage(index: number) {
    setDraft((d) => ({ ...d, stages: d.stages.filter((_, i) => i !== index) }));
  }

  function moveStage(index: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d.stages];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, stages: next };
    });
  }

  function addStage() {
    setDraft((d) => ({ ...d, stages: [...d.stages, newStage()] }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveWorkflowAction({
        id: draft.id,
        name: draft.name,
        description: draft.description,
        anchor: draft.anchor,
        status: draft.id ? draft.status : undefined,
        stages: draft.stages
      });
      if (result.ok) {
        toast(result.message ?? "Workflow saved.", "success");
        if (result.data) {
          setCreating(false);
          setSelectedId(result.data.id);
          setDraft(toDraft(result.data));
        }
      } else {
        toast(result.error ?? "Could not save the workflow.", "error");
      }
    });
  }

  function archive() {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await archiveWorkflowAction(draft.id!);
      if (result.ok) {
        toast(result.message ?? "Workflow archived.", "success");
        setDraft((d) => ({ ...d, status: "archived" }));
      } else {
        toast(result.error ?? "Could not archive the workflow.", "error");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:h-[calc(100vh-12rem)]">
      {/* LEFT — list */}
      <Panel padded={false} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Workflows</h2>
          <Button size="sm" variant="secondary" onClick={startNew}>
            <Plus className="size-3.5" /> New workflow
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {workflows.length === 0 ? (
            <EmptyState
              icon={<GitBranch className="size-5" />}
              title="No workflows yet"
              description="Build your first lifecycle workflow from staged messages and tasks."
            />
          ) : (
            <ul className="space-y-1">
              {workflows.map((w) => {
                const active = !creating && w.id === selectedId;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => selectWorkflow(w)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        active ? "border-brand-300 bg-brand-50" : "border-transparent hover:border-line hover:bg-fill"
                      }`}
                    >
                      <span className="truncate text-sm font-medium text-ink">{w.name}</span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="outline">{ANCHOR_LABELS[w.anchor]}</Badge>
                        <Badge tone={statusTone[w.status]}>{STATUS_LABELS[w.status]}</Badge>
                        <span className="text-[11px] text-ink-muted">
                          {w.stages.length} stage{w.stages.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* RIGHT — editor */}
      <Panel padded={false} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{creating ? "New workflow" : draft.name || "Workflow"}</h2>
          {!creating && draft.status !== "archived" ? (
            <Button size="sm" variant="outline" onClick={archive} disabled={pending}>
              Archive
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="wf-name">
              <Input
                id="wf-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Appointment lifecycle"
              />
            </Field>
            <Field label="Anchor" htmlFor="wf-anchor">
              <select
                id="wf-anchor"
                value={draft.anchor}
                disabled={!creating}
                onChange={(e) => setDraft((d) => ({ ...d, anchor: e.target.value as WorkflowAnchor }))}
                className={`${selectCls} h-10 disabled:opacity-60`}
              >
                {(Object.keys(ANCHOR_LABELS) as WorkflowAnchor[]).map((a) => (
                  <option key={a} value={a}>
                    {ANCHOR_LABELS[a]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description" htmlFor="wf-desc">
            <Input
              id="wf-desc"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Optional — what this workflow does"
            />
          </Field>

          {!creating ? (
            <Field label="Status" htmlFor="wf-status">
              <select
                id="wf-status"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as WorkflowStatus }))}
                className={`${selectCls} h-10`}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Stages</h3>
              <div className="flex items-center gap-2">
                {/* Cards ↔ Flow view toggle */}
                <div className="flex items-center rounded-lg border border-line bg-fill/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setStageView("cards")}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      stageView === "cards" ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <LayoutList className="size-3.5" /> Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageView("flow")}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      stageView === "flow" ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <WorkflowIcon className="size-3.5" /> Flow
                  </button>
                </div>
                {stageView === "cards" ? (
                  <Button size="sm" variant="subtle" onClick={addStage}>
                    <Plus className="size-3.5" /> Add stage
                  </Button>
                ) : null}
              </div>
            </div>
            {stageView === "flow" ? (
              <WorkflowFlow stages={draft.stages} anchor={draft.anchor} templates={activeTemplates} />
            ) : draft.stages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-muted">
                No stages yet. Add a stage to start building this workflow.
              </p>
            ) : (
              <div className="space-y-2.5">
                {draft.stages.map((stage, i) => (
                  <StageCard
                    key={stage.key}
                    stage={stage}
                    index={i}
                    total={draft.stages.length}
                    templates={activeTemplates}
                    onChange={(s) => updateStage(i, s)}
                    onRemove={() => removeStage(i)}
                    onMove={(dir) => moveStage(i, dir)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : creating ? "Create workflow" : "Save"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
