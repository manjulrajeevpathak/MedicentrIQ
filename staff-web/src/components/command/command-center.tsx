"use client";

import { useState } from "react";
import {
  BadgeIndianRupee,
  CalendarCheck,
  Clock,
  Filter,
  Gauge,
  GitBranch,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics";
import { formatInrCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile, StatGrid } from "@/components/ui/stat";
import { CountUp } from "@/components/ui/count-up";
import { Segmented } from "@/components/ui/segmented";
import { Sparkline } from "@/components/ui/sparkline";
import { AreaChart, BarList, Donut, Funnel, Heatmap, ProgressRing, Waterfall, chartPalette } from "@/components/ui/charts";

type Trend = "bookings" | "recovered" | "noShow";

const pct = (v: number) => `${Math.round(v)}%`;

export function CommandCenter({ data }: { data: AnalyticsData }) {
  const [trend, setTrend] = useState<Trend>("recovered");
  const k = data.kpis;

  const trendConfig: Record<Trend, { color: string; label: string }> = {
    bookings: { color: "var(--color-brand-500)", label: "Bookings" },
    recovered: { color: "var(--color-good)", label: "Care continuity maintained" },
    noShow: { color: "var(--color-critical)", label: "No-show rate" }
  };

  return (
    <div className="space-y-5">
      {/* Period bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Filter className="size-4" />
          <span>{data.period}</span>
          <Badge tone={data.source === "mock" ? "high" : "good"} dot>
            {data.source === "mock" ? "Modelled demo" : "Live"}
          </Badge>
        </div>
        <Segmented
          value="30d"
          onChange={() => undefined}
          size="sm"
          options={[
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "qtr", label: "Quarter" }
          ]}
        />
      </div>

      {/* KPIs */}
      <StatGrid cols={4} className="md:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Care continuity maintained" value={<CountUp value={k.revenueRecovered} format={formatInrCompact} />} icon={<BadgeIndianRupee className="size-4" />} tone="good" delta="+18%" deltaTone="good" />
        <StatTile label="Care continuity at risk" value={<CountUp value={k.revenueAtRisk} format={formatInrCompact} />} icon={<TrendingDown className="size-4" />} tone="risk" />
        <StatTile label="Lead care completion" value={<CountUp value={k.leadConversion} format={pct} />} icon={<TrendingUp className="size-4" />} tone="brand" delta="+4pt" deltaTone="good" />
        <StatTile label="Follow-up done" value={<CountUp value={k.followUpCompletion} format={pct} />} icon={<CalendarCheck className="size-4" />} tone="brand" />
        <StatTile label="No-show rate" value={<CountUp value={k.noShowRate} format={pct} />} icon={<Users className="size-4" />} tone="high" delta="-3pt" deltaTone="good" />
        <StatTile label="First response" value={<CountUp value={k.avgFirstResponseMins} format={(v) => `${Math.round(v)}m`} />} icon={<Clock className="size-4" />} tone="neutral" />
      </StatGrid>

      {/* Funnel + Waterfall */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel>
          <SectionTitle icon={<Users className="size-4" />} title="Patient care funnel" subtitle="Request → in care, with step care completion" />
          <Funnel className="mt-4" stages={data.funnel} />
        </Panel>
        <Panel>
          <SectionTitle icon={<TrendingDown className="size-4" />} title="Care gaps waterfall" subtitle="Where care continuity is lost & restored" />
          <Waterfall className="mt-5" items={data.leakageWaterfall} />
        </Panel>
      </div>

      {/* Trend + channels */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle
            icon={<Gauge className="size-4" />}
            title="Operating trend"
            subtitle="Rolling 12 periods"
            action={
              <Segmented
                value={trend}
                onChange={(v) => setTrend(v as Trend)}
                size="sm"
                options={[
                  { value: "recovered", label: "Continuity" },
                  { value: "bookings", label: "Bookings" },
                  { value: "noShow", label: "No-show" }
                ]}
              />
            }
          />
          <div className="mt-4">
            <AreaChart data={data.trends[trend]} color={trendConfig[trend].color} height={200} />
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={<Filter className="size-4" />} title="Channel mix" subtitle="Patients into care by channel" />
          <Donut
            className="mt-4"
            segments={data.channels.map((c, i) => ({ label: c.channel, value: c.converted, color: chartPalette[i % chartPalette.length] }))}
            centerLabel={formatNumber(data.channels.reduce((s, c) => s + c.converted, 0))}
            centerSub="in care"
          />
        </Panel>
      </div>

      {/* Doctor performance + retention */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" padded={false}>
          <div className="p-5 pb-3">
            <SectionTitle icon={<Stethoscope className="size-4" />} title="Doctor performance" subtitle="Bookings, care completion, no-show & revenue" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-muted text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-2 font-semibold">Doctor</th>
                  <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-3 py-2 text-right font-semibold">Care completion</th>
                  <th className="px-3 py-2 text-right font-semibold">No-show</th>
                  <th className="px-5 py-2 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.doctors.map((doc) => (
                  <tr key={doc.name} className="transition-colors hover:bg-surface-muted">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-ink">{doc.name}</p>
                      <p className="text-[11px] text-ink-muted">{doc.detail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{doc.bookings}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn("font-semibold tabular-nums", doc.conversion >= 50 ? "text-[var(--color-good)]" : "text-ink")}>{doc.conversion}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn("tabular-nums", doc.noShow >= 20 ? "text-[var(--color-critical)]" : "text-ink-soft")}>{doc.noShow}%</span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">{formatInrCompact(doc.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={<TrendingDown className="size-4" />} title="Patient retention curve" subtitle="Patient retention over weeks" />
          <div className="mt-4">
            <AreaChart data={data.retention.values} color="var(--color-brand-500)" height={150} formatValue={(v) => `${v}%`} />
            <div className="mt-1 flex justify-between px-1 text-[10px] text-ink-faint">
              {data.retention.labels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Cohort patient retention</p>
            <Heatmap rows={data.retentionCohorts.rows} cols={data.retentionCohorts.cols} values={data.retentionCohorts.values} />
          </div>
        </Panel>
      </div>

      {/* Branch rollup + SLA heatmap */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle icon={<GitBranch className="size-4" />} title="Branch rollup" subtitle="Cross-branch benchmarking" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.branches.map((branch) => (
              <div key={branch.branch} className="rounded-xl border border-line p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{branch.branch}</p>
                  <Badge tone={branch.noShow <= 18 ? "good" : branch.noShow >= 25 ? "critical" : "high"}>{branch.noShow}% no-show</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressRing value={branch.leadConversion} size={56} label="care" />
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-ink-muted">Continuity</span>
                      <span className="text-sm font-semibold tabular-nums text-ink">{formatInrCompact(branch.revenueRecovered)}</span>
                    </div>
                    <Sparkline data={branch.trend} className="mt-1 text-[var(--color-good)]" stroke="var(--color-good)" width={140} height={26} />
                    <p className="mt-0.5 text-[10px] text-ink-faint">Follow-up {branch.followUpCompletion}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={<Clock className="size-4" />} title="SLA adherence" subtitle="First-response by day & hour" />
          <div className="mt-4 flex justify-center">
            <Heatmap rows={data.slaHeatmap.rows} cols={data.slaHeatmap.cols} values={data.slaHeatmap.values} />
          </div>
          <p className="mt-3 text-center text-[11px] text-ink-muted">Darker = better SLA adherence. Saturday evenings need staffing.</p>
        </Panel>
      </div>
    </div>
  );
}
