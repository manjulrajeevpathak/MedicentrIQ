"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, HeartHandshake, MessageCircle, PhoneCall, Users } from "lucide-react";
import type { DashboardData, FloorVital, FlowHour, WaitingPatient } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Tone = NonNullable<FloorVital["tone"]>;

const hintTone: Record<Tone, string> = {
  neutral: "text-ink-muted",
  good: "text-[var(--color-good)]",
  watch: "text-[var(--color-high)]",
  risk: "text-[var(--color-critical)]"
};

export function TodayDashboard() {
  const { data } = useApp();
  const { activeUser } = data.authContext;

  return (
    <div className="space-y-5">
      {/* Header — a calm, human read on the day */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {greeting(data.generatedAt)}, {firstName(activeUser.name)}.
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{data.daySummary}</p>
      </div>

      {/* Floor vitals — the state of the floor right now */}
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {data.floorVitals.map((vital) => (
          <FloorVitalTile key={vital.label} vital={vital} />
        ))}
      </div>

      {/* Today's flow — where the pressure and the lulls are */}
      <TodayFlow hours={data.todayFlow} />

      {/* Waiting room + the human rail */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WaitingRoom patients={data.waitingRoom} />
        </div>
        <div className="space-y-5">
          <NotConfirmedCard data={data} />
          <NeedsPersonPanel data={data} />
        </div>
      </div>
    </div>
  );
}

function FloorVitalTile({ vital }: { vital: FloorVital }) {
  const tone = vital.tone ?? "neutral";
  return (
    <Panel padded={false} className="p-3.5">
      <p className="text-xs text-ink-muted">{vital.label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "risk" ? "text-[var(--color-critical)]" : "text-ink")}>
        {vital.value}
      </p>
      {vital.hint ? <p className={cn("mt-0.5 text-[11px]", hintTone[tone])}>{vital.hint}</p> : null}
    </Panel>
  );
}

function TodayFlow({ hours }: { hours: FlowHour[] }) {
  const max = Math.max(...hours.map((h) => h.load), 1);
  const barColor = (state?: FlowHour["state"]) =>
    state === "now"
      ? "bg-brand-500"
      : state === "busy"
        ? "bg-[var(--color-high)]"
        : state === "quiet"
          ? "bg-line"
          : "bg-brand-200";
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={<Clock className="size-4" />} title="Today's flow" subtitle="Patient load through the day" />
        <span className="hidden text-[11px] text-ink-muted sm:block">busy around 11am · quiet 2–3pm</span>
      </div>
      <div className="mt-4 flex items-end gap-1.5 sm:gap-2">
        {hours.map((h) => (
          <div key={h.hour} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-end" style={{ height: 56 }}>
              <div
                className={cn("w-full rounded-t-md", barColor(h.state))}
                style={{ height: `${Math.round((h.load / max) * 100)}%` }}
              />
            </div>
            <span className={cn("text-[10.5px] tabular-nums", h.state === "now" ? "font-medium text-brand-600" : "text-ink-faint")}>
              {h.state === "now" ? `${h.hour} ·now` : h.hour}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WaitingRoom({ patients }: { patients: WaitingPatient[] }) {
  const { toast } = useToast();
  const [done, setDone] = useState<string[]>([]);
  const visible = patients.filter((p) => !done.includes(p.id));

  const handle = (p: WaitingPatient) => {
    setDone((prev) => [...prev, p.id]);
    toast(p.action === "Find a slot" ? `Finding a slot for ${p.name}.` : `${p.name} checked in.`, "success");
  };

  return (
    <Panel padded={false}>
      <div className="p-5 pb-3">
        <SectionTitle
          icon={<Users className="size-4" />}
          title="Who's here & waiting"
          subtitle={visible.length ? `${visible.length} in the waiting room` : "waiting room is clear"}
        />
      </div>
      <ul className="divide-y divide-line">
        {visible.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted">
            <Avatar name={p.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {p.name} <span className="font-normal text-ink-muted">· {p.context}</span>
              </p>
              <p className={cn("mt-0.5 text-xs", p.tone === "watch" ? "text-[var(--color-high)]" : "text-ink-soft")}>
                waiting {p.waitMin} min{p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handle(p)}>
              {p.action}
            </Button>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Users className="size-7 text-[var(--color-good)]" />
            <p className="text-sm font-medium text-ink">Waiting room is clear</p>
            <p className="text-xs text-ink-muted">Everyone who arrived has been seen to.</p>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

function NotConfirmedCard({ data }: { data: DashboardData }) {
  const { toast } = useToast();
  const count = data.floorVitals.find((v) => v.label === "Not confirmed yet")?.value ?? "0";
  return (
    <Panel>
      <SectionTitle icon={<MessageCircle className="size-4" />} title="Not confirmed yet" />
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {count} people coming in today haven't confirmed. A warm reminder usually helps.
      </p>
      <Button
        variant="primary"
        size="sm"
        className="mt-3"
        onClick={() => toast("Gentle reminders queued for today's unconfirmed visits.", "success")}
      >
        <MessageCircle className="size-3.5" /> Send gentle reminders
      </Button>
    </Panel>
  );
}

function NeedsPersonPanel({ data }: { data: DashboardData }) {
  const { toast } = useToast();
  const p = data.needsPerson;
  return (
    <Panel>
      <SectionTitle
        icon={<HeartHandshake className="size-4 text-[var(--color-critical)]" />}
        title="Someone who needs a person"
      />
      <p className="mt-2 text-sm font-semibold text-ink">
        {p.name} · {p.age}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{p.note}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => toast(`Calling ${p.name}…`, "success")}>
          <PhoneCall className="size-3.5" /> Call now
        </Button>
        <Link href={`/staff/patients/${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">
          Open record
        </Link>
      </div>
    </Panel>
  );
}

/**
 * Derives the greeting from the server-provided snapshot timestamp (identical on
 * SSR and client) rather than a live `new Date()` clock, which would differ
 * between the server render and client hydration and trip a hydration mismatch.
 */
function greeting(at: string): string {
  const hour = new Date(at).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string): string {
  return name.replace(/^Dr\.?\s+/i, "").split(/\s+/)[0];
}
