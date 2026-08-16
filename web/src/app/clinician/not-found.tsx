import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-ink">Not found</h1>
      <p className="mt-1 text-sm text-ink-muted">We couldn&apos;t find what you were looking for.</p>
      <Link
        href="/clinician"
        className="tap mt-5 inline-flex items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white active:bg-brand-700"
      >
        Back to patients
      </Link>
    </main>
  );
}
