import Link from "next/link";
import { Compass } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark size={44} />
      <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        That page doesn&rsquo;t exist or has moved. Head back to your daily workbench.
      </p>
      <Link
        href="/today"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        <Compass className="size-4" /> Go to Today
      </Link>
    </div>
  );
}
