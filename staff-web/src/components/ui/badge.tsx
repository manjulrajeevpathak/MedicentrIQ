import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { QueuePriority } from "@/lib/types";

type BadgeTone = "neutral" | "brand" | "critical" | "high" | "medium" | "low" | "good" | "violet" | "outline";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-fill text-ink-soft ring-black/5 dark:ring-white/10",
  brand: "bg-brand-50 text-brand-700 ring-black/5 dark:ring-white/10",
  critical: "bg-[var(--color-critical-soft)] text-[var(--color-critical)] ring-black/5 dark:ring-white/10",
  high: "bg-[var(--color-high-soft)] text-[var(--color-high)] ring-black/5 dark:ring-white/10",
  medium: "bg-[var(--color-medium-soft)] text-[var(--color-medium)] ring-black/5 dark:ring-white/10",
  low: "bg-[var(--color-low-soft)] text-[var(--color-low)] ring-black/5 dark:ring-white/10",
  good: "bg-[var(--color-good-soft)] text-[var(--color-good)] ring-black/5 dark:ring-white/10",
  violet: "bg-violet-50 text-violet-700 ring-black/5 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-white/10",
  outline: "bg-surface text-ink-soft ring-line-strong"
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const priorityLabel: Record<QueuePriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low"
};

export function PriorityBadge({ priority, className }: { priority: QueuePriority; className?: string }) {
  return (
    <Badge tone={priority} dot className={cn("capitalize", className)}>
      {priorityLabel[priority]}
    </Badge>
  );
}

export function RiskDot({ priority, className }: { priority: QueuePriority; className?: string }) {
  const color: Record<QueuePriority, string> = {
    critical: "bg-[var(--color-critical)]",
    high: "bg-[var(--color-high)]",
    medium: "bg-[var(--color-medium)]",
    low: "bg-[var(--color-low)]"
  };
  return <span className={cn("inline-block size-2 rounded-full", color[priority], className)} />;
}
