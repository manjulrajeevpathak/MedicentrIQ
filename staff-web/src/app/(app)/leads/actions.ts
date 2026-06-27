"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { Lead, LeadForm, LeadFormField } from "@/lib/leads-types";

/**
 * Leads / Growth server actions. Each reads the session bearer (via `coreApi`),
 * calls core-api with the `{data}`/`{error.message}` envelope, then revalidates
 * the /leads route so the server-rendered view reflects changes. The public
 * camp-form fetch + submit live in src/app/f/[slug]/actions.ts (no bearer).
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Create lead -----------------------------------------------------------

export async function createLeadAction(input: {
  name: string;
  phone: string;
  email?: string;
  source: string;
  sourceDetail?: string;
  branchId?: string;
}): Promise<ActionState<Lead>> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) return { ok: false, error: "Enter the lead's name." };
  if (!phone) return { ok: false, error: "Enter a phone number." };

  const result = await coreApi<Lead>("/leads", {
    method: "POST",
    body: {
      name,
      phone,
      source: input.source || "other",
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      ...(input.sourceDetail?.trim() ? { sourceDetail: input.sourceDetail.trim() } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the lead." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: "Lead added." };
}

// ---- Update lead (stage / assignee / notes) --------------------------------

export async function updateLeadAction(
  id: string,
  patch: { stage?: string; assignedTo?: string; notes?: string }
): Promise<ActionState<Lead>> {
  if (!id) return { ok: false, error: "Missing lead." };
  const body: Record<string, unknown> = {};
  if (patch.stage) body.stage = patch.stage;
  if (typeof patch.assignedTo === "string") body.assignedTo = patch.assignedTo;
  if (typeof patch.notes === "string") body.notes = patch.notes;
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to update." };

  const result = await coreApi<Lead>(`/leads/${encodeURIComponent(id)}`, { method: "PATCH", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the lead." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: "Lead updated." };
}

// ---- Convert lead → patient ------------------------------------------------

export async function convertLeadAction(
  id: string,
  patientId?: string
): Promise<ActionState<{ id: string }>> {
  if (!id) return { ok: false, error: "Missing lead." };
  const result = await coreApi<{ id: string }>(`/leads/${encodeURIComponent(id)}/convert`, {
    method: "POST",
    body: patientId ? { patientId } : {}
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not convert the lead." };
  revalidatePath("/leads");
  revalidatePath("/patients");
  return { ok: true, data: result.data, message: "Lead converted to a patient." };
}

// ---- Import leads ----------------------------------------------------------

export async function importLeadsAction(input: {
  source: string;
  rows: Array<Record<string, string>>;
  mapping?: { name?: string; phone?: string; email?: string };
}): Promise<ActionState<{ created: number; skipped: number }>> {
  if (!input.rows || input.rows.length === 0) return { ok: false, error: "No rows to import." };

  const result = await coreApi<{ created: number; skipped: number }>("/leads/import", {
    method: "POST",
    body: {
      source: input.source || "import",
      rows: input.rows,
      ...(input.mapping ? { mapping: input.mapping } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not import the leads." };
  revalidatePath("/leads");
  return {
    ok: true,
    data: result.data,
    message: `Imported ${result.data.created} lead${result.data.created === 1 ? "" : "s"}.`
  };
}

// ---- Forms -----------------------------------------------------------------

export async function createFormAction(input: {
  title: string;
  description?: string;
  fields: LeadFormField[];
  branchId?: string;
}): Promise<ActionState<LeadForm>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter a form title." };
  if (!input.fields || input.fields.length === 0) return { ok: false, error: "Add at least one field." };

  const result = await coreApi<LeadForm>("/forms", {
    method: "POST",
    body: {
      title,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      fields: input.fields,
      ...(input.branchId ? { branchId: input.branchId } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the form." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: "Form created." };
}

export async function setFormStatusAction(
  id: string,
  status: "active" | "inactive"
): Promise<ActionState<LeadForm>> {
  if (!id) return { ok: false, error: "Missing form." };
  const result = await coreApi<LeadForm>(`/forms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the form." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: status === "active" ? "Form activated." : "Form deactivated." };
}
