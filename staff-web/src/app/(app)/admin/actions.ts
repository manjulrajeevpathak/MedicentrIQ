"use server";

import { revalidatePath } from "next/cache";
import {
  coreApi,
  type AppointmentNotifications,
  type Branch,
  type ManagedUser,
  type MfaPolicy,
  type NotificationEvent
} from "@/lib/users-api";

/**
 * Org-admin User Management server actions. Each reads the session bearer
 * (via `coreApi`) and calls core-api, then revalidates the admin route so the
 * server-rendered table reflects the change.
 */

export type ActionState = {
  ok: boolean;
  error?: string;
  tempPassword?: string;
  user?: ManagedUser;
  message?: string;
};

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roles = formData.getAll("roles").map((r) => String(r));
  const branchIds = formData.getAll("branchIds").map((b) => String(b));

  if (!displayName) return { ok: false, error: "Enter a name." };
  if (!email) return { ok: false, error: "Enter an email." };
  if (roles.length === 0) return { ok: false, error: "Pick at least one role." };

  const result = await coreApi<{ user: ManagedUser; tempPassword: string }>("/users", {
    method: "POST",
    body: { displayName, email, roles, branchIds }
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not create the user. Try again." };
  }

  revalidatePath("/admin");
  return { ok: true, user: result.data.user, tempPassword: result.data.tempPassword };
}

export async function setUserStatusAction(
  id: string,
  status: ManagedUser["status"]
): Promise<ActionState> {
  const result = await coreApi<{ user: ManagedUser }>(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not update the user." };
  }
  revalidatePath("/admin");
  return {
    ok: true,
    user: result.data.user,
    message: status === "active" ? "User reactivated." : "User deactivated."
  };
}

export async function resetUserPasswordAction(id: string): Promise<ActionState> {
  const result = await coreApi<{ ok: boolean; tempPassword: string }>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    { method: "POST" }
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not reset the password." };
  }
  revalidatePath("/admin");
  return { ok: true, tempPassword: result.data.tempPassword, message: "Temporary password generated." };
}

export async function setMfaPolicyAction(policy: MfaPolicy): Promise<ActionState> {
  const result = await coreApi<{ ok: boolean; mfaPolicy: MfaPolicy }>("/tenant/settings", {
    method: "PATCH",
    body: { mfaPolicy: policy }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not update the security policy." };
  }
  revalidatePath("/admin");
  return { ok: true, message: policy === "required" ? "MFA is now required for all staff." : "MFA set to optional." };
}

// ---- Messaging channels (Integrations) ------------------------------------

export type ChannelActionState = { ok: boolean; error?: string; message?: string };

export async function saveChannelsAction(_prev: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const provider = String(formData.get("provider") ?? "");
  const body: Record<string, unknown> = {};

  if (provider === "ultramsg") {
    const instanceId = String(formData.get("instanceId") ?? "").trim();
    const token = String(formData.get("token") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    // Blank token = keep the existing secret (core-api handles this).
    body.ultramsg = { instanceId, ...(token ? { token } : {}), enabled };
  } else if (provider === "aisensy") {
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    body.aisensy = { ...(apiKey ? { apiKey } : {}), enabled };
  } else if (provider === "telephony") {
    const telProvider = String(formData.get("telProvider") ?? "").trim();
    const callerId = String(formData.get("callerId") ?? "").trim();
    const apiKey = String(formData.get("apiKey") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    // Blank apiKey = keep the existing secret (core-api handles this).
    body.telephony = {
      ...(telProvider ? { provider: telProvider } : {}),
      ...(callerId ? { callerId } : {}),
      ...(apiKey ? { apiKey } : {}),
      enabled
    };
  } else {
    return { ok: false, error: "Unknown channel." };
  }

  const result = await coreApi<unknown>("/tenant/channels", { method: "PATCH", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the channel." };
  revalidatePath("/communications/channels");
  return { ok: true, message: "Channel saved." };
}

export async function sendTestMessageAction(_prev: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const to = String(formData.get("to") ?? "").trim();
  const type = String(formData.get("type") ?? "transactional");
  if (!to) return { ok: false, error: "Enter a recipient number (with country code)." };

  const body: Record<string, unknown> =
    type === "marketing"
      ? { to, type, campaign: String(formData.get("campaign") ?? "").trim(), userName: String(formData.get("userName") ?? "").trim() || undefined }
      : { to, type, body: String(formData.get("body") ?? "").trim() || "HealthcareOS test message ✅" };

  const result = await coreApi<{ ok: boolean; channel: string; error?: string }>("/messages/test", { method: "POST", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not send the test." };
  revalidatePath("/communications/channels");
  if (!result.data.ok) return { ok: false, error: result.data.error ?? "The provider rejected the message." };
  return { ok: true, message: `Test sent via ${result.data.channel}.` };
}

// ---- Appointment notifications --------------------------------------------

const NOTIFICATION_EVENTS: NotificationEvent[] = ["booked", "reminder24h", "reminder3h", "cancelled"];

export async function saveNotificationRuleAction(
  event: NotificationEvent,
  rule: { enabled: boolean; body: string; offsetHours?: number }
): Promise<ChannelActionState> {
  if (!NOTIFICATION_EVENTS.includes(event)) return { ok: false, error: "Unknown notification." };

  const result = await coreApi<AppointmentNotifications>("/tenant/notifications", {
    method: "PATCH",
    body: {
      [event]: {
        enabled: rule.enabled,
        body: rule.body,
        ...(typeof rule.offsetHours === "number" ? { offsetHours: rule.offsetHours } : {})
      }
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the notification." };
  revalidatePath("/communications/templates");
  return { ok: true, message: "Notification saved." };
}

// ---- Clinic locations (per-branch contact + map) --------------------------

export type BranchContactActionState = { ok: boolean; error?: string; message?: string; branch?: Branch };

/**
 * Org-admin edit of a branch's patient-facing contact info. Empty strings clear
 * the field (core-api trims + clears). Revalidates the admin route.
 */
export async function saveBranchContactAction(
  branchId: string,
  input: { phone?: string; address?: string; mapUrl?: string }
): Promise<BranchContactActionState> {
  if (!branchId) return { ok: false, error: "Missing branch." };

  const result = await coreApi<{ branch: Branch }>(`/tenant/branches/${encodeURIComponent(branchId)}`, {
    method: "PATCH",
    body: {
      phone: (input.phone ?? "").trim(),
      address: (input.address ?? "").trim(),
      mapUrl: (input.mapUrl ?? "").trim()
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the location." };

  revalidatePath("/admin");
  return { ok: true, branch: result.data.branch, message: "Location saved." };
}
