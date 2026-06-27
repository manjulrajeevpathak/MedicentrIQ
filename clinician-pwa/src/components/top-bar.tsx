import Link from "next/link";
import { ArrowLeft, LogOut, Stethoscope } from "lucide-react";
import { logoutAction } from "@/app/actions";

/**
 * Sticky top bar shared across authed screens. Optional back link on the left,
 * the app name in the centre, and a sign-out button on the right.
 */
export function TopBar({ backHref }: { backHref?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[430px] items-center justify-between px-3">
        <div className="flex w-10 items-center">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="tap -ml-2 flex w-10 items-center justify-center rounded-lg text-ink-soft active:bg-fill"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : null}
        </div>

        <Link href="/" className="flex items-center gap-1.5 font-semibold text-ink">
          <Stethoscope className="h-4.5 w-4.5 text-brand-600" />
          <span className="text-[15px]">HealthOS Clinician</span>
        </Link>

        <form action={logoutAction} className="flex w-10 justify-end">
          <button
            type="submit"
            aria-label="Sign out"
            className="tap flex w-10 items-center justify-center rounded-lg text-ink-soft active:bg-fill"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
