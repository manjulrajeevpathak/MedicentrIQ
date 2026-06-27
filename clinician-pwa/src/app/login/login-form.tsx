"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, verifyOtpAction, type AuthState } from "@/app/actions";

const inputClass =
  "tap w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-200";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap w-full rounded-xl bg-brand-600 px-4 text-[15px] font-semibold text-white shadow-card transition active:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(loginAction, {});
  const [otpState, otpAction] = useActionState<AuthState, FormData>(verifyOtpAction, {});

  const inMfa = state.mfaRequired && state.challengeId;

  if (inMfa) {
    return (
      <form action={otpAction} className="surface-card flex flex-col gap-4 p-5">
        <input type="hidden" name="challengeId" value={state.challengeId} />
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={inputClass}
            required
          />
          <p className="mt-1.5 text-xs text-ink-muted">Enter the code sent to your registered device.</p>
        </div>
        {otpState.error ? <p className="text-sm text-critical">{otpState.error}</p> : null}
        <SubmitButton>Verify &amp; sign in</SubmitButton>
      </form>
    );
  }

  return (
    <form action={formAction} className="surface-card flex flex-col gap-4 p-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@hospital.org"
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass}
          required
        />
      </div>
      {state.error ? <p className="text-sm text-critical">{state.error}</p> : null}
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
