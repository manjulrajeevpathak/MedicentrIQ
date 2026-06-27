"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { verifyOtpAction, type VerifyState } from "@/app/(auth)/actions";

const fieldClass =
  "w-full rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm tracking-widest text-[var(--color-ink)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)]";
const labelClass =
  "mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]";

const initialState: VerifyState = {};

export function VerifyForm({
  challengeId,
  email
}: {
  challengeId: string;
  email: string;
}) {
  const [state, formAction] = useActionState(verifyOtpAction, initialState);

  return (
    <form action={formAction} className="surface-card space-y-4 p-6">
      <input type="hidden" name="challengeId" value={challengeId} />
      <p className="text-sm text-[var(--color-ink-muted)]">
        Enter the verification code sent to{" "}
        <span className="font-medium text-[var(--color-ink)]">{email}</span>.
      </p>
      <div>
        <label htmlFor="code" className={labelClass}>
          Verification code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          placeholder="123456"
          className={fieldClass}
        />
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
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Verifying…" : "Verify & continue"}
    </button>
  );
}
