"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import {
  ROLE_LABELS,
  STAFF_ROLES,
  type Branch,
  type ManagedUser,
  type MfaPolicy,
  type Seats
} from "@/lib/users-types";
import {
  createUserAction,
  resetUserPasswordAction,
  setMfaPolicyAction,
  setUserStatusAction
} from "@/app/(app)/admin/actions";

type Props = {
  users: ManagedUser[];
  seats: Seats;
  mfaPolicy: MfaPolicy;
  branches: Branch[];
};

const statusTone: Record<ManagedUser["status"], "good" | "neutral" | "high"> = {
  active: "good",
  inactive: "neutral",
  suspended: "high"
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",  month: "short", day: "numeric", year: "numeric" });
}

export function AdminView({ users, seats, mfaPolicy, branches }: Props) {
  const { toast } = useToast();
  const atLimit = seats.limit !== null && seats.used >= seats.limit;

  return (
    <div className="space-y-5">
      <SeatsBanner seats={seats} atLimit={atLimit} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <SecurityPolicy initial={mfaPolicy} onToast={toast} />
        <AddUserForm branches={branches} atLimit={atLimit} seats={seats} onToast={toast} />
      </div>

      <UsersTable users={users} onToast={toast} />
    </div>
  );
}

function SeatsBanner({ seats, atLimit }: { seats: Seats; atLimit: boolean }) {
  const limitLabel = seats.limit === null ? "Unlimited" : String(seats.limit);
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              {seats.used} of {limitLabel} seats used
            </p>
            <p className="text-xs text-ink-muted">Active and inactive staff accounts count toward your plan.</p>
          </div>
        </div>
        {atLimit ? (
          <Badge tone="high" dot>
            Seat limit reached
          </Badge>
        ) : null}
      </div>
      {atLimit ? (
        <p className="mt-3 rounded-lg bg-[var(--color-high-soft)] px-3 py-2 text-xs text-[var(--color-high)]">
          You&apos;ve used every seat on your plan. Deactivate a user or upgrade your plan to add more staff.
        </p>
      ) : null}
    </Panel>
  );
}

function SecurityPolicy({
  initial,
  onToast
}: {
  initial: MfaPolicy;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [policy, setPolicy] = useState<MfaPolicy>(initial);
  const [pending, startTransition] = useTransition();

  function change(next: MfaPolicy) {
    if (next === policy || pending) return;
    const previous = policy;
    setPolicy(next);
    startTransition(async () => {
      const result = await setMfaPolicyAction(next);
      if (!result.ok) {
        setPolicy(previous);
        onToast(result.error ?? "Could not update the security policy.", "error");
        return;
      }
      onToast(result.message ?? "Security policy updated.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<ShieldCheck className="size-4" />}
        title="Security policy"
        subtitle="Multi-factor authentication for staff sign-in"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <Segmented<MfaPolicy>
          options={[
            { value: "optional", label: "Optional" },
            { value: "required", label: "Required" }
          ]}
          value={policy}
          onChange={change}
        />
        {pending ? <span className="text-[11px] text-ink-muted">Saving…</span> : null}
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {policy === "required"
          ? "All staff receive an email one-time passcode at every login."
          : "Staff can sign in with their password; MFA can be enabled per user."}
      </p>
    </Panel>
  );
}

function AddUserForm({
  branches,
  atLimit,
  seats,
  onToast
}: {
  branches: Branch[];
  atLimit: boolean;
  seats: Seats;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atLimit) return;
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createUserAction({ ok: false }, formData);
      if (!result.ok) {
        setError(result.error ?? "Could not create the user.");
        return;
      }
      form.reset();
      setTempPassword({
        email: result.user?.email ?? String(formData.get("email") ?? ""),
        password: result.tempPassword ?? ""
      });
      onToast("User created.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<UserPlus className="size-4" />}
        title="Add user"
        subtitle="Invite a staff member and assign roles and branches"
      />

      {atLimit ? (
        <p className="mt-4 rounded-lg bg-[var(--color-high-soft)] px-3 py-2 text-xs text-[var(--color-high)]">
          All {seats.limit} seats are in use. Deactivate a user before adding another.
        </p>
      ) : null}

      {tempPassword ? (
        <TempPasswordPanel
          label={`Temporary password for ${tempPassword.email}`}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
          onToast={onToast}
        />
      ) : null}

      <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="displayName">
            <Input id="displayName" name="displayName" placeholder="Jordan Lee" disabled={atLimit || pending} required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="jordan@example.com"
              disabled={atLimit || pending}
              required
            />
          </Field>
        </div>

        <fieldset disabled={atLimit || pending} className="space-y-1.5">
          <legend className="block text-xs font-medium text-ink-soft">Roles</legend>
          <div className="flex flex-wrap gap-1.5">
            {STAFF_ROLES.map((role) => (
              <label
                key={role.value}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input type="checkbox" name="roles" value={role.value} className="size-3.5 accent-brand-600" />
                {role.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={atLimit || pending} className="space-y-1.5">
          <legend className="block text-xs font-medium text-ink-soft">Branches</legend>
          {branches.length === 0 ? (
            <p className="text-[11px] text-ink-muted">No branches available for this tenant.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink-soft transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input type="checkbox" name="branchIds" value={branch.id} className="size-3.5 accent-brand-600" />
                  {branch.displayName}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-critical)]/30 bg-[var(--color-critical-soft)] px-3 py-2 text-xs font-medium text-[var(--color-critical)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={atLimit || pending}>
            {pending ? "Adding…" : "Add user"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function TempPasswordPanel({
  label,
  password,
  onClose,
  onToast
}: {
  label: string;
  password: string;
  onClose: () => void;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onToast("Couldn't copy to clipboard.", "error");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-brand-700">{label}</p>
          <p className="mt-1.5 break-all font-mono text-sm font-semibold text-ink">{password}</p>
          <p className="mt-1.5 text-[11px] text-ink-muted">Shown once — copy it now and hand it off securely.</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="rounded-md p-1 text-ink-faint transition hover:bg-surface hover:text-ink-soft"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Button variant="outline" size="sm" className="mt-2.5" onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy password"}
      </Button>
    </div>
  );
}

function UsersTable({
  users,
  onToast
}: {
  users: ManagedUser[];
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [reset, setReset] = useState<{ id: string; email: string; password: string } | null>(null);

  function toggleStatus(user: ManagedUser) {
    const next: ManagedUser["status"] = user.status === "active" ? "inactive" : "active";
    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserStatusAction(user.id, next);
      setPendingId(null);
      if (!result.ok) {
        onToast(result.error ?? "Could not update the user.", "error");
        return;
      }
      onToast(result.message ?? "User updated.", "success");
    });
  }

  function resetPassword(user: ManagedUser) {
    setPendingId(user.id);
    startTransition(async () => {
      const result = await resetUserPasswordAction(user.id);
      setPendingId(null);
      if (!result.ok) {
        onToast(result.error ?? "Could not reset the password.", "error");
        return;
      }
      setReset({ id: user.id, email: user.email, password: result.tempPassword ?? "" });
      onToast("Temporary password generated.", "success");
    });
  }

  return (
    <Panel padded={false}>
      <div className="p-4 pb-3">
        <SectionTitle icon={<Users className="size-4" />} title="Users" subtitle={`${users.length} staff accounts`} />
      </div>

      {reset ? (
        <div className="px-4 pb-1">
          <TempPasswordPanel
            label={`New temporary password for ${reset.email}`}
            password={reset.password}
            onClose={() => setReset(null)}
            onToast={onToast}
          />
        </div>
      ) : null}

      {users.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="No users yet" description="Add your first staff member above." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-muted text-left">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th>MFA</Th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => {
                const busy = pendingId === user.id;
                return (
                  <tr key={user.id} className="transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium text-ink">{user.displayName}</td>
                    <td className="px-4 py-3 text-ink-soft">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge key={role} tone="neutral">
                              {ROLE_LABELS[role] ?? role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[user.status]} dot className="capitalize">
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={user.mfaEnabled ? "good" : "neutral"}>{user.mfaEnabled ? "On" : "Off"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => resetPassword(user)}
                        >
                          <KeyRound className="size-3.5" /> Reset password
                        </Button>
                        <Button
                          variant={user.status === "active" ? "subtle" : "secondary"}
                          size="sm"
                          disabled={busy}
                          onClick={() => toggleStatus(user)}
                        >
                          {user.status === "active" ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className={cn("px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted")}>{children}</th>
  );
}
