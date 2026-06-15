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
  "ai_recommendations:read"
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
    "ai_recommendations:read"
  ],
  call_center: [
    "auth:read_self",
    "patients:read",
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
    "ai_recommendations:read"
  ],
  care_coordinator: [
    "auth:read_self",
    "patients:read",
    "identity:resolve",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "appointments:confirm",
    "documents:create",
    "followups:confirm",
    "access_requests:read",
    "access_requests:update",
    "journeys:read",
    "journeys:update",
    "ai_recommendations:read"
  ],
  nurse: [
    "auth:read_self",
    "patients:read",
    "interactions:read",
    "interactions:create",
    "interactions:update",
    "tasks:read",
    "tasks:update",
    "appointments:read",
    "documents:create",
    "followups:confirm",
    "journeys:read",
    "journeys:update",
    "ai_recommendations:read"
  ],
  doctor: [
    "auth:read_self",
    "patients:read",
    "interactions:read",
    "tasks:read",
    "appointments:read",
    "documents:create",
    "followups:confirm",
    "journeys:read",
    "ai_recommendations:read"
  ],
  admin: [...allStaffPermissions, "ai_recommendations:create", "audit:read", "service_events:ingest"],
  org_admin: [...allStaffPermissions, "ai_recommendations:create", "audit:read", "service_events:ingest"],
  integration_service: [
    "auth:read_self",
    "service_events:ingest"
  ],
  datacentriq_service: [
    "auth:read_self",
    "service_events:ingest"
  ],
  workflow_service: [
    "auth:read_self",
    "service_events:ingest"
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
