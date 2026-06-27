"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Lock, Mail, Pencil } from "lucide-react";
import {
  setModuleOverrideAction,
  setPlanAction,
  setStatusAction,
  updateTenantAdminAction,
  type AdminEditState
} from "@/app/actions";
import { cn } from "@/lib/utils";
import type {
  ModuleDefinition,
  PlanId,
  TenantStatus
} from "@/lib/platform-api";

export function AdminEditor({
  tenantId,
  admin
}: {
  tenantId: string;
  admin: { id: string; displayName: string; email?: string };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<AdminEditState, FormData>(
    updateTenantAdminAction.bind(null, tenantId, admin.id),
    {}
  );

  if (!editing && !state.ok) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-[var(--color-ink)]">{admin.displayName}</div>
          <div className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
            <Mail className="h-3 w-3" />
            {admin.email}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input
        name="displayName"
        defaultValue={admin.displayName}
        placeholder="Name"
        className="w-full rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-sm"
      />
      <input
        name="email"
        type="email"
        defaultValue={admin.email}
        placeholder="admin@hospital.org"
        className="w-full rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-sm"
      />
      {state.error ? <p className="text-xs text-[var(--color-danger,#dc2626)]">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-[var(--color-good,#16a34a)]">Saved.</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md px-2 py-1.5 text-xs text-[var(--color-ink-muted)] hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

interface PlanOption {
  id: PlanId;
  label: string;
}

export function PlanSelector({
  tenantId,
  planId,
  plans
}: {
  tenantId: string;
  planId: PlanId;
  plans: PlanOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        value={planId}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as PlanId;
          startTransition(() => {
            void setPlanAction(tenantId, next);
          });
        }}
        className="rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)] disabled:opacity-60"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-ink-faint)]" />
      ) : null}
    </div>
  );
}

export function StatusControl({
  tenantId,
  status
}: {
  tenantId: string;
  status: TenantStatus;
}) {
  const [pending, startTransition] = useTransition();
  const options: TenantStatus[] = ["active", "suspended"];

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] p-1">
      {options.map((opt) => {
        const selected = opt === status;
        return (
          <button
            key={opt}
            type="button"
            disabled={pending || selected}
            onClick={() =>
              startTransition(() => {
                void setStatusAction(tenantId, opt);
              })
            }
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium capitalize transition disabled:cursor-default",
              selected && opt === "active" &&
                "bg-[var(--color-good-soft)] text-[var(--color-good)]",
              selected && opt === "suspended" &&
                "bg-[var(--color-critical-soft)] text-[var(--color-critical)]",
              !selected &&
                "text-[var(--color-ink-muted)] hover:bg-[var(--color-fill)]"
            )}
          >
            {opt}
          </button>
        );
      })}
      {pending ? (
        <Loader2 className="ml-1 h-4 w-4 animate-spin text-[var(--color-ink-faint)]" />
      ) : null}
    </div>
  );
}

export function ModuleToggle({
  tenantId,
  module,
  enabled
}: {
  tenantId: string;
  module: ModuleDefinition;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const locked = module.alwaysOn;
  const on = locked ? true : enabled;

  return (
    <div
      className={cn(
        "surface-card flex items-start justify-between gap-3 p-4",
        on && "border-[var(--color-brand-200)] bg-[var(--color-brand-50)]"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {module.label}
          </span>
          {locked ? (
            <Lock className="h-3 w-3 text-[var(--color-ink-faint)]" />
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
          {module.description}
        </p>
        {locked ? (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            Always on
          </span>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Toggle ${module.label}`}
        disabled={locked || pending}
        onClick={() =>
          startTransition(() => {
            void setModuleOverrideAction(tenantId, module.key, !on);
          })
        }
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
          on ? "bg-[var(--color-brand-600)]" : "bg-[var(--color-fill-strong)]",
          locked && "cursor-not-allowed opacity-70",
          pending && "opacity-60"
        )}
      >
        <span
          className={cn(
            "inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow-sm transition",
            on ? "translate-x-4" : "translate-x-0.5"
          )}
        >
          {locked ? (
            <Lock className="h-2.5 w-2.5 text-[var(--color-ink-faint)]" />
          ) : on && !pending ? (
            <Check className="h-2.5 w-2.5 text-[var(--color-brand-600)]" />
          ) : null}
        </span>
      </button>
    </div>
  );
}
