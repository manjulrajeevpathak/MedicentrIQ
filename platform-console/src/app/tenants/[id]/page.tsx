import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  GitBranch,
  Mail,
  Users
} from "lucide-react";
import {
  getTenant,
  listModules,
  listPlans,
  type PlanId,
  type TenantDetail
} from "@/lib/platform-api";
import { PlanBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { ModuleToggle, PlanSelector, StatusControl } from "./controls";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let tenant: TenantDetail;
  try {
    tenant = await getTenant(id);
  } catch {
    notFound();
  }

  const [plans, modules] = await Promise.all([listPlans(), listModules()]);
  const planOptions = plans.map((p) => ({ id: p.id as PlanId, label: p.label }));
  const enabled = new Set(tenant.enabledModules);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            {tenant.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={tenant.type} />
            <PlanBadge planId={tenant.planId} />
            <StatusBadge status={tenant.status} />
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm text-[var(--color-ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-4 w-4" />
            {tenant.branchCount} branches
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {tenant.userCount} users
          </span>
        </div>
      </header>

      {/* Plan + status controls */}
      <section className="surface-card mb-6 grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Plan tier
          </h2>
          <PlanSelector
            tenantId={tenant.id}
            planId={tenant.planId}
            plans={planOptions}
          />
        </div>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Status
          </h2>
          <StatusControl tenantId={tenant.id} status={tenant.status} />
        </div>
      </section>

      {/* Module grid */}
      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">
            Feature modules
          </h2>
          <span className="text-xs text-[var(--color-ink-muted)]">
            {tenant.enabledModules.length} of {modules.length} enabled
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {modules.map((m) => (
            <ModuleToggle
              key={m.key}
              tenantId={tenant.id}
              module={m}
              enabled={enabled.has(m.key)}
            />
          ))}
        </div>
      </section>

      {/* Branches + admins */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <Building2 className="h-4 w-4 text-[var(--color-brand-600)]" />
            Branches
          </h2>
          {tenant.branches.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No branches.</p>
          ) : (
            <ul className="space-y-2.5">
              {tenant.branches.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-[var(--color-ink)]">
                      {b.displayName}
                    </div>
                    <div className="text-xs text-[var(--color-ink-muted)]">
                      {b.city}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-6">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <Users className="h-4 w-4 text-[var(--color-brand-600)]" />
            Admins
          </h2>
          {tenant.admins.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No admins.</p>
          ) : (
            <ul className="space-y-2.5">
              {tenant.admins.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="font-medium text-[var(--color-ink)]">
                    {a.displayName}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                    <Mail className="h-3 w-3" />
                    {a.email}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
