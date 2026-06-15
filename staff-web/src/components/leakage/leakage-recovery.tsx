"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, BadgeIndianRupee, CircleDollarSign, Clock, HandCoins, Target, TrendingDown } from "lucide-react";
import type { AnalyticsData, LeakageWorkItem } from "@/lib/analytics";
import { formatInrCompact } from "@/lib/format";
import { useApp } from "@/lib/store";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { StatTile, StatGrid } from "@/components/ui/stat";
import { CountUp } from "@/components/ui/count-up";
import { Meter } from "@/components/ui/meter";
import { Segmented } from "@/components/ui/segmented";
import { Sparkline } from "@/components/ui/sparkline";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/common/action-button";

type Sort = "value" | "age" | "risk";
const riskRank = { critical: 0, high: 1, medium: 2, low: 3 };

export function LeakageRecovery({ data, userId, canRecover }: { data: AnalyticsData; userId: string; canRecover: boolean }) {
  const { patientIdByName } = useApp();
  const [sort, setSort] = useState<Sort>("value");
  const [recovered, setRecovered] = useState<Set<string>>(new Set());

  const recoveryRate = Math.round((data.kpis.revenueRecovered / (data.kpis.revenueRecovered + data.kpis.revenueAtRisk)) * 100);

  const open = useMemo(() => data.worklist.filter((i) => !recovered.has(i.id)), [data.worklist, recovered]);

  const worklist = useMemo(() => {
    const items = [...open];
    if (sort === "value") items.sort((a, b) => b.value - a.value);
    if (sort === "age") items.sort((a, b) => b.ageDays - a.ageDays);
    if (sort === "risk") items.sort((a, b) => riskRank[a.risk] - riskRank[b.risk]);
    return items;
  }, [open, sort]);

  const worklistTotal = open.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <StatTile label="Care continuity at risk" value={<CountUp value={data.kpis.revenueAtRisk} format={formatInrCompact} />} icon={<TrendingDown className="size-4" />} tone="risk" />
        <StatTile label="Care continuity maintained (30d)" value={<CountUp value={data.kpis.revenueRecovered} format={formatInrCompact} />} icon={<HandCoins className="size-4" />} tone="good" delta="+18%" deltaTone="good" />
        <StatTile label="Continuity rate" value={<CountUp value={recoveryRate} format={(v) => `${Math.round(v)}%`} />} icon={<Target className="size-4" />} tone="brand" />
        <StatTile label="Open worklist" value={<><CountUp value={open.length} /> · {formatInrCompact(worklistTotal)}</>} icon={<CircleDollarSign className="size-4" />} tone="high" />
      </StatGrid>

      {/* Leakage categories */}
      <Panel padded={false}>
        <div className="p-5 pb-3">
          <SectionTitle icon={<TrendingDown className="size-4" />} title="Care gaps by category" subtitle="At risk vs kept in care this period" />
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl bg-line sm:grid-cols-2 lg:grid-cols-4">
          {data.leakageCategories.map((category) => {
            const rate = Math.round((category.recovered / (category.recovered + category.atRisk)) * 100);
            return (
              <div key={category.id} className="bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{category.label}</p>
                  <Sparkline data={category.trend} className="text-[var(--color-good)]" stroke="var(--color-good)" width={48} height={20} />
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-critical)]">{formatInrCompact(category.atRisk)}</p>
                <p className="text-[11px] text-ink-muted">continuity at risk · {category.count} items</p>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-ink-muted">Kept in care {formatInrCompact(category.recovered)}</span>
                    <span className="font-semibold text-[var(--color-good)]">{rate}%</span>
                  </div>
                  <Meter value={rate} tone="good" />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Worklist */}
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <SectionTitle icon={<BadgeIndianRupee className="size-4" />} title="Care recovery worklist" subtitle="Each item priced, owned and actionable" />
          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow className="size-3.5 text-ink-faint" />
            <Segmented
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              size="sm"
              options={[
                { value: "value", label: "Value" },
                { value: "age", label: "Age" },
                { value: "risk", label: "Risk" }
              ]}
            />
          </div>
        </div>
        <ul className="divide-y divide-line">
          {worklist.map((item) => (
            <WorklistRow
              key={item.id}
              item={item}
              userId={userId}
              canRecover={canRecover}
              patientHref={patientIdByName(item.patient) ? `/patients/${patientIdByName(item.patient)}` : undefined}
              onRecover={() => setRecovered((s) => new Set(s).add(item.id))}
            />
          ))}
          {worklist.length === 0 ? (
            <EmptyState icon={<HandCoins className="size-5" />} title="Worklist cleared" description="Every patient at risk has been brought back into care — nice work." />
          ) : null}
        </ul>
      </Panel>
    </div>
  );
}

function WorklistRow({
  item,
  userId,
  canRecover,
  patientHref,
  onRecover
}: {
  item: LeakageWorkItem;
  userId: string;
  canRecover: boolean;
  patientHref?: string;
  onRecover: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted sm:flex-nowrap">
      <Avatar name={item.patient} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {patientHref ? (
            <Link href={patientHref} className="text-sm font-semibold text-ink hover:text-brand-700 hover:underline">
              {item.patient}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-ink">{item.patient}</span>
          )}
          <PriorityBadge priority={item.risk} />
          <Badge tone="neutral">{item.category}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{item.action}</p>
        <p className="mt-0.5 text-[11px] text-ink-faint">Owner: {item.owner} · open {item.ageDays}d</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums text-ink">{formatInrCompact(item.value)}</p>
          <p className="inline-flex items-center gap-1 text-[11px] text-ink-faint"><Clock className="size-3" /> {item.ageDays}d</p>
        </div>
        <ActionButton
          action={{ type: "start_follow_up", id: item.id, patientName: item.patient }}
          userId={userId}
          variant="primary"
          icon={<HandCoins className="size-3.5" />}
          permitted={canRecover}
          restrictedReason="Follow-up manage permission required to bring patients back into care."
          onSuccess={onRecover}
        >
          Bring back into care
        </ActionButton>
      </div>
    </li>
  );
}
