/**
 * Client-safe types + label constants for the User Management surface.
 * No server-only imports (next/headers) so client components can import these.
 */

export type StaffRole = "front_desk" | "call_center" | "care_coordinator" | "nurse" | "doctor" | "org_admin";

export type ManagedUser = {
  id: string;
  tenantId: string;
  displayName: string;
  email: string;
  roles: string[];
  branchIds: string[];
  status: "active" | "inactive" | "suspended";
  mfaEnabled: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type Seats = { used: number; limit: number | null };
export type MfaPolicy = "optional" | "required";

export type UsersPayload = {
  users: ManagedUser[];
  seats: Seats;
  mfaPolicy: MfaPolicy;
};

export type Branch = {
  id: string;
  tenantId: string;
  displayName: string;
  city?: string;
  status?: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error?: string };

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "call_center", label: "Call center" },
  { value: "care_coordinator", label: "Care coordinator" },
  { value: "nurse", label: "Nurse" },
  { value: "doctor", label: "Doctor" },
  { value: "org_admin", label: "Org admin" }
];

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(STAFF_ROLES.map((r) => [r.value, r.label]));
