"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { loginAction, type AuthState } from "../actions";

const initial: AuthState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-ink">Sign in</h1>
        <p className="text-xs text-ink-muted">Use your staff account to continue.</p>
      </div>

      <FormError message={state.error} />

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@hospital.org" />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      </Field>

      <SubmitButton />

      <div className="flex items-center justify-between pt-1 text-xs">
        <Link href="/staff/forgot-password" className="text-brand-600 hover:text-brand-700">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
