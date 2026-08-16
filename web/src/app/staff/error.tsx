"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-critical-soft)] text-[var(--color-critical)]">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        An unexpected error interrupted this view. Your work is safe — try again, and contact platform support if it
        persists.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        <RefreshCw className="size-4" /> Try again
      </button>
    </div>
  );
}
