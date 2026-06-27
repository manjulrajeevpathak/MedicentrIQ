import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";
import { listAdmins, type PlatformAdmin } from "@/lib/platform-api";
import { StatusBadge } from "@/components/badges";
import { InviteAdminForm, AdminStatusControl } from "./admin-controls";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function AdminsPage() {
  let admins: PlatformAdmin[];
  let loadError: string | null = null;
  try {
    admins = await listAdmins();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load admins.";
    admins = [];
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-brand-700)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to console
        </Link>
        <div className="mb-1.5 flex items-center gap-2 text-[var(--color-brand-600)]">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            HealthOS Platform
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Platform admins
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Invite, list, and deactivate platform administrators.
        </p>
      </header>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-ink-soft)]">
          <UserPlus className="h-4 w-4 text-[var(--color-brand-600)]" />
          Invite admin
        </div>
        <InviteAdminForm />
      </section>

      {loadError ? (
        <div className="surface-card border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-4 text-sm text-[var(--color-critical)]">
          Could not reach core-api: {loadError}
        </div>
      ) : admins.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            No platform admins yet.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last login</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-[var(--color-line)] last:border-0 transition hover:bg-[var(--color-surface-muted)]"
                >
                  <td className="px-5 py-3.5 font-medium text-[var(--color-ink)]">
                    {a.displayName}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {a.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-ink-soft)]">
                    {formatDate(a.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <AdminStatusControl id={a.id} status={a.status} />
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
