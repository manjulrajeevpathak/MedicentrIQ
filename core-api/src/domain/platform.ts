/**
 * Platform-tier domain: the module catalog and plan tiers that the HealthOS
 * superadmin team uses to configure what each hospital/clinic can access.
 *
 * Modules map 1:1 to staff-web surfaces. A tenant's effective modules are its
 * plan's bundle merged with per-tenant overrides (superadmin can switch an
 * individual module on/off regardless of plan).
 */

export type ModuleKey =
  | "today"
  | "inbox"
  | "patients"
  | "access"
  | "journeys"
  | "continuity"
  | "campaigns"
  | "operations"
  | "admin";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  /** Always-on modules cannot be disabled (core clinical/admin surfaces). */
  alwaysOn: boolean;
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  { key: "today", label: "Today", description: "Daily floor cockpit and work queue.", alwaysOn: true },
  { key: "inbox", label: "Unified Inbox", description: "Multi-channel patient conversations.", alwaysOn: false },
  { key: "patients", label: "Patients & Patient 360", description: "Directory, timeline, identity matching.", alwaysOn: false },
  { key: "access", label: "Access & Scheduling", description: "Slots, holds, confirmation links, no-show risk.", alwaysOn: false },
  { key: "journeys", label: "Care Journeys", description: "Specialty journey and protocol packs.", alwaysOn: false },
  { key: "continuity", label: "Continuity & Follow-up", description: "Follow-up journeys and protocol checklists.", alwaysOn: false },
  { key: "campaigns", label: "Campaigns", description: "WhatsApp templates and broadcasts.", alwaysOn: false },
  { key: "operations", label: "Operations", description: "Service health, control-tower signals, audit feed.", alwaysOn: false },
  { key: "admin", label: "Admin", description: "Roles, permissions, governance.", alwaysOn: true }
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULE_CATALOG.map((module) => module.key);
const ALWAYS_ON_MODULES: ModuleKey[] = MODULE_CATALOG.filter((module) => module.alwaysOn).map((module) => module.key);

export type PlanId = "starter" | "pro" | "enterprise";

export type Plan = {
  id: PlanId;
  label: string;
  description: string;
  modules: ModuleKey[];
  /** Default staff seat limit for the plan (null = unlimited). Org can override. */
  maxUsers: number | null;
};

const STARTER_MODULES: ModuleKey[] = ["today", "inbox", "patients", "access", "admin"];
const PRO_MODULES: ModuleKey[] = [...STARTER_MODULES, "journeys", "continuity", "campaigns"];
const ENTERPRISE_MODULES: ModuleKey[] = [...PRO_MODULES, "operations"];

export const PLAN_CATALOG: Plan[] = [
  { id: "starter", label: "Starter", description: "Front-desk essentials for a single clinic.", modules: STARTER_MODULES, maxUsers: 5 },
  { id: "pro", label: "Pro", description: "Continuity, journeys, campaigns, and ROI.", modules: PRO_MODULES, maxUsers: 25 },
  { id: "enterprise", label: "Enterprise", description: "Full suite incl. care recovery and operations.", modules: ENTERPRISE_MODULES, maxUsers: null }
];

/** Effective staff seat limit for a tenant: per-tenant override wins, else plan default. */
export const resolveSeatLimit = (planId: PlanId, seatLimitOverride?: number | null): number | null => {
  if (seatLimitOverride !== undefined) {
    return seatLimitOverride;
  }
  return planById(planId).maxUsers;
};

export const DEFAULT_PLAN_ID: PlanId = "pro";

export const isPlanId = (value: unknown): value is PlanId =>
  PLAN_CATALOG.some((plan) => plan.id === value);

export const planById = (planId: PlanId): Plan =>
  PLAN_CATALOG.find((plan) => plan.id === planId) ?? PLAN_CATALOG[1];

/**
 * Effective enabled modules for a tenant: plan bundle ∪ always-on modules,
 * then per-tenant overrides applied (true forces on, false forces off — but
 * always-on modules can never be turned off).
 */
export const resolveEnabledModules = (
  planId: PlanId,
  overrides: Partial<Record<ModuleKey, boolean>> = {}
): ModuleKey[] => {
  const enabled = new Set<ModuleKey>([...planById(planId).modules, ...ALWAYS_ON_MODULES]);
  for (const [key, value] of Object.entries(overrides) as [ModuleKey, boolean][]) {
    if (!ALL_MODULE_KEYS.includes(key)) continue;
    if (value) enabled.add(key);
    else if (!ALWAYS_ON_MODULES.includes(key)) enabled.delete(key);
  }
  return ALL_MODULE_KEYS.filter((key) => enabled.has(key));
};
