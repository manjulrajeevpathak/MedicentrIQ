"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { completeFirstLoginAction, resetPasswordAction, type AuthState } from "../actions";

const initial: AuthState = {};

export function ResetForm({ mode, token }: { mode: "token" | "first"; token?: string }) {
  const action = mode === "first" ? completeFirstLoginAction : resetPasswordAction;
  const [state, formAction] = useActionState(action, initial);

  const heading = mode === "first" ? "Set your password" : "Choose a new password";
  const blurb =
    mode === "first"
      ? "Your account requires a new password before you continue."
      : "Enter a new password for your account.";
  const cta = mode === "first" ? "Save and continue" : "Reset password";

  return (
    <form action={formAction} className="space-y-4">
      {mode === "token" ? <input type="hidden" name="token" value={token ?? ""} /> : null}

      <div className="space-y-1">
        <h1 className="text-base font-semibold text-ink">{heading}</h1>
        <p className="text-xs text-ink-muted">{blurb}</p>
      </div>

      <FormError message={state.error} />

      <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required autoFocus placeholder="••••••••" />
      </Field>

      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required placeholder="••••••••" />
      </Field>

      <SubmitButton label={cta} />

      {mode === "token" ? (
        <div className="pt-1 text-xs">
          <Link href="/staff/login" className="text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </div>
      ) : null}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
