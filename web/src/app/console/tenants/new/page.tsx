import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listPlans } from "@console/lib/platform-api";
import { NewTenantForm } from "./new-tenant-form";

export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  const plans = await listPlans();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/console"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
        Onboard a tenant
      </h1>
      <p className="mt-1 mb-8 text-sm text-[var(--color-ink-muted)]">
        Provision a new hospital or clinic with its first branch and admin
        account.
      </p>

      <NewTenantForm
        plans={plans.map((p) => ({ id: p.id, label: p.label }))}
      />
    </div>
  );
}
