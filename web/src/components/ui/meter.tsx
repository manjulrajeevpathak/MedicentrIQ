import { cn } from "@/lib/utils";

/** Confidence / progress meter with tone derived from value. */
export function Meter({
  value,
  className,
  tone,
  showLabel = false
}: {
  value: number;
  className?: string;
  tone?: "brand" | "good" | "high" | "critical";
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const resolvedTone = tone ?? (clamped >= 80 ? "good" : clamped >= 60 ? "brand" : clamped >= 40 ? "high" : "critical");
  const barColor: Record<string, string> = {
    brand: "bg-brand-500",
    good: "bg-[var(--color-good)]",
    high: "bg-[var(--color-high)]",
    critical: "bg-[var(--color-critical)]"
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor[resolvedTone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink-soft">{clamped}%</span> : null}
    </div>
  );
}
