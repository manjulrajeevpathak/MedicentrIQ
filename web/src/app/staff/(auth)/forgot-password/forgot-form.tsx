"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { forgotAction, type AuthState } from "../actions";

const initial: AuthState & { ok?: boolean } = {};

export function ForgotForm() {
  const [state, formAction] = useActionState(forgotAction, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-base font-semibold text-ink">Check your email</h1>
        <p className="text-sm text-ink-soft">If that email exists, a reset link has been sent.</p>
        <Link href="/staff/login" className="inline-block text-xs text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-ink">Reset your password</h1>
        <p className="text-xs text-ink-muted">We&apos;ll email you a link to set a new password.</p>
      </div>

      <FormError message={state.error} />

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@hospital.org" />
      </Field>

      <SubmitButton />

      <div className="pt-1 text-xs">
        <Link href="/staff/login" className="text-brand-600 hover:text-brand-700">
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
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}
