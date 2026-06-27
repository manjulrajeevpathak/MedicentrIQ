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
  "access_requests:read",
  "access_requests:update",
  "documents:create",
  "followups:confirm",
  "journeys:read",
  "journeys:update",
  "messages:send"
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
    "access_requests:read",
    "access_requests:update",
    "documents:create",
    "followups:confirm",
    "journeys:read",
    "journeys:update"
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
    "access_requests:read",
    "access_requests:update"
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
    "documents:create",
    "followups:confirm",
    "access_requests:read",
    "access_requests:update",
    "journeys:read",
    "journeys:update"
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
    "documents:create",
    "followups:confirm",
    "journeys:read",
    "journeys:update"
  ],
  doctor: [
    "auth:read_self",
    "patients:read",
    "interactions:read",
    "tasks:read",
    "appointments:read",
    "documents:create",
    "followups:confirm",
    "journeys:read"
  ],
  admin: [...allStaffPermissions, "audit:read", "service_events:ingest", "users:read", "users:manage", "tenant:settings:manage"],
  org_admin: [...allStaffPermissions, "audit:read", "service_events:ingest", "users:read", "users:manage", "tenant:settings:manage"],
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
