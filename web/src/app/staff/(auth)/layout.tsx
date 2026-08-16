import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";

/**
 * Minimal auth shell — a centered card on the warm canvas. Deliberately does
 * not load the AppProvider / sidebar / topbar so unauthenticated pages stay
 * self-contained.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark size={44} />
          <div>
            <Wordmark className="text-lg" />
            <p className="mt-0.5 text-xs text-ink-muted">Staff Console</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">{children}</div>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          Patient access &amp; continuity operations
        </p>
      </div>
    </div>
  );
}
