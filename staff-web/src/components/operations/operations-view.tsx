"use client";

import {
  Activity,
  CircleCheck,
  Clock,
  Cpu,
  Gauge,
  ScrollText,
  ServerCog,
  ShieldAlert,
  TrendingDown
} from "lucide-react";
import type { AuditEvent, ServiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

const healthTone: Record<ServiceStatus["health"], { label: string; dot: string; badge: "good" | "high" | "critical" }> = {
  online: { label: "Online", dot: "bg-[var(--color-good)]", badge: "good" },
  degraded: { label: "Degraded", dot: "bg-[var(--color-high)]", badge: "high" },
  offline: { label: "Offline", dot: "bg-[var(--color-critical)]", badge: "critical" }
};

export function OperationsView() {
  const { data } = useApp();
  const leakageSignals = [
    { label: "Missed follow-ups", value: data.followUpQueue.filter((j) => j.due.toLowerCase().includes("overdue")).length, suffix: "overdue" },
    { label: "No-show risk requests", value: data.accessQueue.filter((r) => (r.noShowRisk ?? 0) > 40).length, suffix: "flagged" },
    { label: "Escalated conversations", value: data.inbox.filter((c) => c.status === "escalated").length, suffix: "active" },
    { label: "Approval-pending AI", value: data.recommendations.filter((r) => r.requiresApproval).length, suffix: "queued" }
  ];

  return (
    <div className="space-y-5">
      {/* Service spine */}
      <Panel padded={false}>
        <div className="p-5 pb-3">
          <SectionTitle icon={<ServerCog className="size-4" />} title="Platform spine" subtitle="Independent service health & auth posture" />
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl bg-line sm:grid-cols-2">
          {data.serviceStatus.map((service) => {
            const tone = healthTone[service.health];
            return (
              <div key={service.name} className="bg-surface p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", tone.dot, service.health !== "offline" && "animate-pulse-ring")} />
                    <span className="font-mono text-sm font-semibold text-ink">{service.name}</span>
                  </div>
                  <Badge tone={tone.badge}>{tone.label}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{service.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3" /> {service.latency}</span>
                  {service.authMode ? <span className="inline-flex items-center gap-1"><ShieldAlert className="size-3" /> {service.authMode}</span> : null}
                  {service.scope ? <span className="inline-flex items-center gap-1"><Cpu className="size-3" /> {service.scope}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Control tower / leakage */}
        <Panel className="lg:col-span-1">
          <SectionTitle icon={<TrendingDown className="size-4" />} title="Control tower" subtitle="Operational risk signals" />
          <ul className="mt-4 space-y-3">
            {leakageSignals.map((signal) => (
              <li key={signal.label} className="flex items-center justify-between">
                <span className="text-sm text-ink-soft">{signal.label}</span>
                <span className="flex items-baseline gap-1">
                  <span className={cn("text-lg font-semibold tabular-nums", signal.value > 0 ? "text-[var(--color-high)]" : "text-ink")}>{signal.value}</span>
                  <span className="text-[11px] text-ink-muted">{signal.suffix}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface-muted p-3">
            <Activity className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <p className="text-xs leading-relaxed text-ink-soft">
              DatacentrIQ Control Tower monitors these signals continuously and routes the highest-impact items into the staff workbench.
            </p>
          </div>
        </Panel>

        {/* Audit feed */}
        <Panel className="lg:col-span-2" padded={false}>
          <div className="p-5 pb-3">
            <SectionTitle icon={<ScrollText className="size-4" />} title="Audit feed" subtitle="Staff, patient-link, AI and service actions" />
          </div>
          <ul className="divide-y divide-line">
            {data.auditEvents.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const outcomeTone = { allowed: "good", denied: "critical", system: "neutral" } as const;
  const time = (() => {
    try {
      return new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return event.at;
    }
  })();
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Avatar name={event.actor} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-ink">{event.actor}</span>
          <code className="rounded bg-fill px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">{event.action}</code>
          <span className="text-[11px] text-ink-faint">→ {event.resource}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{event.summary}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={outcomeTone[event.outcome]} className="capitalize">
          {event.outcome === "allowed" ? <CircleCheck className="size-3" /> : null}
          {event.outcome}
        </Badge>
        <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-ink-faint"><Clock className="size-3" /> {time}</span>
      </div>
    </li>
  );
}
