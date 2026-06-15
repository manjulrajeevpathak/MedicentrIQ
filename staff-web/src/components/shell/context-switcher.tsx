"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, GitBranch, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVE_USER_COOKIE } from "@/lib/constants";
import { useApp } from "@/lib/store";
import type { DemoAuthContext } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const branches = [
  { id: "blr-indiranagar", name: "Indiranagar Eye Centre" },
  { id: "lko", name: "Lucknow" },
  { id: "hyd", name: "Hyderabad" },
  { id: "mum-thane", name: "Mumbai - Thane" }
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

export function ContextSwitcher({ auth }: { auth: DemoAuthContext }) {
  const router = useRouter();
  const { branch, setBranch } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const viewAs = (userId: string) => {
    setPending(userId);
    document.cookie = `${ACTIVE_USER_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=2592000; samesite=lax`;
    setOpen(false);
    router.refresh();
    setTimeout(() => setPending(null), 600);
  };

  const grantedCount = auth.permissionBadges.filter((badge) => badge.granted).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 transition hover:border-line-strong hover:bg-surface-muted"
      >
        <Avatar name={auth.activeUser.name} size="sm" />
        <div className="hidden text-left leading-tight sm:block">
          <p className="max-w-[120px] truncate text-xs font-semibold text-ink">{auth.activeUser.name}</p>
          <p className="max-w-[120px] truncate text-[11px] text-ink-muted">{roleLabel[auth.activeUser.role]}</p>
        </div>
        <ChevronDown className={cn("size-4 text-ink-faint transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="animate-in absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-2xl border border-line bg-surface p-2 shadow-pop">
          {/* Org / branch context */}
          <div className="rounded-xl bg-surface-muted p-3">
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="size-3.5 text-ink-muted" />
              <span className="font-medium text-ink">{auth.tenant.name}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <GitBranch className="size-3.5 text-ink-muted" />
              <span className="text-ink-soft">{branch.name}</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <ShieldCheck className="size-3.5" /> Auth
              </span>
              <Badge tone={auth.mode === "fallback" ? "high" : "good"} dot>
                {auth.mode === "staff-session" ? "Staff session" : auth.mode === "demo-headers" ? "Demo headers" : "Demo mode"}
              </Badge>
            </div>
          </div>

          {/* Permissions */}
          <div className="px-2 pb-1 pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Permissions · {grantedCount}/{auth.permissionBadges.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {auth.permissionBadges.map((badge) => (
                <Badge key={badge.key} tone={badge.granted ? "brand" : "neutral"} className={cn(!badge.granted && "opacity-55")}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Branch */}
          <div className="mt-2 border-t border-line px-1 pt-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Branch</p>
            <div className="grid grid-cols-2 gap-1">
              {branches.map((b) => {
                const active = b.id === branch.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBranch(b.id, b.name)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition",
                      active ? "bg-brand-50 font-medium text-brand-700" : "text-ink-soft hover:bg-surface-muted"
                    )}
                  >
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate">{b.name}</span>
                    {active ? <Check className="ml-auto size-3.5 shrink-0 text-brand-600" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View as */}
          <div className="mt-2 border-t border-line px-1 pt-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">View as role</p>
            {auth.availableUsers.map((user) => {
              const active = user.id === auth.activeUser.id;
              return (
                <button
                  key={user.id}
                  onClick={() => viewAs(user.id)}
                  disabled={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition",
                    active ? "bg-brand-50" : "hover:bg-surface-muted",
                    pending === user.id && "opacity-60"
                  )}
                >
                  <Avatar name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-ink-muted">{user.title}</p>
                  </div>
                  {active ? <Check className="size-4 text-brand-600" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
