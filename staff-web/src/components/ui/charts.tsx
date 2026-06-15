import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Dependency-free SVG chart kit — themeable via CSS color strings, pure
   (no hooks) so charts render on the server. Deterministic ids (no random).
   ------------------------------------------------------------------------- */

// Monochrome blue → slate ramp. Calm and in-family; categorical distinction
// comes from ordered tints rather than competing hues. Reserve saturated
// semantic color (green/red) for waterfall-style charts where it means something.
export const chartPalette = [
  "var(--color-brand-500)",
  "var(--color-brand-300)",
  "var(--color-brand-700)",
  "#9db8e4",
  "#c7d6ee",
  "#7c8aa3",
  "#aeb9cb"
];

function uid(prefix: string, seed: string | number): string {
  return `${prefix}-${String(seed).replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
}

function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

/* ----------------------------------- Area / line ------------------------- */
export function AreaChart({
  data,
  labels,
  color = "var(--color-brand-500)",
  height = 180,
  className,
  formatValue
}: {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const width = 600;
  const padX = 8;
  const padTop = 16;
  const padBottom = labels ? 22 : 10;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (data.length - 1 || 1);
  const points = data.map((value, index) => [padX + index * stepX, padTop + (height - padTop - padBottom) * (1 - (value - min) / range)] as const);
  const line = smoothPath(points);
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height - padBottom} L${points[0][0].toFixed(1)} ${height - padBottom} Z`;
  const id = uid("area", data.join("") + color);
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", className)} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={padX} x2={width - padX} y1={padTop + (height - padTop - padBottom) * g} y2={padTop + (height - padTop - padBottom) * g} stroke="var(--color-line)" strokeWidth={1} strokeDasharray="3 4" />
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
      {formatValue ? (
        <text x={last[0]} y={Math.max(12, last[1] - 8)} textAnchor="end" className="fill-ink text-[11px] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatValue(data[data.length - 1])}
        </text>
      ) : null}
    </svg>
  );
}

/* ----------------------------------- Columns ----------------------------- */
export function ColumnChart({
  data,
  height = 180,
  color = "var(--color-brand-500)",
  className
}: {
  data: Array<{ label: string; value: number; tone?: string }>;
  height?: number;
  color?: string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height }}>
      {data.map((bar) => (
        <div key={bar.label} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-ink-muted opacity-0 transition group-hover:opacity-100">{bar.value}</span>
          <div className="w-full overflow-hidden rounded-md" style={{ height: `${Math.max(2, (bar.value / max) * (height - 28))}px` }}>
            <div className="h-full w-full rounded-md transition-opacity group-hover:opacity-80" style={{ background: bar.tone ?? color }} />
          </div>
          <span className="truncate text-[10px] text-ink-faint">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------- Ranked bar list --------------------- */
export function BarList({
  data,
  className,
  formatValue = (v) => String(v)
}: {
  data: Array<{ label: string; value: number; sub?: string; color?: string }>;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className={cn("space-y-2.5", className)}>
      {data.map((row, index) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-ink">{row.label}</span>
            <span className="shrink-0 tabular-nums text-ink-soft">{formatValue(row.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(row.value / max) * 100}%`, background: row.color ?? chartPalette[index % chartPalette.length] }} />
          </div>
          {row.sub ? <p className="mt-0.5 text-[10px] text-ink-faint">{row.sub}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------- Donut ------------------------------- */
export function Donut({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerSub,
  className
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
          {segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const el = (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return el;
          })}
        </svg>
        {centerLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tracking-tight text-ink">{centerLabel}</span>
            {centerSub ? <span className="text-[11px] text-ink-muted">{centerSub}</span> : null}
          </div>
        ) : null}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="truncate text-ink-soft">{segment.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{Math.round((segment.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------- Funnel ------------------------------ */
export function Funnel({
  stages,
  className,
  formatValue = (v) => v.toLocaleString("en-IN")
}: {
  stages: Array<{ label: string; value: number }>;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  const top = stages[0]?.value || 1;
  return (
    <div className={cn("space-y-1.5", className)}>
      {stages.map((stage, index) => {
        const pct = (stage.value / top) * 100;
        const stepConv = index === 0 ? 100 : (stage.value / stages[index - 1].value) * 100;
        return (
          <div key={stage.label} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">{stage.label}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-ink-soft">{formatValue(stage.value)}</span>
                {index > 0 ? (
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", stepConv >= 70 ? "bg-[var(--color-good-soft)] text-[var(--color-good)]" : stepConv >= 40 ? "bg-[var(--color-high-soft)] text-[var(--color-high)]" : "bg-[var(--color-critical-soft)] text-[var(--color-critical)]")}>
                    {Math.round(stepConv)}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-8 overflow-hidden rounded-lg bg-fill">
              <div
                className="flex h-full items-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------- Waterfall --------------------------- */
export function Waterfall({
  items,
  className,
  formatValue = (v) => `₹${Math.abs(v).toLocaleString("en-IN")}`
}: {
  items: Array<{ label: string; value: number; kind: "total" | "loss" | "gain" }>;
  className?: string;
  formatValue?: (value: number) => string;
}) {
  // Compute running cumulative for non-total bars; totals are absolute from 0.
  let running = 0;
  const max = items.reduce((m, item) => {
    if (item.kind === "total") return Math.max(m, item.value);
    running += item.value;
    return Math.max(m, running, Math.abs(item.value));
  }, 1);
  running = 0;

  const toneFor = (kind: string) => (kind === "total" ? "var(--color-brand-500)" : kind === "gain" ? "var(--color-good)" : "var(--color-critical)");

  return (
    <div className={cn("flex items-end gap-2", className)} style={{ height: 200 }}>
      {items.map((item) => {
        let barBottom: number;
        let barHeight: number;
        if (item.kind === "total") {
          barBottom = 0;
          barHeight = (item.value / max) * 160;
          running = item.value;
        } else {
          const start = running;
          running += item.value;
          const lo = Math.min(start, running);
          barBottom = (lo / max) * 160;
          barHeight = (Math.abs(item.value) / max) * 160;
        }
        return (
          <div key={item.label} className="group flex flex-1 flex-col items-center justify-end" style={{ height: 200 }}>
            <span className="mb-1 text-[10px] font-semibold tabular-nums text-ink-soft">{formatValue(item.value)}</span>
            <div className="flex w-full flex-col justify-end" style={{ height: 168 }}>
              <div className="w-full rounded-md transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(3, barHeight)}px`, marginBottom: `${barBottom}px`, background: toneFor(item.kind) }} />
            </div>
            <span className="mt-1 max-w-full truncate text-[10px] text-ink-faint" title={item.label}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------- Heatmap ----------------------------- */
export function Heatmap({
  rows,
  cols,
  values,
  className
}: {
  rows: string[];
  cols: string[];
  values: number[][]; // rows x cols, 0..100
  className?: string;
}) {
  const shade = (v: number) => {
    const alpha = 0.08 + (v / 100) * 0.85;
    return `color-mix(in srgb, var(--color-brand-500) ${Math.round(alpha * 100)}%, var(--color-surface))`;
  };
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row}>
              <td className="pr-2 text-right align-middle text-[10px] font-medium text-ink-muted">{row}</td>
              {cols.map((col, c) => (
                <td key={col} title={`${row} ${col}: ${values[r]?.[c] ?? 0}`}>
                  <div className="size-6 rounded-[5px] ring-1 ring-inset ring-black/5 dark:ring-white/10" style={{ background: shade(values[r]?.[c] ?? 0) }} />
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {cols.map((col) => (
              <td key={col} className="pt-1 text-center text-[9px] text-ink-faint">{col}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------- Progress ring ----------------------- */
export function ProgressRing({
  value,
  size = 72,
  thickness = 7,
  color = "var(--color-brand-500)",
  label,
  className
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-ink">{Math.round(clamped)}%</span>
        {label ? <span className="text-[9px] text-ink-muted">{label}</span> : null}
      </div>
    </div>
  );
}
