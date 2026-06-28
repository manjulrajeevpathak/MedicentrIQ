import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarClock,
  ClipboardPlus,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  MailCheck,
  Megaphone,
  Radio,
  Route,
  Settings2,
  ShieldCheck,
  Sprout,
  Stethoscope,
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
  | "opd"
  | "doctors"
  | "journeys"
  | "continuity"
  | "leads"
  | "campaigns"
  | "billing"
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
      { href: "/appointments", label: "Appointments", icon: CalendarClock, description: "Booking, doctor schedules and slot orchestration", module: "access", requires: "appointment:write", badgeKey: "access" },
      { href: "/opd", label: "OPD", icon: ClipboardPlus, description: "Walk-in intake, queue and consult capture", module: "patients", requires: "patients:create" }
    ]
  },
  {
    label: "Care",
    items: [
      { href: "/patients", label: "Patients", icon: Users, description: "Identity, matching and Patient 360", module: "patients", requires: "patient360:view" },
      { href: "/doctors", label: "Doctors", icon: Stethoscope, description: "Doctors, specialties and weekly schedules", module: "access", requires: "appointment:write" },
      { href: "/journeys", label: "Journeys", icon: Route, description: "Specialty journey & protocol packs", module: "journeys", requires: "journey:manage" },
      { href: "/continuity", label: "Continuity", icon: Activity, description: "Follow-up journeys and patients at risk of falling out of care", module: "continuity", requires: "followup:manage", badgeKey: "continuity" }
    ]
  },
  {
    label: "Growth",
    items: [
      { href: "/leads", label: "Leads", icon: Sprout, description: "Camp, web-form and referral leads → patients", module: "leads" },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, description: "WhatsApp templates and broadcasts", module: "campaigns", requires: "campaign:send" },
      { href: "/billing", label: "Billing", icon: IndianRupee, description: "Invoices and payments — billed vs settled", module: "billing" }
    ]
  },
  {
    label: "Communications",
    items: [
      { href: "/communications/channels", label: "Channels", icon: Radio, description: "WhatsApp & telephony credentials", module: "admin", requires: "audit:view" },
      { href: "/communications/templates", label: "Templates", icon: MailCheck, description: "Appointment message templates & timing", module: "admin", requires: "audit:view" }
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
