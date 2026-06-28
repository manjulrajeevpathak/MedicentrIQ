"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, filterNavGroups, type NavItem, type ModuleKey } from "@/lib/ia";
import type { DemoAuthContext, PermissionKey } from "@/lib/types";
import type { NavBadges } from "./app-shell";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark, Wordmark } from "@/components/brand/logo";

const roleLabel: Record<string, string> = {
  front_desk: "Front desk",
  call_center: "Call center",
  care_coordinator: "Care coordinator",
  nurse: "Nurse",
  doctor: "Doctor",
  department_admin: "Dept admin",
  org_admin: "Org admin"
};

export function Sidebar({
  auth,
  badges,
  enabledModules,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile
}: {
  auth: DemoAuthContext;
  badges: NavBadges;
  enabledModules?: ModuleKey[];
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const granted = new Set(auth.activeUser.permissions);
  const groups = filterNavGroups(navGroups, enabledModules);

  const badgeFor = (item: NavItem): number | undefined => {
    if (!item.badgeKey) return undefined;
    const value = badges[item.badgeKey];
    return value > 0 ? value : undefined;
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-[transform,width] duration-200 ease-out md:static md:translate-x-0",
          collapsed ? "md:w-[74px]" : "md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4">
          <LogoMark size={34} />
          <div className={cn("min-w-0 leading-tight", collapsed && "md:hidden")}>
            <Wordmark className="block truncate text-sm" />
            <p className="truncate text-[11px] font-medium text-ink-muted">Staff Console</p>
          </div>
          <button
            onClick={onToggleCollapse}
            className={cn(
              "ml-auto hidden size-7 items-center justify-center rounded-lg text-ink-faint transition hover:bg-fill hover:text-ink-soft md:flex",
              collapsed && "md:rotate-180"
            )}
            aria-label="Toggle sidebar"
          >
            <ChevronsLeft className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-3 py-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p
                className={cn(
                  "px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint",
                  collapsed && "md:hidden"
                )}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const comingSoon = item.comingSoon ?? false;
                  const restricted = !comingSoon && item.requires ? !granted.has(item.requires as PermissionKey) : false;
                  const badge = badgeFor(item);
                  const Icon = item.icon;

                  const content = (
                    <>
                      <span className="relative flex size-5 shrink-0 items-center justify-center">
                        <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                        {badge && collapsed ? (
                          <span className="absolute -right-1.5 -top-1.5 hidden size-2 rounded-full bg-brand-500 md:block" />
                        ) : null}
                      </span>
                      <span className={cn("flex-1 truncate", collapsed && "md:hidden")}>{item.label}</span>
                      {comingSoon ? (
                        <span
                          className={cn(
                            "rounded-full bg-fill px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-faint",
                            collapsed && "md:hidden"
                          )}
                        >
                          Soon
                        </span>
                      ) : restricted ? (
                        <Lock className={cn("size-3.5 text-ink-faint", collapsed && "md:hidden")} />
                      ) : badge ? (
                        <span
                          className={cn(
                            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                            active ? "bg-brand-500 text-white" : "bg-fill text-ink-muted",
                            collapsed && "md:hidden"
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </>
                  );

                  const baseClass = cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    collapsed && "md:justify-center md:px-0",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : restricted || comingSoon
                        ? "cursor-not-allowed text-ink-faint"
                        : "text-ink-soft hover:bg-surface-muted hover:text-ink"
                  );

                  if (comingSoon) {
                    return (
                      <li key={item.href}>
                        <div className={baseClass} title={`${item.label} — coming soon`} aria-disabled>
                          {content}
                        </div>
                      </li>
                    );
                  }

                  if (restricted) {
                    return (
                      <li key={item.href}>
                        <div className={baseClass} title={`Requires ${item.requires} permission`} aria-disabled>
                          {content}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={baseClass}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                      >
                        {content}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-line p-3">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl bg-surface-muted p-2.5",
              collapsed && "md:justify-center md:bg-transparent md:p-0"
            )}
          >
            <Avatar name={auth.activeUser.name} size="sm" />
            <div className={cn("min-w-0 leading-tight", collapsed && "md:hidden")}>
              <p className="truncate text-xs font-semibold text-ink">{auth.activeUser.name}</p>
              <p className="truncate text-[11px] text-ink-muted">{roleLabel[auth.activeUser.role] ?? auth.activeUser.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
