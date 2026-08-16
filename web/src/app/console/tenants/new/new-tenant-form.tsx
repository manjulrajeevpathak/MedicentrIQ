"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  createTenantAction,
  type CreateTenantState
} from "@/app/console/actions";

interface PlanOption {
  id: string;
  label: string;
}

const initialState: CreateTenantState = {};

const fieldClass =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)]";
const labelClass =
  "mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]";

export function NewTenantForm({ plans }: { plans: PlanOption[] }) {
  const [state, formAction] = useActionState(createTenantAction, initialState);

  return (
    <form action={formAction} className="surface-card space-y-5 p-6">
      <div>
        <label htmlFor="displayName" className={labelClass}>
          Organisation name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          placeholder="Apollo Speciality Hospital"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <select id="type" name="type" defaultValue="hospital" className={fieldClass}>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
          </select>
        </div>
        <div>
          <label htmlFor="planId" className={labelClass}>
            Plan tier
          </label>
          <select
            id="planId"
            name="planId"
            defaultValue={plans[0]?.id}
            className={fieldClass}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="branchName" className={labelClass}>
            First branch name
          </label>
          <input
            id="branchName"
            name="branchName"
            required
            placeholder="Main Campus"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="branchCity" className={labelClass}>
            Branch city
          </label>
          <input
            id="branchCity"
            name="branchCity"
            required
            placeholder="Chennai"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="adminName" className={labelClass}>
            Admin name
          </label>
          <input
            id="adminName"
            name="adminName"
            required
            placeholder="Dr. Priya Menon"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="adminEmail" className={labelClass}>
            Admin email
          </label>
          <input
            id="adminEmail"
            name="adminEmail"
            type="email"
            required
            placeholder="admin@apollo.in"
            className={fieldClass}
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-[var(--color-critical-soft)] px-3 py-2 text-sm text-[var(--color-critical)]">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Provisioning…" : "Onboard tenant"}
    </button>
  );
}
