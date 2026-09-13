"use server";

import { revalidatePath } from "next/cache";
import {
  coreApi,
  type Branch,
  type ManagedUser,
  type MfaPolicy
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

export type WaHealth = {
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  messagingLimitTier?: string;
  dailyLimit: number | null;
  usedToday: number;
  remainingToday: number | null;
  monthSpend: { conversations: number; cost: number } | null;
  checkedAt: string;
};

/**
 * Number health straight from Meta: quality rating, daily messaging tier and
 * month-to-date spend. Meta has no wallet-balance API for card-billed accounts —
 * spend + limits are the trackable signals.
 */
export async function fetchWaHealthAction(): Promise<{ ok: boolean; health?: WaHealth; error?: string }> {
  const result = await coreApi<WaHealth>("/tenant/whatsapp/health");
  if (result.ok && result.data) return { ok: true, health: result.data };
  return { ok: false, error: result.ok ? "No health data returned." : result.error };
}

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

  revalidatePath("/staff/admin");
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
  revalidatePath("/staff/admin");
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
  revalidatePath("/staff/admin");
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
  revalidatePath("/staff/admin");
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
  } else if (provider === "whatsapp_cloud") {
    const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
    const wabaId = String(formData.get("wabaId") ?? "").trim();
    const accessToken = String(formData.get("accessToken") ?? "").trim();
    const appSecret = String(formData.get("appSecret") ?? "").trim();
    const verifyToken = String(formData.get("verifyToken") ?? "").trim();
    const appId = String(formData.get("appId") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    // Blank accessToken/appSecret = keep the existing secrets (core-api handles this).
    body.whatsappCloud = {
      ...(phoneNumberId ? { phoneNumberId } : {}),
      ...(wabaId ? { wabaId } : {}),
      ...(accessToken ? { accessToken } : {}),
      ...(appSecret ? { appSecret } : {}),
      ...(verifyToken ? { verifyToken } : {}),
      ...(appId ? { appId } : {}),
      enabled
    };
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
  revalidatePath("/staff/communications/channels");
  return { ok: true, message: "Channel saved." };
}

export async function sendTestMessageAction(_prev: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const to = String(formData.get("to") ?? "").trim();
  const type = String(formData.get("type") ?? "transactional");
  if (!to) return { ok: false, error: "Enter a recipient number (with country code)." };

  const body: Record<string, unknown> =
    type === "marketing"
      ? { to, type, campaign: String(formData.get("campaign") ?? "").trim(), userName: String(formData.get("userName") ?? "").trim() || undefined }
      : { to, type, body: String(formData.get("body") ?? "").trim() || "HealthFlow test message ✅" };

  const result = await coreApi<{ ok: boolean; channel: string; error?: string }>("/messages/test", { method: "POST", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not send the test." };
  revalidatePath("/staff/communications/channels");
  if (!result.data.ok) return { ok: false, error: result.data.error ?? "The provider rejected the message." };
  return { ok: true, message: `Test sent via ${result.data.channel}.` };
}

// ---- Clinic locations (per-branch contact + map) --------------------------

export type BranchContactActionState = { ok: boolean; error?: string; message?: string; branch?: Branch };

/**
 * Org-admin edit of a branch's patient-facing contact info. Empty strings clear
 * the field (core-api trims + clears). Revalidates the admin route.
 */
export async function saveBranchContactAction(
  branchId: string,
  input: { phone?: string; address?: string; mapUrl?: string; timings?: string }
): Promise<BranchContactActionState> {
  if (!branchId) return { ok: false, error: "Missing branch." };

  const result = await coreApi<{ branch: Branch }>(`/tenant/branches/${encodeURIComponent(branchId)}`, {
    method: "PATCH",
    body: {
      phone: (input.phone ?? "").trim(),
      address: (input.address ?? "").trim(),
      mapUrl: (input.mapUrl ?? "").trim(),
      timings: (input.timings ?? "").trim()
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the location." };

  revalidatePath("/staff/admin");
  return { ok: true, branch: result.data.branch, message: "Location saved." };
}
