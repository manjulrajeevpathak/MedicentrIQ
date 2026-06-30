"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type {
  Lead,
  LeadConfig,
  LeadForm,
  LeadFormField,
  LeadFunnelStage,
  LeadSourceOption
} from "@/lib/leads-types";

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

// ---- Move a lead across the funnel -----------------------------------------

/** Moves a lead to a different configured stage: `PATCH /leads/:id {stage}`. */
export async function moveLeadStageAction(
  leadId: string,
  stage: string
): Promise<ActionState<Lead>> {
  if (!leadId) return { ok: false, error: "Missing lead." };
  if (!stage) return { ok: false, error: "Pick a stage to move to." };

  const result = await coreApi<Lead>(`/leads/${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: { stage }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not move the lead." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: "Lead moved." };
}

/** Changes a lead's configured source: `PATCH /leads/:id {source}`. */
export async function changeLeadSourceAction(
  leadId: string,
  source: string
): Promise<ActionState<Lead>> {
  if (!leadId) return { ok: false, error: "Missing lead." };
  if (!source) return { ok: false, error: "Pick a source." };

  const result = await coreApi<Lead>(`/leads/${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    body: { source }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the source." };
  revalidatePath("/leads");
  return { ok: true, data: result.data, message: "Source updated." };
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

// ---- Funnel config (sources + ordered stages) ------------------------------

function cleanConfigList<T extends { key: string; label: string }>(list: T[]): T[] {
  return list
    .map((e) => ({ ...e, key: e.key.trim(), label: e.label.trim() }))
    .filter((e) => e.key && e.label);
}

/**
 * Persists the tenant's funnel config: `PATCH /tenant/lead-config`. Stages are
 * sent in order (= funnel order). Either list may be omitted to leave it as-is.
 */
export async function saveLeadConfigAction(input: {
  sources?: LeadSourceOption[];
  stages?: LeadFunnelStage[];
}): Promise<ActionState<LeadConfig>> {
  const body: Record<string, unknown> = {};
  if (input.sources) {
    const sources = cleanConfigList(input.sources);
    if (sources.length === 0) return { ok: false, error: "Add at least one source." };
    body.sources = sources;
  }
  if (input.stages) {
    const stages = cleanConfigList(input.stages);
    if (stages.length === 0) return { ok: false, error: "Add at least one stage." };
    body.stages = stages;
  }
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to save." };

  const result = await coreApi<LeadConfig>("/tenant/lead-config", { method: "PATCH", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the funnel config." };
  revalidatePath("/leads");
  revalidatePath("/campaigns");
  return { ok: true, data: result.data, message: "Funnel updated." };
}
