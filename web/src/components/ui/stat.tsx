import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTone = "brand" | "good" | "high" | "risk" | "neutral" | "violet";

const toneClass: Record<StatTone, string> = {
  brand: "text-brand-600 bg-brand-50",
  good: "text-[var(--color-good)] bg-[var(--color-good-soft)]",
  high: "text-[var(--color-high)] bg-[var(--color-high-soft)]",
  risk: "text-[var(--color-critical)] bg-[var(--color-critical-soft)]",
  violet: "text-violet-600 bg-violet-50",
  neutral: "text-ink-soft bg-fill"
};

export function StatTile({
  label,
  value,
  icon,
  tone = "brand",
  delta,
  deltaTone,
  className
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  delta?: string;
  deltaTone?: "good" | "risk" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("surface-card flex items-center gap-3 p-3.5", className)}>
      {icon ? <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}>{icon}</span> : null}
      <div className="min-w-0">
        <p className="truncate text-xl font-semibold tabular-nums leading-tight tracking-tight text-ink">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{label}</p>
      </div>
      {delta ? (
        <span
          className={cn(
            "ml-auto shrink-0 text-[11px] font-semibold tabular-nums",
            deltaTone === "good" ? "text-[var(--color-good)]" : deltaTone === "risk" ? "text-[var(--color-critical)]" : "text-ink-muted"
          )}
        >
          {delta}
        </span>
      ) : null}
    </div>
  );
}

export function StatGrid({ children, className, cols = 4 }: { children: ReactNode; className?: string; cols?: 3 | 4 | 5 }) {
  const colClass = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" }[cols];
  return <div className={cn("grid grid-cols-2 gap-3", colClass, className)}>{children}</div>;
}
