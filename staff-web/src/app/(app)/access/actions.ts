"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import { fetchAppointments, fetchDoctorSlots } from "@/lib/scheduling-api";
import type {
  Appointment,
  AppointmentStatus,
  Doctor,
  Slot,
  WeeklyHours
} from "@/lib/scheduling-types";

/**
 * Appointments / scheduling server actions. Each reads the session bearer (via
 * `coreApi`) and calls core-api, surfacing the `{error.message}` envelope, then
 * revalidates the /access route so the server-rendered view reflects changes.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Booking & slots -------------------------------------------------------

export async function loadSlotsAction(
  doctorId: string,
  date: string,
  branchId?: string
): Promise<ActionState<Slot[]>> {
  if (!doctorId) return { ok: false, error: "Pick a doctor." };
  const result = await fetchDoctorSlots(doctorId, date, branchId);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not load available slots." };
  }
  return { ok: true, data: result.data };
}

export async function loadAppointmentsAction(
  doctorId: string,
  date: string
): Promise<ActionState<Appointment[]>> {
  const result = await fetchAppointments({ doctorId: doctorId || undefined, date });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not load appointments." };
  }
  return { ok: true, data: result.data };
}

export async function bookAppointmentAction(input: {
  patientId: string;
  doctorId: string;
  branchId: string;
  scheduledAt: string;
  reason?: string;
}): Promise<ActionState<Appointment>> {
  if (!input.patientId) return { ok: false, error: "Pick a patient." };
  if (!input.doctorId) return { ok: false, error: "Pick a doctor." };
  if (!input.scheduledAt) return { ok: false, error: "Pick a slot." };

  const result = await coreApi<Appointment>("/appointments", {
    method: "POST",
    body: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      branchId: input.branchId,
      scheduledAt: input.scheduledAt,
      ...(input.reason ? { reason: input.reason } : {})
    }
  });

  if (!result.ok) {
    // 409 (slot taken) / 400 (outside schedule) messages are surfaced verbatim.
    return { ok: false, error: result.error ?? "Could not book the appointment." };
  }
  revalidatePath("/access");
  return { ok: true, data: result.data, message: "Appointment booked." };
}

export async function setAppointmentStatusAction(
  id: string,
  status: AppointmentStatus
): Promise<ActionState<Appointment>> {
  const result = await coreApi<Appointment>(`/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not update the appointment." };
  }
  revalidatePath("/access");
  return { ok: true, data: result.data, message: "Appointment updated." };
}

export async function sendConfirmationsAction(): Promise<ActionState<{ sent: number; failed: number }>> {
  const result = await coreApi<{ sent: number; failed: number }>("/scheduling/send-confirmations", {
    method: "POST"
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not send confirmations." };
  }
  revalidatePath("/access");
  return {
    ok: true,
    data: result.data,
    message: `Sent ${result.data.sent}, failed ${result.data.failed}.`
  };
}

// ---- Doctors management ----------------------------------------------------

export async function createDoctorAction(input: {
  displayName: string;
  specialty?: string;
  branchIds: string[];
  slotMinutes?: number;
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
      ...(input.phone ? { phone: input.phone } : {})
    }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not add the doctor." };
  }
  revalidatePath("/access");
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
  revalidatePath("/access");
  return { ok: true, data: result.data, message: "Doctor updated." };
}

export async function setDoctorScheduleAction(
  id: string,
  slotMinutes: number,
  weeklyHours: WeeklyHours
): Promise<ActionState<Doctor>> {
  const result = await coreApi<Doctor>(`/doctors/${encodeURIComponent(id)}/schedule`, {
    method: "PUT",
    body: { slotMinutes, weeklyHours }
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not save the schedule." };
  }
  revalidatePath("/access");
  return { ok: true, data: result.data, message: "Schedule saved." };
}
