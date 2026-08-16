"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type {
  JourneyStep,
  JourneyTemplate,
  PatientJourney,
  PatientJourneyStatus
} from "@/lib/journeys-types";

/**
 * Journeys server actions. Each reads the session bearer (via `coreApi`), calls
 * core-api with the `{data}`/`{error.message}` envelope, then revalidates the
 * /journeys route so the server-rendered view reflects changes.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Create journey template -----------------------------------------------

export async function createTemplateAction(input: {
  name: string;
  description?: string;
  steps: JourneyStep[];
}): Promise<ActionState<JourneyTemplate>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a template name." };
  const steps = (input.steps ?? [])
    .map((s) => ({ ...s, label: s.label.trim() }))
    .filter((s) => s.label.length > 0);
  if (steps.length === 0) return { ok: false, error: "Add at least one step." };

  const result = await coreApi<JourneyTemplate>("/journey-templates", {
    method: "POST",
    body: {
      name,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      steps
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the template." };
  revalidatePath("/journeys");
  return { ok: true, data: result.data, message: "Template created." };
}

// ---- Enroll a patient ------------------------------------------------------

export async function enrollPatientAction(input: {
  patientId: string;
  templateId: string;
}): Promise<ActionState<PatientJourney>> {
  if (!input.patientId) return { ok: false, error: "Pick a patient." };
  if (!input.templateId) return { ok: false, error: "Pick a journey template." };

  const result = await coreApi<PatientJourney>("/patient-journeys", {
    method: "POST",
    body: { patientId: input.patientId, templateId: input.templateId }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not enroll the patient." };
  revalidatePath("/journeys");
  return { ok: true, data: result.data, message: "Patient enrolled." };
}

// ---- Change journey status -------------------------------------------------

export async function setJourneyStatusAction(
  id: string,
  status: PatientJourneyStatus
): Promise<ActionState<PatientJourney>> {
  if (!id) return { ok: false, error: "Missing journey." };
  const result = await coreApi<PatientJourney>(`/patient-journeys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the journey." };
  revalidatePath("/journeys");
  return { ok: true, data: result.data, message: "Journey updated." };
}

// ---- Send a WhatsApp update ------------------------------------------------

export async function sendJourneyMessageAction(
  id: string,
  body: string
): Promise<ActionState<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing journey." };
  const message = body.trim();
  if (!message) return { ok: false, error: "Enter a message." };

  const result = await coreApi<{ id: string }>(
    `/patient-journeys/${encodeURIComponent(id)}/send-message`,
    { method: "POST", body: { body: message } }
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not send the message." };
  revalidatePath("/journeys");
  return { ok: true, data: result.data, message: "Update sent." };
}
