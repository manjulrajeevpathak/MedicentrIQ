"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Link2,
  MapPin,
  Sparkles,
  Stethoscope,
  TriangleAlert
} from "lucide-react";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import type { AccessQueueItem, AccessSlot, PermissionKey } from "@/lib/types";
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
import { ChannelIcon } from "@/components/common/channel";
import { ActionButton } from "@/components/common/action-button";

export function AccessWorkspace() {
  const { data, holdSlot, confirmAppointment, sendMobileLink, patientIdByName } = useApp();
  const { activeUser } = data.authContext;
  const has = (key: PermissionKey) => activeUser.permissions.includes(key);
  const canWrite = has("appointment:write");

  const { selectedId, select, clear, hasSelection } = useSelection(data.accessQueue[0]?.id);
  const selected = data.accessQueue.find((r) => r.id === selectedId) ?? data.accessQueue[0];
  const [slotId, setSlotId] = useState<string>(selected?.slots?.[0]?.id ?? "");

  const summary = useMemo(() => {
    const high = data.accessQueue.filter((r) => r.risk === "critical" || r.risk === "high").length;
    const avgNoShow = Math.round(
      data.accessQueue.reduce((sum, r) => sum + (r.noShowRisk ?? 0), 0) / Math.max(1, data.accessQueue.length)
    );
    return { total: data.accessQueue.length, high, avgNoShow };
  }, [data.accessQueue]);

  const selectRequest = (request: AccessQueueItem) => {
    select(request.id);
    setSlotId(request.slots?.[0]?.id ?? "");
  };

  const patientId = patientIdByName(selected?.patient ?? "");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open requests" value={summary.total} icon={<CalendarClock className="size-4" />} />
        <StatTile label="High urgency" value={summary.high} tone="high" icon={<TriangleAlert className="size-4" />} />
        <StatTile label="Avg no-show risk" value={`${summary.avgNoShow}%`} tone="risk" icon={<CircleDashed className="size-4" />} />
        <StatTile label="Branches" value={new Set(data.accessQueue.map((r) => r.branch)).size} icon={<MapPin className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Request board */}
        <Panel padded={false} className={cn("flex max-h-[calc(100dvh-12rem)] flex-col", hasSelection && "hidden lg:flex")}>
          <div className="border-b border-line p-4">
            <SectionTitle icon={<CalendarDays className="size-4" />} title="Access requests" subtitle="Intake, routing & booking" />
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {data.accessQueue.map((request) => (
              <li key={request.id}>
                <button
                  onClick={() => selectRequest(request)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors",
                    request.id === selected?.id ? "bg-brand-50" : "hover:bg-surface-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {request.channel ? <ChannelIcon channel={request.channel} /> : null}
                      <div>
                        <p className="text-sm font-semibold text-ink">{request.patient}</p>
                        <p className="text-[11px] text-ink-muted">{request.branch} · {request.doctor}</p>
                      </div>
                    </div>
                    {request.state ? <AccessStateBadge state={request.state} /> : <PriorityBadge priority={request.risk} />}
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">{request.request}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                      <CalendarClock className="size-3" /> {request.slot}
                    </span>
                    {typeof request.noShowRisk === "number" ? (
                      <span className="text-[11px] font-medium text-ink-muted">No-show {request.noShowRisk}%</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
            {data.accessQueue.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-5" />} title="No open requests" description="New access requests will appear here." />
            ) : null}
          </ul>
        </Panel>

        {/* Booking cockpit */}
        {selected ? (
          <div className={cn("space-y-5", !hasSelection && "hidden lg:block")}>
            <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden">
              <ArrowLeft className="size-4" /> All requests
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
                      {selected.state ? <AccessStateBadge state={selected.state} /> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{selected.request}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-soft">
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-ink-faint" /> {selected.branch}</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope className="size-3.5 text-ink-faint" /> {selected.doctor}</span>
                      {patientId ? (
                        <Link href={`/patients/${patientId}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                          <UserRound className="size-3.5" /> Patient 360
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
                {typeof selected.noShowRisk === "number" ? (
                  <div className="w-40 rounded-xl bg-surface-muted p-3">
                    <p className="text-[11px] font-medium text-ink-muted">No-show risk</p>
                    <Meter value={selected.noShowRisk} className="mt-1.5" tone={selected.noShowRisk > 40 ? "critical" : "high"} showLabel />
                  </div>
                ) : null}
              </div>

              {selected.blocker ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--color-high-soft)] p-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-high)]" />
                  <p className="text-xs text-ink-soft"><span className="font-semibold text-ink">Blocker:</span> {selected.blocker}</p>
                </div>
              ) : null}
            </Panel>

            {/* Slots */}
            <Panel padded={false}>
              <div className="p-5 pb-3">
                <SectionTitle icon={<CalendarClock className="size-4" />} title="Available slots" subtitle="Select, hold and confirm" />
              </div>
              <div className="px-5">
                {selected.slots && selected.slots.length ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selected.slots.map((slot) => (
                      <SlotOption key={slot.id} slot={slot} selected={slot.id === slotId} onSelect={() => setSlotId(slot.id)} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={<CalendarClock className="size-5" />} title="No slots yet" description="Resolve identity and route before booking." />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
                <ActionButton action={{ type: "hold_access_slot", id: selected.id }} userId={activeUser.id} icon={<CircleDashed className="size-3.5" />} permitted={canWrite} restrictedReason="Appointment write permission required." onSuccess={() => holdSlot(selected.id)}>
                  Hold slot
                </ActionButton>
                <ActionButton action={{ type: "confirm_appointment", id: selected.id }} userId={activeUser.id} variant="primary" icon={<CheckCircle2 className="size-3.5" />} permitted={canWrite} restrictedReason="Appointment write permission required." onSuccess={() => confirmAppointment(selected.id)}>
                  Confirm appointment
                </ActionButton>
                <ActionButton action={{ type: "send_mobile_link", id: selected.id }} userId={activeUser.id} variant="secondary" icon={<Link2 className="size-3.5" />} permitted={canWrite} restrictedReason="Appointment write permission required." onSuccess={() => sendMobileLink(selected.id)}>
                  Send mobile link
                </ActionButton>
              </div>
            </Panel>

            {/* AI guidance */}
            <Panel className="ai-surface">
              <SectionTitle icon={<Sparkles className="size-4" />} title="AI access guidance" />
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {guidance(selected)}
              </p>
            </Panel>
          </div>
        ) : (
          <Panel>
            <EmptyState icon={<CalendarClock className="size-5" />} title="Select a request" />
          </Panel>
        )}
      </div>
    </div>
  );
}

function SlotOption({ slot, selected, onSelect }: { slot: AccessSlot; selected: boolean; onSelect: () => void }) {
  const statusTone: Record<AccessSlot["status"], string> = {
    open: "text-[var(--color-good)] bg-[var(--color-good-soft)]",
    held: "text-[var(--color-high)] bg-[var(--color-high-soft)]",
    limited: "text-[var(--color-medium)] bg-[var(--color-medium-soft)]"
  };
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border p-3 text-left transition",
          selected ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100" : "border-line hover:border-line-strong hover:bg-surface-muted"
        )}
      >
        <div>
          <p className="text-sm font-semibold text-ink">{slot.label}</p>
          <p className="text-[11px] text-ink-muted">{slot.doctor} · {slot.branch}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", statusTone[slot.status])}>{slot.status}</span>
      </button>
    </li>
  );
}

function AccessStateBadge({ state }: { state: NonNullable<AccessQueueItem["state"]> }) {
  const config = {
    open: { label: "Open", tone: "neutral" as const },
    held: { label: "Slot held", tone: "high" as const },
    confirmed: { label: "Confirmed", tone: "good" as const },
    link_sent: { label: "Link sent", tone: "brand" as const }
  }[state];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

function guidance(request: AccessQueueItem): string {
  if ((request.noShowRisk ?? 0) > 45) {
    return `Elevated no-show risk (${request.noShowRisk}%). Recommend a confirmed mobile link plus a same-day reminder call. ${request.blocker}`;
  }
  if (request.slots && request.slots.some((s) => s.status === "held")) {
    return `A slot is currently held for ${request.patient}. Confirm within the hold window and send the mobile link to lock attendance.`;
  }
  return `Route ${request.patient} to ${request.doctor} at ${request.branch}. Clear the blocker, then confirm and share a mobile confirmation link in the patient's language.`;
}
