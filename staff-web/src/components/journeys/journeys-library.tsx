"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Languages,
  MessageCircle,
  Pencil,
  Phone,
  Play,
  Route,
  Send,
  Timer,
  Users
} from "lucide-react";
import type { JourneyPack, JourneyStageTemplate } from "@/lib/journeys";
import { formatInrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { ProgressRing } from "@/components/ui/charts";
import { useToast } from "@/components/ui/toast";

export function JourneysLibrary({ packs: initialPacks, canManage }: { packs: JourneyPack[]; canManage: boolean }) {
  const { toast } = useToast();
  const { data } = useApp();
  const [packs, setPacks] = useState(initialPacks);
  const [selectedId, setSelectedId] = useState(initialPacks[0]?.id ?? "");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const selected = packs.find((p) => p.id === selectedId) ?? packs[0];

  const enroll = (patientName: string) => {
    setPacks((ps) => ps.map((p) => (p.id === selected?.id ? { ...p, activePatients: p.activePatients + 1, status: "live" } : p)));
    setEnrollOpen(false);
    toast(`${patientName} enrolled in ${selected?.name}.`, "success");
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* Pack list */}
      <Panel padded={false} className="flex max-h-[calc(100dvh-7.5rem)] flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <SectionTitle icon={<Route className="size-4" />} title="Journey packs" subtitle={`${packs.filter((p) => p.status === "live").length} live · ${packs.length} total`} />
          <Button size="sm" variant="outline" onClick={() => toast("Journey pack builder — coming soon", "info")}>
            New
          </Button>
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {packs.map((pack) => (
            <li key={pack.id}>
              <button
                onClick={() => setSelectedId(pack.id)}
                className={cn("w-full px-4 py-3 text-left transition-colors", pack.id === selected?.id ? "bg-brand-50" : "hover:bg-surface-muted")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{pack.name}</span>
                  <Badge tone={pack.status === "live" ? "good" : "neutral"} dot>{pack.status}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-muted">{pack.specialty}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-soft">
                  <span className="inline-flex items-center gap-1"><Users className="size-3" /> {pack.activePatients}</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3" /> {pack.completionRate}%</span>
                  {pack.leakageRecovered > 0 ? <span className="text-[var(--color-good)]">{formatInrCompact(pack.leakageRecovered)}</span> : null}
                </div>
              </button>
            </li>
          ))}
          {packs.length === 0 ? <EmptyState icon={<Route className="size-5" />} title="No journey packs" description="Create a specialty journey to begin." /> : null}
        </ul>
      </Panel>

      {/* Pack detail */}
      {selected ? (
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-ink">{selected.name}</h2>
                  <Badge tone={selected.status === "live" ? "good" : "neutral"} dot>{selected.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{selected.specialty}</p>
                <p className="mt-2 max-w-xl text-sm text-ink-soft">{selected.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Languages className="size-3.5 text-ink-faint" />
                  {selected.languages.map((language) => (
                    <Badge key={language} tone="neutral">{language}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (canManage ? setEnrollOpen(true) : toast("Journey manage permission required", "error"))}
                >
                  <Users className="size-3.5" /> Enroll patient
                </Button>
                {selected.status === "draft" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      canManage
                        ? (setPacks((ps) => ps.map((p) => (p.id === selected.id ? { ...p, status: "live" } : p))), toast(`${selected.name} activated`, "success"))
                        : toast("Journey manage permission required", "error")
                    }
                  >
                    <Play className="size-3.5" /> Activate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => toast(canManage ? "Opening protocol editor" : "Journey manage permission required", canManage ? "info" : "error")}>
                    <Pencil className="size-3.5" /> Edit protocol
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Active patients" value={String(selected.activePatients)} icon={<Users className="size-4" />} />
              <Metric label="Completion" value={`${selected.completionRate}%`} icon={<CheckCircle2 className="size-4" />} />
              <Metric label="Leakage recovered" value={formatInrCompact(selected.leakageRecovered)} icon={<Send className="size-4" />} />
              <Metric label="Avg duration" value={`${selected.avgDurationDays}d`} icon={<CalendarClock className="size-4" />} />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Protocol */}
            <Panel>
              <SectionTitle icon={<Timer className="size-4" />} title="Protocol stages" subtitle="Automated steps, SLAs & message templates" />
              <ol className="mt-4 space-y-3">
                {selected.stages.map((stage, index) => (
                  <StageCard key={stage.label} stage={stage} index={index} />
                ))}
              </ol>
            </Panel>

            {/* Cohort */}
            <Panel>
              <SectionTitle icon={<Users className="size-4" />} title="Live cohort" subtitle="Patients by stage" />
              {selected.cohort.length ? (
                <>
                  <div className="mt-4 flex justify-center">
                    <ProgressRing value={selected.completionRate} size={96} thickness={9} label="complete" />
                  </div>
                  <ul className="mt-5 space-y-2">
                    {selected.cohort.map((stage) => (
                      <li key={stage.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", stateColor(stage.state))} />
                          <span className="text-ink-soft">{stage.label}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-ink">{stage.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">No patients enrolled yet — activate this pack to begin.</p>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      <Modal open={enrollOpen} onClose={() => setEnrollOpen(false)} labelledBy="enroll-title" className="max-w-sm">
        <div className="border-b border-line p-5">
          <h2 id="enroll-title" className="text-base font-semibold tracking-tight text-ink">Enroll patient</h2>
          <p className="mt-1 text-xs text-ink-muted">{selected?.name}</p>
        </div>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {data.directory.map((patient) => (
            <li key={patient.id}>
              <button onClick={() => enroll(patient.name)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-muted">
                <Avatar name={patient.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">{patient.condition}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function StageCard({ stage, index }: { stage: JourneyStageTemplate; index: number }) {
  const ChannelIc = stage.channel === "Call" ? Phone : MessageCircle;
  return (
    <li className="relative flex gap-3 rounded-xl border border-line p-3.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{stage.label}</p>
          <Badge tone="neutral">{stage.offset}</Badge>
          <Badge tone="brand"><Timer className="size-3" /> SLA {stage.sla}</Badge>
          <Badge tone="outline"><ChannelIc className="size-3" /> {stage.channel}</Badge>
          {stage.escalates ? <Badge tone="critical"><AlertTriangle className="size-3" /> Escalates</Badge> : null}
        </div>
        <p className="mt-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs text-ink-soft">{stage.template}</p>
      </div>
    </li>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <span className="text-ink-faint">{icon}</span>
      <p className="mt-1 text-base font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function stateColor(state: string): string {
  return { done: "bg-[var(--color-good)]", active: "bg-brand-500", pending: "bg-fill-strong", missed: "bg-[var(--color-critical)]" }[state] ?? "bg-fill-strong";
}
