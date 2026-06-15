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
  Sparkles,
  Users
} from "lucide-react";
import type { PermissionKey } from "./types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  requires?: PermissionKey;
  badgeKey?: "inbox" | "access" | "continuity" | "ai" | "workbench";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Work",
    items: [
      { href: "/today", label: "Today", icon: LayoutDashboard, description: "Your floor, right now", badgeKey: "workbench" },
      { href: "/inbox", label: "Unified Inbox", icon: Inbox, description: "WhatsApp, call, web and referral conversations", requires: "inbox:assign", badgeKey: "inbox" },
      { href: "/access", label: "Access", icon: CalendarClock, description: "Appointment and slot orchestration", requires: "appointment:write", badgeKey: "access" }
    ]
  },
  {
    label: "Care",
    items: [
      { href: "/patients", label: "Patients", icon: Users, description: "Identity, matching and Patient 360", requires: "patient360:view" },
      { href: "/journeys", label: "Journeys", icon: Route, description: "Specialty journey & protocol packs", requires: "journey:manage" },
      { href: "/continuity", label: "Continuity", icon: Activity, description: "Follow-up journeys and patients at risk of falling out of care", requires: "followup:manage", badgeKey: "continuity" }
    ]
  },
  {
    label: "Outcomes",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, description: "WhatsApp templates and broadcasts", requires: "campaign:send" },
      { href: "/leakage", label: "Care recovery", icon: IndianRupee, description: "Patients who fell out of care, and the worklist to bring them back", requires: "analytics:view" },
      { href: "/roi", label: "ROI Reports", icon: Receipt, description: "Care-impact ledger and board-ready reports", requires: "analytics:view" }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai-workbench", label: "AI Workbench", icon: Sparkles, description: "Governed DatacentrIQ recommendations", badgeKey: "ai" },
      { href: "/command", label: "Command Center", icon: Gauge, description: "Operations & care-impact control tower", requires: "analytics:view" }
    ]
  },
  {
    label: "Control",
    items: [
      { href: "/operations", label: "Operations", icon: ShieldCheck, description: "Service health and audit" },
      { href: "/admin", label: "Admin", icon: Settings2, description: "Tenant, roles and governance", requires: "audit:view" }
    ]
  }
];

export const navItems = navGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
