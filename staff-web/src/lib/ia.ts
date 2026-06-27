import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarClock,
  Gauge,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Route,
  Settings2,
  ShieldCheck,
  Users
} from "lucide-react";
import type { PermissionKey } from "./types";

/**
 * Entitlement modules a hospital/clinic can be licensed for. Mirrors core-api's
 * platform ModuleKey (duplicated by design — services share no runtime code).
 */
export type ModuleKey =
  | "today"
  | "inbox"
  | "patients"
  | "access"
  | "journeys"
  | "continuity"
  | "campaigns"
  | "care_recovery"
  | "roi"
  | "operations"
  | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Entitlement module that gates this surface. */
  module: ModuleKey;
  requires?: PermissionKey;
  badgeKey?: "inbox" | "access" | "continuity" | "workbench";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Work",
    items: [
      { href: "/today", label: "Today", icon: LayoutDashboard, description: "Your floor, right now", module: "today", badgeKey: "workbench" },
      { href: "/inbox", label: "Unified Inbox", icon: Inbox, description: "WhatsApp, call, web and referral conversations", module: "inbox", requires: "inbox:assign", badgeKey: "inbox" },
      { href: "/access", label: "Access", icon: CalendarClock, description: "Appointment and slot orchestration", module: "access", requires: "appointment:write", badgeKey: "access" }
    ]
  },
  {
    label: "Care",
    items: [
      { href: "/patients", label: "Patients", icon: Users, description: "Identity, matching and Patient 360", module: "patients", requires: "patient360:view" },
      { href: "/journeys", label: "Journeys", icon: Route, description: "Specialty journey & protocol packs", module: "journeys", requires: "journey:manage" },
      { href: "/continuity", label: "Continuity", icon: Activity, description: "Follow-up journeys and patients at risk of falling out of care", module: "continuity", requires: "followup:manage", badgeKey: "continuity" }
    ]
  },
  {
    label: "Outcomes",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, description: "WhatsApp templates and broadcasts", module: "campaigns", requires: "campaign:send" },
      { href: "/leakage", label: "Care recovery", icon: IndianRupee, description: "Patients who fell out of care, and the worklist to bring them back", module: "care_recovery", requires: "analytics:view" },
      { href: "/roi", label: "ROI Reports", icon: Receipt, description: "Care-impact ledger and board-ready reports", module: "roi", requires: "analytics:view" },
      { href: "/command", label: "Command Center", icon: Gauge, description: "Operations & care-impact analytics dashboard", module: "operations", requires: "analytics:view" }
    ]
  },
  {
    label: "Control",
    items: [
      { href: "/operations", label: "Operations", icon: ShieldCheck, description: "Service health and audit", module: "operations" },
      { href: "/admin", label: "Admin", icon: Settings2, description: "Tenant, roles and governance", module: "admin", requires: "audit:view" }
    ]
  }
];

export const navItems = navGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/**
 * Filter nav to the tenant's enabled modules. `enabledModules === undefined`
 * (demo mode / no entitlements) shows everything. Empty groups are dropped.
 */
export function filterNavGroups(groups: NavGroup[], enabledModules: ModuleKey[] | undefined): NavGroup[] {
  if (!enabledModules) {
    return groups;
  }
  const enabled = new Set(enabledModules);
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => enabled.has(item.module)) }))
    .filter((group) => group.items.length > 0);
}
