import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white shadow-[var(--shadow-card)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-600)]">
            HealthOS Platform
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            Platform Console
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
