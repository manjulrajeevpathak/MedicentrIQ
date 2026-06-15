"use client";

import {
  Building2,
  Check,
  GitBranch,
  KeyRound,
  Lock,
  RotateCw,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users
} from "lucide-react";
import type { PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";

const permissionColumns: { key: PermissionKey; label: string }[] = [
  { key: "workbench:manage", label: "Workbench" },
  { key: "inbox:assign", label: "Inbox" },
  { key: "patient360:view", label: "Patient 360" },
  { key: "appointment:write", label: "Appts" },
  { key: "followup:manage", label: "Follow-up" },
  { key: "journey:manage", label: "Journeys" },
  { key: "campaign:send", label: "Campaigns" },
  { key: "analytics:view", label: "Analytics" },
  { key: "ai:approve", label: "AI approval" },
  { key: "audit:view", label: "Audit" }
];

const roleLabel: Record<string, string> = {
  front_desk: "Front desk",
  call_center: "Call center",
  care_coordinator: "Care coordinator",
  nurse: "Nurse",
  doctor: "Doctor",
  department_admin: "Dept admin",
  org_admin: "Org admin"
};

const serviceKeys = [
  { name: "integration-gateway", scope: "ingestion events", lastUsed: "2m ago", status: "active" as const },
  { name: "datacentriq-gateway", scope: "intelligence calls", lastUsed: "just now", status: "active" as const },
  { name: "workflow-worker", scope: "workflow callbacks", lastUsed: "11m ago", status: "active" as const }
];

export function AdminView() {
  const { data, togglePermission } = useApp();
  const { toast } = useToast();
  const { authContext } = data;
  const canView = authContext.activeUser.permissions.includes("audit:view");

  if (!canView) {
    return (
      <Panel>
        <EmptyState icon={<Lock className="size-5" />} title="Admin restricted" description="The audit:view permission is required to manage tenant settings, roles and governance." />
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tenant context */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel>
          <SectionTitle icon={<Building2 className="size-4" />} title="Tenant" />
          <p className="mt-3 text-base font-semibold text-ink">{authContext.tenant.name}</p>
          <p className="font-mono text-xs text-ink-muted">{authContext.tenant.id}</p>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm">
            <GitBranch className="size-4 text-ink-faint" />
            <span className="text-ink-soft">{authContext.branch.name}</span>
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={<ShieldCheck className="size-4" />} title="Auth posture" />
          <div className="mt-3 space-y-2.5 text-sm">
            <Row label="Session mode" value={<Badge tone={authContext.mode === "fallback" ? "high" : "good"}>{authContext.mode === "staff-session" ? "Signed staff session" : authContext.mode === "demo-headers" ? "Demo headers" : "Demo mode"}</Badge>} />
            <Row label="Tenant scoping" value={<Badge tone="good" dot>Enforced</Badge>} />
            <Row label="Branch scoping" value={<Badge tone="good" dot>Enforced</Badge>} />
            <Row label="RBAC guards" value={<Badge tone="good" dot>Active</Badge>} />
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={<UserCog className="size-4" />} title="Team" subtitle={`${authContext.availableUsers.length} active staff`} />
          <ul className="mt-3 space-y-2">
            {authContext.availableUsers.map((user) => (
              <li key={user.id} className="flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">{user.title}</p>
                </div>
                <Badge tone="neutral">{roleLabel[user.role]}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Permission matrix */}
      <Panel padded={false}>
        <div className="p-5 pb-3">
          <SectionTitle icon={<Users className="size-4" />} title="Role & permission matrix" subtitle="Least-privilege access across the team" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-muted text-left">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Staff member</th>
                {permissionColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {authContext.availableUsers.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-surface-muted">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={user.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-ink">{user.name}</p>
                        <p className="text-[11px] text-ink-muted">{roleLabel[user.role]}</p>
                      </div>
                    </div>
                  </td>
                  {permissionColumns.map((column) => {
                    const granted = user.permissions.includes(column.key);
                    return (
                      <td key={column.key} className="px-3 py-3 text-center">
                        <button
                          onClick={() => togglePermission(user.id, column.key)}
                          aria-label={`${granted ? "Revoke" : "Grant"} ${column.label} for ${user.name}`}
                          aria-pressed={granted}
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-md transition hover:ring-2 hover:ring-brand-200",
                            granted ? "bg-[var(--color-good-soft)] text-[var(--color-good)]" : "bg-fill text-ink-faint"
                          )}
                        >
                          {granted ? <Check className="size-3.5" /> : <Lock className="size-3" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Governance */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel padded={false}>
          <div className="p-5 pb-3">
            <SectionTitle icon={<KeyRound className="size-4" />} title="Service API keys" subtitle="Machine-to-machine, ingestion-scoped only" />
          </div>
          <ul className="divide-y divide-line">
            {serviceKeys.map((key) => (
              <li key={key.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-ink">{key.name}</p>
                  <p className="text-[11px] text-ink-muted">{key.scope} · used {key.lastUsed}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="good" dot>{key.status}</Badge>
                  <button
                    onClick={() => toast(`Rotated key for ${key.name}. Update the deployment secret.`, "success")}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[11px] font-medium text-ink-soft transition hover:bg-surface-muted"
                  >
                    <RotateCw className="size-3" /> Rotate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <SectionTitle icon={<ScrollText className="size-4" />} title="Governance policy" />
          <ul className="mt-3 space-y-2.5">
            {[
              ["Audit retention", "All staff, AI and service actions retained & queryable"],
              ["Consent enforcement", "Caregiver-first consent gates patient-facing messages"],
              ["AI message approval", "Outbound patient messages held for human sign-off"],
              ["Reversibility", "Identity merges and AI acceptances are reversible"]
            ].map(([title, detail]) => (
              <li key={title} className="flex items-start gap-2.5 rounded-xl bg-surface-muted p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-good)]" />
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="text-xs text-ink-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      {value}
    </div>
  );
}
