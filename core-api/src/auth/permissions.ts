import type { Permission, RequestContext, Role } from "../domain/types.js";

const allStaffPermissions: Permission[] = [
  "auth:read_self",
  "patients:read",
  "patients:create",
  "identity:resolve",
  "interactions:read",
  "interactions:create",
  "interactions:update",
  "tasks:read",
  "tasks:update",
  "appointments:read",
  "appointments:create",
  "appointments:confirm",
  "doctors:read",
  "access_requests:read",
  "access_requests:update",
  "documents:create",
  "documents:read",
  "clinical:read",
  "clinical:write",
  "followups:confirm",
  "followups:manage",
  "billing:read",
  "billing:manage",
  "journeys:read",
  "journeys:update",
  "messages:send",
  "leads:read",
  "leads:manage",
  "campaigns:read",
  "campaigns:manage",
  "campaigns:send",
  "calls:read",
  "calls:manage"
];

export const rolePermissions: Record<Role, Permission[]> = {
  front_desk: [
    "auth:read_self",
    "patients:read",
    "patients:create",
    "identity:resolve",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "messages:send",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "appointments:create",
    "appointments:confirm",
    "doctors:read",
    "access_requests:read",
    "access_requests:update",
    "documents:create",
    "documents:read",
    "followups:confirm",
    "billing:read",
    "billing:manage",
    "journeys:read",
    "journeys:update",
    "leads:read",
    "leads:manage",
    "campaigns:read",
    "calls:read",
    "calls:manage"
  ],
  call_center: [
    "auth:read_self",
    "patients:read",
    "identity:resolve",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "messages:send",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "appointments:create",
    "appointments:confirm",
    "doctors:read",
    "access_requests:read",
    "access_requests:update",
    "leads:read",
    "leads:manage",
    "campaigns:read",
    "calls:read",
    "calls:manage"
  ],
  care_coordinator: [
    "auth:read_self",
    "patients:read",
    "identity:resolve",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "messages:send",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "appointments:confirm",
    "doctors:read",
    "documents:create",
    "documents:read",
    "clinical:read",
    "clinical:write",
    "followups:confirm",
    "followups:manage",
    "billing:read",
    "access_requests:read",
    "access_requests:update",
    "journeys:read",
    "journeys:update",
    "leads:read",
    "leads:manage",
    "campaigns:read",
    "campaigns:manage",
    "campaigns:send",
    "calls:read",
    "calls:manage"
  ],
  nurse: [
    "auth:read_self",
    "patients:read",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "messages:send",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "doctors:read",
    "documents:create",
    "documents:read",
    "clinical:read",
    "clinical:write",
    "followups:confirm",
    "followups:manage",
    "journeys:read",
    "journeys:update"
  ],
  doctor: [
    "auth:read_self",
    "patients:read",
    "interactions:read",
    "tasks:read",
    "appointments:read",
    "appointments:create",
    "documents:create",
    "documents:read",
    "clinical:read",
    "clinical:write",
    "followups:confirm",
    "journeys:read"
  ],
  admin: [...allStaffPermissions, "audit:read", "service_events:ingest", "users:read", "users:manage", "tenant:settings:manage", "doctors:manage", "forms:manage"],
  org_admin: [...allStaffPermissions, "audit:read", "service_events:ingest", "users:read", "users:manage", "tenant:settings:manage", "doctors:manage", "forms:manage"],
  integration_service: [
    "auth:read_self",
    "service_events:ingest"
  ],
  workflow_service: [
    "auth:read_self",
    "service_events:ingest"
  ],
  platform_admin: [
    "auth:read_self",
    "platform:tenants:read",
    "platform:tenants:manage",
    "platform:entitlements:manage",
    "platform:admins:read",
    "platform:admins:manage"
  ]
};

export const permissionsForRoles = (roles: Role[]): Permission[] => {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of rolePermissions[role] ?? []) {
      permissions.add(permission);
    }
  }
  return [...permissions];
};

export const hasPermission = (context: RequestContext, permission: Permission): boolean =>
  context.permissions.includes(permission);
