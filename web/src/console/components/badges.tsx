import { Building2, Stethoscope } from "lucide-react";
import { cn } from "@console/lib/utils";
import type { PlanId, TenantStatus, TenantType } from "@console/lib/platform-api";

export function PlanBadge({ planId }: { planId: PlanId }) {
  const styles: Record<PlanId, string> = {
    starter: "bg-[var(--color-low-soft)] text-[var(--color-low)]",
    pro: "bg-[var(--color-medium-soft)] text-[var(--color-medium)]",
    enterprise: "bg-[var(--color-brand-100)] text-[var(--color-brand-800)]"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[planId] ?? styles.starter
      )}
    >
      {planId}
    </span>
  );
}

export function StatusBadge({ status }: { status: TenantStatus }) {
  const active = status === "active";
  const suspended = status === "suspended";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        active && "bg-[var(--color-good-soft)] text-[var(--color-good)]",
        suspended && "bg-[var(--color-critical-soft)] text-[var(--color-critical)]",
        !active &&
          !suspended &&
          "bg-[var(--color-fill)] text-[var(--color-ink-muted)]"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active && "bg-[var(--color-good)]",
          suspended && "bg-[var(--color-critical)]",
          !active && !suspended && "bg-[var(--color-ink-faint)]"
        )}
      />
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: TenantType }) {
  const isHospital = type === "hospital";
  const Icon = isHospital ? Building2 : Stethoscope;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-fill)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--color-ink-soft)]">
      <Icon className="h-3.5 w-3.5" />
      {type}
    </span>
  );
}
