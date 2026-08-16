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
  tenantId?: string;
  displayName: string;
  city?: string;
  status?: string;
  /** Patient-facing contact phone for this branch. */
  phone?: string;
  /** Postal address ({{address}} token). */
  address?: string;
  /** Google Maps URL / share link ({{mapLink}} token). */
  mapUrl?: string;
  /** Free-text clinic hours, e.g. "Mon–Sat 9am–7pm · Sun closed". */
  timings?: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error?: string };

export type ChannelStatus = {
  ultramsg: { configured: boolean; enabled: boolean; instanceId: string | null; tokenTail: string | null };
  aisensy: { configured: boolean; enabled: boolean; apiKeyTail: string | null };
  telephony: { configured: boolean; enabled: boolean; provider: string | null; callerId: string | null; apiKeyTail: string | null };
  whatsappCloud: {
    configured: boolean;
    enabled: boolean;
    phoneNumberId: string | null;
    wabaId: string | null;
    /** Redacted tail of the stored access token — never the full secret. */
    accessTokenTail: string | null;
    /** Redacted tail of the stored app secret — never the full secret. */
    appSecretTail: string | null;
    verifyToken: string | null;
    /** Meta App ID — needed only for image-header template submissions. */
    appId: string | null;
    /** Gateway-relative webhook path, e.g. "/webhooks/meta/whatsapp/org_xxx". */
    webhookPath: string;
  };
};

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "call_center", label: "Call center" },
  { value: "care_coordinator", label: "Care coordinator" },
  { value: "nurse", label: "Nurse" },
  { value: "doctor", label: "Doctor" },
  { value: "org_admin", label: "Org admin" }
];

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(STAFF_ROLES.map((r) => [r.value, r.label]));
