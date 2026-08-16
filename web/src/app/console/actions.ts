"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createTenant,
  getTenant,
  updateTenant,
  updateTenantUser,
  type CreateTenantInput,
  type PlanId,
  type TenantStatus,
  type TenantType
} from "@console/lib/platform-api";

export interface CreateTenantState {
  error?: string;
}

export interface AdminEditState {
  error?: string;
  ok?: boolean;
}

export async function updateTenantAdminAction(
  tenantId: string,
  userId: string,
  _prev: AdminEditState,
  form: FormData
): Promise<AdminEditState> {
  const displayName = String(form.get("displayName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  try {
    await updateTenantUser(tenantId, userId, { displayName, email });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update admin." };
  }
  revalidatePath(`/tenants/${tenantId}`);
  return { ok: true };
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function createTenantAction(
  _prev: CreateTenantState,
  form: FormData
): Promise<CreateTenantState> {
  const input: CreateTenantInput = {
    displayName: str(form, "displayName"),
    type: (str(form, "type") || "hospital") as TenantType,
    planId: (str(form, "planId") || "starter") as PlanId,
    branchName: str(form, "branchName"),
    branchCity: str(form, "branchCity"),
    adminName: str(form, "adminName"),
    adminEmail: str(form, "adminEmail")
  };

  if (
    !input.displayName ||
    !input.branchName ||
    !input.branchCity ||
    !input.adminName ||
    !input.adminEmail
  ) {
    return { error: "All fields are required." };
  }

  let tenantId: string;
  try {
    const tenant = await createTenant(input);
    tenantId = tenant.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to onboard tenant."
    };
  }

  revalidatePath("/console");
  redirect(`/tenants/${tenantId}`);
}

export async function setPlanAction(id: string, planId: PlanId): Promise<void> {
  await updateTenant(id, { planId });
  revalidatePath(`/tenants/${id}`);
  revalidatePath("/console");
}

export async function setStatusAction(
  id: string,
  status: TenantStatus
): Promise<void> {
  await updateTenant(id, { status });
  revalidatePath(`/tenants/${id}`);
  revalidatePath("/console");
}

export async function setModuleOverrideAction(
  id: string,
  moduleKey: string,
  enabled: boolean
): Promise<void> {
  // Merge with existing overrides so a single toggle never clobbers the rest.
  const current = await getTenant(id);
  const moduleOverrides = { ...current.moduleOverrides, [moduleKey]: enabled };
  await updateTenant(id, { moduleOverrides });
  revalidatePath(`/tenants/${id}`);
  revalidatePath("/console");
}
