"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { verifyOtpAction, type AuthState } from "../../actions";

const initial: AuthState = {};

export function VerifyForm({ challengeId, email }: { challengeId: string; email: string }) {
  const [state, formAction] = useActionState(verifyOtpAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="challengeId" value={challengeId} />

      <div className="space-y-1">
        <h1 className="text-base font-semibold text-ink">Verify it&apos;s you</h1>
        <p className="text-xs text-ink-muted">
          Enter the 6-digit code sent to {email ? <span className="font-medium text-ink-soft">{email}</span> : "your account"}.
        </p>
      </div>

      <FormError message={state.error} />

      <Field
        label="Verification code"
        htmlFor="code"
        hint="Local dev: the code is logged by core-api and visible at GET /auth/dev/outbox."
      >
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          required
          autoFocus
          placeholder="123456"
          className="text-center text-base tracking-[0.4em]"
        />
      </Field>

      <SubmitButton />

      <div className="pt-1 text-xs">
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Verifying…" : "Verify"}
    </Button>
  );
}
