"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { Doctor, WeeklyHours } from "@/lib/scheduling-types";

/**
 * Doctor-management server actions. Each reads the session bearer (via
 * `coreApi`) and calls core-api, surfacing the `{error.message}` envelope, then
 * revalidates the /doctors and /appointments routes (booking reads the doctor list).
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

export async function createDoctorAction(input: {
  displayName: string;
  specialty?: string;
  branchIds: string[];
  slotMinutes?: number;
  slotCapacity?: number;
  phone?: string;
}): Promise<ActionState<Doctor>> {
  if (!input.displayName.trim()) return { ok: false, error: "Enter a doctor name." };

  const result = await coreApi<Doctor>("/doctors", {
    method: "POST",
    body: {
      displayName: input.displayName.trim(),
      ...(input.specialty ? { specialty: input.specialty } : {}),
      branchIds: input.branchIds,
      ...(input.slotMinutes ? { slotMinutes: input.slotMinutes } : {}),
      ...(input.slotCapacity ? { slotCapacity: input.slotCapacity } : {}),
      ...(input.phone ? { phone: input.phone } : {})
    }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not add the doctor." };
  }
  revalidatePath("/doctors");
  revalidatePath("/appointments");
  return { ok: true, data: result.data, message: "Doctor added." };
}

export async function updateDoctorAction(
  id: string,
  patch: {
    displayName?: string;
    specialty?: string;
    phone?: string;
    branchIds?: string[];
    status?: Doctor["status"];
  }
): Promise<ActionState<Doctor>> {
  const result = await coreApi<Doctor>(`/doctors/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...patch }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not update the doctor." };
  }
  revalidatePath("/doctors");
  revalidatePath("/appointments");
  return { ok: true, data: result.data, message: "Doctor updated." };
}

export async function setDoctorScheduleAction(
  id: string,
  slotMinutes: number,
  weeklyHours: WeeklyHours,
  slotCapacity?: number
): Promise<ActionState<Doctor>> {
  const result = await coreApi<Doctor>(`/doctors/${encodeURIComponent(id)}/schedule`, {
    method: "PUT",
    body: { slotMinutes, weeklyHours, ...(slotCapacity ? { slotCapacity } : {}) }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not save the schedule." };
  }
  revalidatePath("/doctors");
  revalidatePath("/appointments");
  return { ok: true, data: result.data, message: "Schedule saved." };
}
