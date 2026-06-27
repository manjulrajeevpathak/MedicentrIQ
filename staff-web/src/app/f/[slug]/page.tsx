import type { Metadata } from "next";
import { fetchPublicForm } from "./actions";
import { PublicFormView } from "./public-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicForm(slug);
  return { title: result.ok ? result.form.title : "Form" };
}

/**
 * PUBLIC camp/lead-capture form. Lives OUTSIDE the (app) and (auth) route groups
 * so it carries no app chrome, and `/f/...` is allow-listed in middleware so it
 * resolves without a session. This is the link camps share to capture leads.
 */
export default async function PublicFormPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicForm(slug);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        {result.ok ? (
          <PublicFormView slug={slug} form={result.form} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-7 text-center shadow-card">
            <h1 className="text-base font-semibold text-ink">Form unavailable</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{result.error}</p>
          </div>
        )}
        <p className="mt-6 text-center text-[11px] text-ink-faint">Powered by HealthcareOS</p>
      </div>
    </div>
  );
}
