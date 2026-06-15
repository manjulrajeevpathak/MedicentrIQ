"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useSelection } from "@/lib/use-selection";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  GitBranch,
  History,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Workflow,
  X
} from "lucide-react";
import type { AiRecommendation, DashboardData, PermissionKey } from "@/lib/types";
import { dismissReasons, outcomeStages, type OutcomeStage, type RecommendationOutcome } from "@/lib/copilot";
import { formatInrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty";
import { StatTile } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/common/action-button";
import { submitStaffAction } from "@/lib/core-api";

type Filter = "all" | "approval" | "auto";

// Neutral chips — the icon differentiates the category, not the colour.
const categoryChip = "text-ink-muted bg-fill";
const categoryMeta: Record<NonNullable<AiRecommendation["category"]>, { label: string; icon: typeof Sparkles; tone: string }> = {
  clinical: { label: "Clinical", icon: Stethoscope, tone: categoryChip },
  revenue: { label: "Care continuity", icon: HeartPulse, tone: categoryChip },
  access: { label: "Access", icon: Activity, tone: categoryChip },
  continuity: { label: "Continuity", icon: Workflow, tone: categoryChip }
};

export function AiWorkbench({ outcomes }: { outcomes: RecommendationOutcome[] }) {
  const { data, acceptRecommendation, dismissRecommendation, patientIdByName } = useApp();
  const { activeUser } = data.authContext;
  const has = (key: PermissionKey) => activeUser.permissions.includes(key);
  const canApprove = has("ai:approve");

  const [filter, setFilter] = useState<Filter>("all");
  const { selectedId, select } = useSelection(data.recommendations[0]?.id);

  const counts = useMemo(
    () => ({
      all: data.recommendations.length,
      approval: data.recommendations.filter((r) => r.requiresApproval).length,
      auto: data.recommendations.filter((r) => !r.requiresApproval).length
    }),
    [data.recommendations]
  );

  const list = useMemo(() => {
    if (filter === "approval") return data.recommendations.filter((r) => r.requiresApproval);
    if (filter === "auto") return data.recommendations.filter((r) => !r.requiresApproval);
    return data.recommendations;
  }, [data.recommendations, filter]);

  const selected = data.recommendations.find((r) => r.id === selectedId) ?? list[0] ?? data.recommendations[0];
  const avgConfidence = Math.round(data.recommendations.reduce((s, r) => s + r.confidence, 0) / Math.max(1, data.recommendations.length));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open recommendations" value={counts.all} icon={<Sparkles className="size-4" />} />
        <StatTile label="Need approval" value={counts.approval} tone="high" icon={<ShieldCheck className="size-4" />} />
        <StatTile label="Auto-safe" value={counts.auto} tone="good" icon={<BadgeCheck className="size-4" />} />
        <StatTile label="Avg confidence" value={`${avgConfidence}%`} icon={<Activity className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* Queue */}
        <Panel padded={false} className="flex max-h-[calc(100dvh-12rem)] flex-col">
          <div className="border-b border-line p-4">
            <SectionTitle icon={<Sparkles className="size-4" />} title="Recommendation queue" subtitle="Governed DatacentrIQ intelligence" />
            <div className="mt-3">
              <Segmented
                value={filter}
                onChange={setFilter}
                size="sm"
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "approval", label: "Approval", count: counts.approval },
                  { value: "auto", label: "Auto-safe", count: counts.auto }
                ]}
              />
            </div>
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {list.map((rec) => {
              const meta = rec.category ? categoryMeta[rec.category] : null;
              const Icon = meta?.icon ?? Sparkles;
              return (
                <li key={rec.id}>
                  <button
                    onClick={() => select(rec.id)}
                    className={cn("w-full px-4 py-3 text-left transition-colors", rec.id === selected?.id ? "bg-brand-50" : "hover:bg-surface-muted")}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={cn("mt-0.5 flex size-7 items-center justify-center rounded-lg", meta?.tone ?? "bg-fill text-ink-muted")}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{rec.title}</p>
                          {rec.requiresApproval ? <Badge tone="high">Approval</Badge> : <Badge tone="good">Auto</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{rec.patient}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Meter value={rec.confidence} className="flex-1" />
                          <span className="text-[11px] font-semibold tabular-nums text-ink-soft">{rec.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {list.length === 0 ? <EmptyState icon={<Sparkles className="size-5" />} title="Nothing to review" /> : null}
          </ul>
        </Panel>

        {/* Detail */}
        {selected ? (
          <div className="space-y-5">
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={selected.patient} size="lg" />
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-ink">{selected.title}</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{selected.patient}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {selected.category ? <Badge tone="brand">{categoryMeta[selected.category].label}</Badge> : null}
                      {selected.requiresApproval ? <Badge tone="high" dot>Requires approval</Badge> : <Badge tone="good" dot>Auto-safe</Badge>}
                    </div>
                  </div>
                </div>
                <div className="w-40 rounded-xl bg-surface-muted p-3">
                  <p className="text-[11px] font-medium text-ink-muted">Confidence</p>
                  <Meter value={selected.confidence} className="mt-1.5" showLabel />
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-brand-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700"><Sparkles className="size-3" /> Recommended action</p>
                <p className="mt-1 text-sm text-ink">{selected.action}</p>
              </div>

              <div className="mt-3 rounded-xl border border-line p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Evidence</p>
                <p className="mt-1 text-sm text-ink-soft">{selected.evidence}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ActionButton
                  action={{ type: "accept_recommendation", id: selected.id }}
                  userId={activeUser.id}
                  variant="primary"
                  icon={<CheckCircle2 className="size-3.5" />}
                  permitted={!selected.requiresApproval || canApprove}
                  restrictedReason="This recommendation needs sign-off — the ai:approve permission is required."
                  onSuccess={() => acceptRecommendation(selected.id)}
                >
                  Accept & create task
                </ActionButton>
                <DismissWithReason recommendationId={selected.id} userId={activeUser.id} onDone={(reason) => dismissRecommendation(selected.id, reason)} />
                {patientIdByName(selected.patient) ? (
                  <Link href={`/patients/${patientIdByName(selected.patient)}`} className="ml-auto">
                    <Button variant="outline" size="sm">Open Patient 360</Button>
                  </Link>
                ) : null}
                {selected.requiresApproval && !canApprove ? (
                  <span className="text-xs text-ink-muted">View-only — approval permission needed.</span>
                ) : null}
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {/* Decision trace */}
              <Panel>
                <SectionTitle icon={<GitBranch className="size-4" />} title="Decision trace" subtitle="Why this was recommended" />
                <ol className="mt-4 space-y-0">
                  {(selected.trace ?? []).map((step, index, arr) => (
                    <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < arr.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-line" /> : null}
                      <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">{index + 1}</span>
                      <p className="pt-0.5 text-sm text-ink-soft">{step}</p>
                    </li>
                  ))}
                  {!selected.trace?.length ? <li className="text-sm text-ink-muted">No trace available.</li> : null}
                </ol>
              </Panel>

              {/* Sources + governance */}
              <Panel>
                <SectionTitle icon={<FileText className="size-4" />} title="Sources & governance" />
                <ul className="mt-3 space-y-1.5">
                  {(selected.sources ?? []).map((source) => {
                    const href = evidenceHref(source);
                    const inner = (
                      <>
                        <FileText className="size-3.5 text-ink-faint" /> {source}
                        {href ? <ArrowUpRight className="ml-auto size-3.5 text-ink-faint" /> : null}
                      </>
                    );
                    return (
                      <li key={source}>
                        {href ? (
                          <Link href={href} className="flex items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs text-ink-soft transition hover:bg-fill hover:text-ink">
                            {inner}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs text-ink-soft">{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--color-good-soft)] p-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-good)]" />
                  <p className="text-xs leading-relaxed text-ink-soft">
                    Every acceptance is audited and reversible. Outbound patient messages and clinical-risk actions are held for human approval before send.
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <Panel>
            <EmptyState icon={<Sparkles className="size-5" />} title="Select a recommendation" />
          </Panel>
        )}
      </div>

      <OutcomeLoop outcomes={outcomes} />
    </div>
  );
}

function DismissWithReason({
  recommendationId,
  userId,
  onDone
}: {
  recommendationId: string;
  userId: string;
  onDone: (reason: string) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dismiss = (reason: string) => {
    setOpen(false);
    startTransition(async () => {
      const result = await submitStaffAction({ id: userId }, { type: "dismiss_recommendation", id: recommendationId });
      toast(result.ok ? `Dismissed — ${reason}` : result.message, result.ok ? "success" : "error");
      if (result.ok) onDone(reason);
    });
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} disabled={pending}>
        <X className="size-3.5" /> {pending ? "Dismissing…" : "Dismiss"}
      </Button>
      {open ? (
        <div className="animate-in absolute left-0 top-[calc(100%+6px)] z-30 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Reason (feeds AI calibration)</p>
          {dismissReasons.map((reason) => (
            <button
              key={reason}
              onClick={() => dismiss(reason)}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-soft transition hover:bg-surface-muted hover:text-ink"
            >
              {reason}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Resolve an evidence reference (e.g. "Interaction IN-2317") to a deep link. */
function evidenceHref(source: string): string | undefined {
  const match = source.match(/\b(IN|FQ|AQ|P)-[\w]+/);
  if (!match) return undefined;
  const ref = match[0];
  if (ref.startsWith("IN-")) return `/inbox?sel=${ref}`;
  if (ref.startsWith("FQ-")) return `/continuity?sel=${ref}`;
  if (ref.startsWith("AQ-")) return `/access?sel=${ref}`;
  if (ref.startsWith("P-")) return `/patients/${ref}`;
  return undefined;
}

const stageMeta: Record<OutcomeStage, { label: string; tone: string }> = {
  generated: { label: "Generated", tone: "bg-fill-strong" },
  shown: { label: "Shown", tone: "bg-brand-300" },
  accepted: { label: "Accepted", tone: "bg-brand-500" },
  rejected: { label: "Rejected", tone: "bg-[var(--color-critical)]" },
  converted: { label: "Converted", tone: "bg-[var(--color-good)]" },
  observed: { label: "Outcome observed", tone: "bg-[var(--color-good)]" }
};

function OutcomeLoop({ outcomes }: { outcomes: RecommendationOutcome[] }) {
  const realisedValue = outcomes.reduce((sum, o) => sum + (o.value ?? 0), 0);
  const converted = outcomes.filter((o) => o.stage === "converted" || o.stage === "observed").length;

  return (
    <Panel padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
        <SectionTitle icon={<History className="size-4" />} title="Outcome & feedback loop" subtitle="Recommendation lifecycle and realised value" />
        <div className="flex items-center gap-2">
          <Badge tone="good">{converted} converted</Badge>
          <Badge tone="brand">{formatInrCompact(realisedValue)} realised</Badge>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {outcomes.map((outcome) => {
          const reached = outcomeStages.indexOf(outcome.stage === "rejected" ? "shown" : outcome.stage);
          return (
            <li key={outcome.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{outcome.title}</span>
                  <span className="text-[11px] text-ink-faint">· {outcome.patient}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{outcome.note}{outcome.by ? ` · ${outcome.by}` : ""} · {outcome.at}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {outcomeStages.map((stage, index) => (
                  <span
                    key={stage}
                    title={stageMeta[stage].label}
                    className={cn("h-1.5 w-7 rounded-full", index <= reached ? stageMeta[outcome.stage]?.tone ?? "bg-brand-500" : "bg-fill")}
                  />
                ))}
              </div>
              <div className="w-28 text-right">
                <Badge tone={outcome.stage === "converted" || outcome.stage === "observed" ? "good" : outcome.stage === "rejected" ? "critical" : "brand"} className="capitalize">
                  {stageMeta[outcome.stage].label}
                </Badge>
                {outcome.value ? <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--color-good)]">{formatInrCompact(outcome.value)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

