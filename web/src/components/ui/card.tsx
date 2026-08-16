import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  padded = true
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={cn("surface-card", padded && "p-4", className)}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  action,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
