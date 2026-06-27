"use client";

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  Route,
  TrendingDown,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import type { FollowUpQueueItem, JourneyStage, PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useSelection } from "@/lib/use-selection";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { StatTile } from "@/components/ui/stat";
import { ActionButton } from "@/components/common/action-button";

export function ContinuityWorkspace() {
  const { data, completeFollowUp, escalateFollowUp, patientIdByName } = useApp();
  const { activeUser } = data.authContext;
  const has = (key: PermissionKey) => activeUser.permissions.includes(key);
  const canManage = has("followup:manage");

  const { selectedId, select, clear, hasSelection } = useSelection(data.followUpQueue[0]?.id);
  const selected = data.followUpQueue.find((j) => j.id === selectedId) ?? data.followUpQueue[0];
  const patientId = patientIdByName(selected?.patient ?? "");

  const summary = useMemo(() => {
    const overdue = data.followUpQueue.filter((j) => j.due.toLowerCase().includes("overdue")).length;
    const avgLeak = Math.round(
      data.followUpQueue.reduce((sum, j) => sum + (j.leakageRisk ?? 0), 0) / Math.max(1, data.followUpQueue.length)
    );
    return { total: data.followUpQueue.length, overdue, avgLeak };
  }, [data.followUpQueue]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Active journeys" value={summary.total} icon={<Route className="size-4" />} />
        <StatTile label="Overdue steps" value={summary.overdue} tone="risk" icon={<AlertTriangle className="size-4" />} />
        <StatTile label="Avg drop-off risk" value={`${summary.avgLeak}%`} tone="high" icon={<TrendingDown className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Journey lanes */}
        <Panel padded={false} className={cn("flex max-h-[calc(100dvh-12rem)] flex-col", hasSelection && "hidden lg:flex")}>
          <div className="border-b border-line p-4">
            <SectionTitle icon={<Activity className="size-4" />} title="Follow-up journeys" subtitle="Following patients through their care" />
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {data.followUpQueue.map((journey) => (
              <li key={journey.id}>
                <button
                  onClick={() => select(journey.id)}
                  className={cn("w-full px-4 py-3 text-left transition-colors", journey.id === selected?.id ? "bg-brand-50" : "hover:bg-surface-muted")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={journey.patient} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-ink">{journey.patient}</p>
                        <p className="text-[11px] text-ink-muted">{journey.journey}</p>
                      </div>
                    </div>
                    <PriorityBadge priority={journey.risk} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-ink-soft">{journey.stage}</span>
                    <span className={cn("text-[11px] font-medium", journey.due.toLowerCase().includes("overdue") ? "text-[var(--color-critical)]" : "text-ink-muted")}>{journey.due}</span>
                  </div>
                  {typeof journey.leakageRisk === "number" ? <Meter value={journey.leakageRisk} className="mt-2" tone={journey.leakageRisk > 70 ? "critical" : "high"} /> : null}
                </button>
              </li>
            ))}
            {data.followUpQueue.length === 0 ? (
              <EmptyState icon={<Activity className="size-5" />} title="No active journeys" description="Completed follow-ups clear from this queue." />
            ) : null}
          </ul>
        </Panel>

        {/* Journey detail */}
        {selected ? (
          <div className={cn("space-y-5", !hasSelection && "hidden lg:block")}>
            <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden">
              <ArrowLeft className="size-4" /> All journeys
            </button>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.patient} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      {patientId ? (
                        <Link href={`/patients/${patientId}`} className="text-base font-semibold text-ink hover:text-brand-700 hover:underline">
                          {selected.patient}
                        </Link>
                      ) : (
                        <h2 className="text-base font-semibold text-ink">{selected.patient}</h2>
                      )}
                      <PriorityBadge priority={selected.risk} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{selected.journey} · owned by {selected.owner}</p>
                  </div>
                </div>
                {typeof selected.leakageRisk === "number" ? (
                  <div className="w-44 rounded-xl bg-surface-muted p-3">
                    <p className="text-[11px] font-medium text-ink-muted">Drop-off risk</p>
                    <Meter value={selected.leakageRisk} className="mt-1.5" tone={selected.leakageRisk > 70 ? "critical" : "high"} showLabel />
                  </div>
                ) : null}
              </div>

              {selected.stages ? <Stepper stages={selected.stages} /> : null}
            </Panel>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {/* Protocol checklist */}
              <Panel>
                <SectionTitle icon={<ClipboardList className="size-4" />} title="Protocol checklist" subtitle={selected.stage} />
                <ul className="mt-3 space-y-2">
                  {(selected.protocol ?? []).map((step) => (
                    <li key={step.label} className="flex items-center gap-2.5">
                      {step.done ? <CheckCircle2 className="size-4 text-[var(--color-good)]" /> : <Circle className="size-4 text-ink-faint" />}
                      <span className={cn("text-sm", step.done ? "text-ink-muted line-through" : "text-ink")}>{step.label}</span>
                    </li>
                  ))}
                  {!selected.protocol?.length ? <li className="text-sm text-ink-muted">No protocol steps defined.</li> : null}
                </ul>
                <div className="mt-4 rounded-xl bg-brand-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Next step</p>
                  <p className="mt-1 text-sm text-ink">{selected.nextStep}</p>
                </div>
              </Panel>

              {/* Continuity guidance + actions */}
              <Panel className="flex flex-col">
                <SectionTitle icon={<TrendingDown className="size-4" />} title="Continuity analysis" />
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{leakageGuidance(selected)}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ActionButton
                    action={{ type: "complete_follow_up_task", id: selected.id }}
                    userId={activeUser.id}
                    variant="primary"
                    icon={<CheckCircle2 className="size-3.5" />}
                    permitted={canManage}
                    restrictedReason="Follow-up manage permission required."
                    onSuccess={() => completeFollowUp(selected.id)}
                  >
                    Complete step
                  </ActionButton>
                  <ActionButton
                    action={{ type: "escalate_follow_up", id: selected.id }}
                    userId={activeUser.id}
                    variant="danger"
                    icon={<AlertTriangle className="size-3.5" />}
                    permitted={canManage}
                    restrictedReason="Follow-up manage permission required."
                    confirm={{ title: "Escalate to nurse?", body: `This moves ${selected.patient}'s ${selected.journey} to the nurse desk and flags it critical.`, confirmLabel: "Escalate", danger: true }}
                    onSuccess={() => escalateFollowUp(selected.id)}
                  >
                    Escalate to nurse
                  </ActionButton>
                  {patientId ? (
                    <Link href={`/patients/${patientId}`} className="ml-auto">
                      <Button variant="outline" size="sm">
                        <UserRound className="size-3.5" /> Patient 360
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <Panel>
            <EmptyState icon={<Activity className="size-5" />} title="Select a journey" />
          </Panel>
        )}
      </div>
    </div>
  );
}

function Stepper({ stages }: { stages: JourneyStage[] }) {
  const icon = (state: JourneyStage["state"]) => {
    if (state === "done") return <CheckCircle2 className="size-4 text-[var(--color-good)]" />;
    if (state === "active") return <CircleDot className="size-4 text-brand-600" />;
    if (state === "missed") return <XCircle className="size-4 text-[var(--color-critical)]" />;
    return <Circle className="size-4 text-ink-faint" />;
  };
  return (
    <div className="mt-5 flex items-center">
      {stages.map((stage, index) => (
        <div key={stage.label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            {icon(stage.state)}
            <span className={cn("whitespace-nowrap text-[11px]", stage.state === "active" ? "font-semibold text-brand-700" : "text-ink-muted")}>{stage.label}</span>
          </div>
          {index < stages.length - 1 ? (
            <span className={cn("mx-2 mb-5 h-px flex-1", stage.state === "done" ? "bg-[var(--color-good)]" : "bg-line")} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function leakageGuidance(journey: FollowUpQueueItem): string {
  const risk = journey.leakageRisk ?? 0;
  if (risk > 75) {
    return `High drop-off risk (${risk}%) on ${journey.journey}. ${journey.patient} is likely to fall out of care without contact today. ${journey.nextStep} If unreachable, escalate to nurse and log a missed-follow-up reason.`;
  }
  if (risk > 50) {
    return `Moderate drop-off risk (${risk}%). Keep ${journey.patient} on protocol — ${journey.nextStep.toLowerCase()} A second reminder in the patient's language usually keeps them in care.`;
  }
  return `${journey.patient} is progressing on ${journey.journey}. ${journey.nextStep} Continue the protocol and confirm completion to close the loop.`;
}
