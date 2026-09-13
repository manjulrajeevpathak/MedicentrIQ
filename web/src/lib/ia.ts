import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BedDouble,
  Bot,
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
  Users,
  Workflow
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
  /** Placeholder for a not-yet-built surface — shown, labelled "Soon", non-clickable. */
  comingSoon?: boolean;
  /** Hidden from nav + command palette (the route still resolves if reached directly). */
  hidden?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Work",
    items: [
      { href: "/staff/today", label: "Today", icon: LayoutDashboard, description: "Your floor, right now", module: "today", badgeKey: "workbench" },
      { href: "/staff/inbox", label: "Unified Inbox", icon: Inbox, description: "WhatsApp, call, web and referral conversations", module: "inbox", requires: "inbox:assign", badgeKey: "inbox" }
    ]
  },
  {
    label: "Care",
    items: [
      { href: "/staff/appointments", label: "Appointments", icon: CalendarClock, description: "Booking, doctor schedules and slot orchestration", module: "access", requires: "appointment:write", badgeKey: "access" },
      { href: "/staff/opd", label: "OPD", icon: ClipboardPlus, description: "Walk-in intake, queue and consult capture", module: "patients", requires: "patients:create" },
      { href: "/staff/ipd", label: "IPD", icon: BedDouble, description: "In-patient admissions and ward management", module: "patients", comingSoon: true },
      { href: "/staff/patients", label: "All Patients", icon: Users, description: "Identity, matching and Patient 360", module: "patients", requires: "patient360:view", hidden: true }
    ]
  },
  {
    label: "Growth",
    items: [
      { href: "/staff/leads", label: "Leads", icon: Sprout, description: "Camp, web-form and referral leads → patients", module: "leads" },
      { href: "/staff/campaigns", label: "Campaigns", icon: Megaphone, description: "WhatsApp templates and broadcasts", module: "campaigns", requires: "campaign:send" },
      { href: "/staff/journeys", label: "Journeys", icon: Route, description: "Specialty journey & protocol packs", module: "journeys", requires: "journey:manage" },
      { href: "/staff/continuity", label: "Continuity", icon: Activity, description: "Follow-up journeys and patients at risk of falling out of care", module: "continuity", requires: "followup:manage", badgeKey: "continuity" }
    ]
  },
  {
    label: "Communications",
    items: [
      { href: "/staff/communications/channels", label: "Channels", icon: Radio, description: "WhatsApp & telephony credentials", module: "admin", requires: "audit:view" },
      { href: "/staff/communications/templates", label: "Templates", icon: MailCheck, description: "Reusable WhatsApp messages & call scripts", module: "admin", requires: "audit:view" },
      { href: "/staff/communications/workflows", label: "Workflows", icon: Workflow, description: "Staged message, call, form & task orchestration", module: "admin", requires: "audit:view" },
      { href: "/staff/assistant", label: "Assistant", icon: Bot, description: "AI answers patient WhatsApp messages — hands off to your Inbox", module: "admin", requires: "audit:view" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/staff/doctors", label: "Doctors", icon: Stethoscope, description: "Doctors, specialties and weekly schedules", module: "access", requires: "appointment:write" },
      { href: "/staff/operations", label: "Operations", icon: ShieldCheck, description: "Service health and audit", module: "operations" },
      { href: "/staff/billing", label: "Billing", icon: IndianRupee, description: "Invoices and payments — billed vs settled", module: "billing", comingSoon: true },
      { href: "/staff/admin", label: "Admin", icon: Settings2, description: "Tenant, roles and governance", module: "admin", requires: "audit:view" }
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
    return groups
      .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
      .filter((group) => group.items.length > 0);
  }
  const enabled = new Set(enabledModules);
  return groups
    .map((group) => ({
      ...group,
      // `comingSoon` teasers show regardless of entitlement (they're placeholders).
      items: group.items.filter((item) => !item.hidden && (item.comingSoon || enabled.has(item.module)))
    }))
    .filter((group) => group.items.length > 0);
}
