import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/types";
import { Sparkline } from "@/components/ui/sparkline";

const toneConfig = {
  good: { text: "text-[var(--color-good)]", stroke: "var(--color-good)", Icon: ArrowUpRight },
  watch: { text: "text-[var(--color-high)]", stroke: "var(--color-high)", Icon: Minus },
  risk: { text: "text-[var(--color-critical)]", stroke: "var(--color-critical)", Icon: ArrowDownRight }
} as const;

export function MetricCard({ metric }: { metric: Metric }) {
  const config = toneConfig[metric.tone];
  const { Icon } = config;

  return (
    <div className="surface-card group flex flex-col justify-between p-4 transition-shadow hover:shadow-[0_4px_24px_rgba(15,27,51,0.08)]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-muted">{metric.label}</p>
        {metric.trend ? (
          <Sparkline data={metric.trend} className={config.text} stroke={config.stroke} width={64} height={22} />
        ) : null}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-semibold tracking-tight text-ink tabular-nums">{metric.value}</p>
        <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", config.text)}>
          <Icon className="size-3.5" />
          <span className="text-ink-soft">{metric.delta}</span>
        </div>
      </div>
    </div>
  );
}
