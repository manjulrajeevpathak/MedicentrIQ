"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { FollowUp, FollowUpStatus } from "@/lib/continuity-types";

/**
 * Continuity / follow-up server actions. Each reads the session bearer (via
 * `coreApi`), calls core-api with the `{data}`/`{error.message}` envelope, then
 * revalidates the /continuity route so the server-rendered view reflects changes.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Create follow-up ------------------------------------------------------

export async function createFollowUpAction(input: {
  patientId: string;
  title: string;
  dueAt: string;
  instructions?: string;
}): Promise<ActionState<FollowUp>> {
  if (!input.patientId) return { ok: false, error: "Pick a patient." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter a follow-up title." };
  if (!input.dueAt) return { ok: false, error: "Pick a due date." };
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) return { ok: false, error: "That due date isn't valid." };

  const result = await coreApi<FollowUp>("/followups", {
    method: "POST",
    body: {
      patientId: input.patientId,
      title,
      dueAt: due.toISOString(),
      ...(input.instructions?.trim() ? { instructions: input.instructions.trim() } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the follow-up." };
  revalidatePath("/staff/continuity");
  return { ok: true, data: result.data, message: "Follow-up created." };
}

// ---- Update follow-up (status / due / instructions) ------------------------

export async function updateFollowUpAction(
  id: string,
  patch: { status?: FollowUpStatus; dueAt?: string; instructions?: string }
): Promise<ActionState<FollowUp>> {
  if (!id) return { ok: false, error: "Missing follow-up." };
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (patch.dueAt) {
    const due = new Date(patch.dueAt);
    if (Number.isNaN(due.getTime())) return { ok: false, error: "That due date isn't valid." };
    body.dueAt = due.toISOString();
  }
  if (typeof patch.instructions === "string") body.instructions = patch.instructions;
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to update." };

  const result = await coreApi<FollowUp>(`/followups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the follow-up." };
  revalidatePath("/staff/continuity");
  return { ok: true, data: result.data, message: "Follow-up updated." };
}

// ---- Send a WhatsApp reminder ----------------------------------------------

export async function remindFollowUpAction(id: string): Promise<ActionState<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing follow-up." };
  const result = await coreApi<{ id: string }>(`/followups/${encodeURIComponent(id)}/remind`, {
    method: "POST"
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not send the reminder." };
  revalidatePath("/staff/continuity");
  return { ok: true, data: result.data, message: "Reminder sent." };
}
