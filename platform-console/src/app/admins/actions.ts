"use server";

import { revalidatePath } from "next/cache";
import {
  createAdmin,
  updateAdmin,
  type AdminStatus
} from "@/lib/platform-api";

export interface CreateAdminState {
  error?: string;
  tempPassword?: string;
  email?: string;
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function createAdminAction(
  _prev: CreateAdminState,
  form: FormData
): Promise<CreateAdminState> {
  const displayName = str(form, "displayName");
  const email = str(form, "email");

  if (!displayName || !email) {
    return { error: "Name and email are required." };
  }

  try {
    const { tempPassword, admin } = await createAdmin({ displayName, email });
    revalidatePath("/admins");
    return { tempPassword, email: admin.email };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to invite admin."
    };
  }
}

export async function updateAdminAction(
  id: string,
  status: AdminStatus
): Promise<void> {
  await updateAdmin(id, { status });
  revalidatePath("/admins");
}
