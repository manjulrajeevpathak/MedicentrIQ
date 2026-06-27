"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Loader2 } from "lucide-react";
import {
  createAdminAction,
  updateAdminAction,
  type CreateAdminState
} from "@/app/admins/actions";
import { cn } from "@/lib/utils";
import type { AdminStatus } from "@/lib/platform-api";

const fieldClass =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)]";
const labelClass =
  "mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]";

const initialState: CreateAdminState = {};

export function InviteAdminForm() {
  const [state, formAction] = useActionState(createAdminAction, initialState);

  return (
    <form action={formAction} className="surface-card space-y-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            placeholder="Dr. Priya Menon"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="admin@healthos.local"
            className={fieldClass}
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
          {state.error}
        </p>
      ) : null}

      {state.tempPassword ? (
        <TempPasswordNotice
          email={state.email ?? ""}
          tempPassword={state.tempPassword}
        />
      ) : null}

      <InviteSubmit />
    </form>
  );
}

function InviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Inviting…" : "Invite admin"}
    </button>
  );
}

function TempPasswordNotice({
  email,
  tempPassword
}: {
  email: string;
  tempPassword: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-good)] bg-[var(--color-good-soft)] p-3 text-sm">
      <p className="font-medium text-[var(--color-good)]">
        Admin invited{email ? ` — ${email}` : ""}
      </p>
      <p className="mt-1 text-[var(--color-ink-soft)]">
        Share this one-time password now. It will not be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md bg-[var(--color-surface)] px-3 py-1.5 font-mono text-sm text-[var(--color-ink)]">
          {tempPassword}
        </code>
        <CopyButton value={tempPassword} />
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value)}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-fill)]"
    >
      <Copy className="h-3.5 w-3.5" />
      Copy
    </button>
  );
}

export function AdminStatusControl({
  id,
  status
}: {
  id: string;
  status: AdminStatus;
}) {
  const [pending, startTransition] = useTransition();
  const active = status === "active";
  const next: AdminStatus = active ? "inactive" : "active";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void updateAdminAction(id, next);
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition disabled:opacity-60",
        active
          ? "border-[var(--color-line-strong)] text-[var(--color-ink-muted)] hover:bg-[var(--color-fill)]"
          : "border-[var(--color-good)] text-[var(--color-good)] hover:bg-[var(--color-good-soft)]"
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : null}
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
