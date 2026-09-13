import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Layers,
  LogOut,
  Plus,
  ShieldCheck,
  UsersRound,
  Users
} from "lucide-react";
import { listTenants, type TenantView } from "@console/lib/platform-api";
import { PlanBadge, StatusBadge, TypeBadge } from "@console/components/badges";
import { logoutAction } from "@/app/console/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let tenants: TenantView[];
  let loadError: string | null = null;
  try {
    tenants = await listTenants();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load tenants.";
    tenants = [];
  }

  const hospitalCount = tenants.filter((t) => t.type === "hospital").length;
  const clinicCount = tenants.filter((t) => t.type === "clinic").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[var(--color-brand-600)]">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              HealthFlow Platform
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Platform Console
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Onboard hospitals and clinics, assign plan tiers, and toggle feature
            modules per tenant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/console/admins"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-fill)]"
          >
            <UsersRound className="h-4 w-4" />
            Admins
          </Link>
          <Link
            href="/console/tenants/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-card)] transition hover:bg-[var(--color-brand-700)]"
          >
            <Plus className="h-4 w-4" />
            Onboard hospital
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-fill)]"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Total tenants"
          value={tenants.length}
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Hospitals"
          value={hospitalCount}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Clinics"
          value={clinicCount}
        />
      </div>

      {loadError ? (
        <div className="surface-card border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-4 text-sm text-[var(--color-critical)]">
          Could not reach core-api: {loadError}
        </div>
      ) : tenants.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            No tenants yet. Onboard your first hospital to get started.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Modules</th>
                <th className="px-5 py-3 font-medium">Branches</th>
                <th className="px-5 py-3 font-medium">Users</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-line)] last:border-0 transition hover:bg-[var(--color-surface-muted)]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/console/tenants/${t.id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-700)]"
                    >
                      {t.displayName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <TypeBadge type={t.type} />
                  </td>
                  <td className="px-5 py-3.5">
                    <PlanBadge planId={t.planId} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {t.enabledModules.length} enabled
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {t.branchCount}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {t.userCount}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/console/tenants/${t.id}`}
                      className="inline-flex text-[var(--color-ink-faint)] hover:text-[var(--color-brand-600)]"
                      aria-label={`Open ${t.displayName}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
        {icon}
      </div>
      <div>
        <div className="text-xl font-semibold text-[var(--color-ink)]">
          {value}
        </div>
        <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
      </div>
    </div>
  );
}
