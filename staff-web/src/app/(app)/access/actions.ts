"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import { fetchAppointments, fetchDoctorSlots } from "@/lib/scheduling-api";
import type { Appointment, AppointmentStatus, Slot } from "@/lib/scheduling-types";

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
