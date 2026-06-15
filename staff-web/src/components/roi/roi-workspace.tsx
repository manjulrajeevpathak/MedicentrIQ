"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeIndianRupee,
  FileText,
  Fingerprint,
  Link2,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound
} from "lucide-react";
import type { AttributionRow, RoiData } from "@/lib/roi";
import { formatInrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile, StatGrid } from "@/components/ui/stat";
import { CountUp } from "@/components/ui/count-up";
import { AreaChart, BarList, Donut } from "@/components/ui/charts";

const stageMeta: Record<AttributionRow["stage"], { label: string; tone: "brand" | "medium" | "good" }> = {
  recommended: { label: "Recommended", tone: "medium" },
  actioned: { label: "Actioned", tone: "brand" },
  converted: { label: "Back in care", tone: "good" },
  observed: { label: "Outcome observed", tone: "good" }
};

export function RoiWorkspace({ data }: { data: RoiData }) {
  const k = data.kpis;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <BadgeIndianRupee className="size-4" />
          <span>{data.period} · {data.branch}</span>
          <Badge tone={data.source === "mock" ? "high" : "good"} dot>
            {data.source === "mock" ? "Modelled demo" : "Live attribution"}
          </Badge>
        </div>
        <Link href="/roi-report" target="_blank">
          <Button>
            <Printer className="size-4" /> Open board report
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <StatGrid cols={4} className="stagger">
        <StatTile
          label="Care continuity maintained"
          value={<CountUp value={k.recovered} format={formatInrCompact} />}
          icon={<TrendingUp className="size-4" />}
          tone="good"
          delta={k.recoveredDelta.split(" ")[0]}
          deltaTone="good"
        />
        <StatTile
          label="Attribution rate"
          value={<CountUp value={k.attributionRate} format={(v) => `${Math.round(v)}%`} />}
          icon={<Fingerprint className="size-4" />}
          tone="brand"
        />
        <StatTile
          label="AI-initiated share"
          value={<CountUp value={k.aiDrivenShare} format={(v) => `${Math.round(v)}%`} />}
          icon={<Sparkles className="size-4" />}
          tone="brand"
        />
        <StatTile
          label="Care continuity at risk"
          value={<CountUp value={k.outstandingLeakage} format={formatInrCompact} />}
          icon={<TrendingDown className="size-4" />}
          tone="risk"
        />
      </StatGrid>

      {/* Trend + splits */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle
            icon={<TrendingUp className="size-4" />}
            title="Care continuity maintained trend"
            subtitle="Monthly, attributed care recoveries only"
          />
          <div className="mt-4">
            <AreaChart data={data.monthlyRecovered.values} color="var(--color-good)" height={190} formatValue={formatInrCompact} />
            <div className="mt-1 flex justify-between px-1 text-[10px] text-ink-faint">
              {data.monthlyRecovered.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel>
            <SectionTitle icon={<Sparkles className="size-4" />} title="Who initiated" subtitle="Share of care continuity ₹" />
            <Donut
              className="mt-4"
              size={120}
              segments={data.bySource}
              centerLabel={formatInrCompact(k.recovered)}
              centerSub="in care"
            />
          </Panel>
          <Panel>
            <SectionTitle icon={<TrendingDown className="size-4" />} title="By category" />
            <BarList
              className="mt-4"
              data={data.byCategory.map((c) => ({ label: c.label, value: c.recovered, sub: `${formatInrCompact(c.atRisk)} continuity still at risk · ${c.items} open` }))}
              formatValue={formatInrCompact}
            />
          </Panel>
        </div>
      </div>

      {/* Attribution ledger */}
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
          <SectionTitle
            icon={<Link2 className="size-4" />}
            title="Attribution ledger"
            subtitle="Every patient kept in care, with its evidence chain"
          />
          <Badge tone="good">{data.ledger.length} entries · {formatInrCompact(data.ledger.reduce((s, r) => s + r.value, 0))}</Badge>
        </div>
        <ul className="divide-y divide-line">
          {data.ledger.map((row) => (
            <LedgerRow key={row.id} row={row} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function LedgerRow({ row }: { row: AttributionRow }) {
  const stage = stageMeta[row.stage];
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{row.patient}</span>
          {row.source === "ai" ? (
            <Badge tone="brand"><Sparkles className="size-3" /> AI-initiated</Badge>
          ) : (
            <Badge tone="neutral"><UserRound className="size-3" /> Staff</Badge>
          )}
          <Badge tone="neutral">{row.category}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-soft">{row.action}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {row.evidence.map((ref) => (
            <span key={ref} className="inline-flex items-center gap-1 rounded-md bg-fill px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              <FileText className="size-2.5" /> {ref}
            </span>
          ))}
          <span className="text-[10px] text-ink-faint">· {row.actor}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-base font-semibold tabular-nums tracking-tight text-[var(--color-good)]">
          {formatInrCompact(row.value)}
        </span>
        <Badge tone={stage.tone} dot>{stage.label}</Badge>
        <span className={cn("inline-flex items-center gap-1 text-[10px] text-ink-faint")}>
          <ArrowUpRight className="size-3" /> {row.date}
        </span>
      </div>
    </li>
  );
}
