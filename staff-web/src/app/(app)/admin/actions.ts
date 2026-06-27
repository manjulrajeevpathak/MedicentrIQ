"use server";

import { revalidatePath } from "next/cache";
import { coreApi, type ManagedUser, type MfaPolicy } from "@/lib/users-api";

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
