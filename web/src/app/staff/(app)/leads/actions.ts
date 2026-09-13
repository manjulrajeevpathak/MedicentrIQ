"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type {
  CallbackChannel,
  CallbackStatus,
  EnrichedCallback,
  Lead,
  LeadCallback,
  LeadConfig,
  LeadDetail,
  LeadForm,
  LeadFormField,
  LeadFunnelStage,
  LeadNote,
  LeadSheetConfig,
  LeadSheetMapping,
  LeadSourceOption
} from "@/lib/leads-types";

// ---- Client-callable loaders (wrap the server-only fetchers so "use client"
// components never import the next/headers-bound data layer) -----------------

export async function loadLeadDetailAction(leadId: string) {
  return coreApi<LeadDetail>(`/leads/${encodeURIComponent(leadId)}`);
}

export async function loadOpenCallbacksAction() {
  return coreApi<EnrichedCallback[]>(`/lead-callbacks?status=open`);
}

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
  revalidatePath("/staff/leads");
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
  revalidatePath("/staff/leads");
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
  revalidatePath("/staff/leads");
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
  revalidatePath("/staff/leads");
  return { ok: true, data: result.data, message: "Source updated." };
}

// ---- Lead detail: notes + callbacks (CRM Phase 2) --------------------------

/** Logs a free-text note against a lead: `POST /leads/:leadId/notes {body}`. */
export async function addLeadNoteAction(
  leadId: string,
  body: string
): Promise<ActionState<LeadNote>> {
  if (!leadId) return { ok: false, error: "Missing lead." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a note first." };

  const result = await coreApi<LeadNote>(`/leads/${encodeURIComponent(leadId)}/notes`, {
    method: "POST",
    body: { body: text }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not add the note." };
  revalidatePath("/staff/leads");
  return { ok: true, data: result.data, message: "Note added." };
}

/**
 * Schedules a callback for a lead: `POST /leads/:leadId/callbacks`. `dueAt` is a
 * pre-computed ISO string (see computeDueAt for the "in N days/months" picks).
 */
export async function scheduleCallbackAction(
  leadId: string,
  input: {
    title: string;
    dueAt: string;
    channel: CallbackChannel;
    assignedTo?: string;
    note?: string;
  }
): Promise<ActionState<LeadCallback>> {
  if (!leadId) return { ok: false, error: "Missing lead." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the callback a title." };
  if (!input.dueAt) return { ok: false, error: "Pick when to call back." };

  const result = await coreApi<LeadCallback>(`/leads/${encodeURIComponent(leadId)}/callbacks`, {
    method: "POST",
    body: {
      title,
      dueAt: input.dueAt,
      channel: input.channel,
      ...(input.assignedTo?.trim() ? { assignedTo: input.assignedTo.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not schedule the callback." };
  revalidatePath("/staff/leads");
  return { ok: true, data: result.data, message: "Callback scheduled." };
}

/**
 * Marks a callback done or cancelled: `PATCH /lead-callbacks/:callbackId {status}`.
 */
export async function updateCallbackAction(
  callbackId: string,
  status: Extract<CallbackStatus, "done" | "cancelled">
): Promise<ActionState<LeadCallback>> {
  if (!callbackId) return { ok: false, error: "Missing callback." };
  if (status !== "done" && status !== "cancelled") {
    return { ok: false, error: "Unsupported callback update." };
  }

  const result = await coreApi<LeadCallback>(`/lead-callbacks/${encodeURIComponent(callbackId)}`, {
    method: "PATCH",
    body: { status }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the callback." };
  revalidatePath("/staff/leads");
  return {
    ok: true,
    data: result.data,
    message: status === "done" ? "Callback marked done." : "Callback cancelled."
  };
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
  revalidatePath("/staff/leads");
  revalidatePath("/staff/patients");
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
  revalidatePath("/staff/leads");
  return {
    ok: true,
    data: result.data,
    message: `Imported ${result.data.created} lead${result.data.created === 1 ? "" : "s"}.`
  };
}

// ---- Google Sheet → Leads sync (CRM Phase 3) -------------------------------

/**
 * Persists the tenant's Google Sheet connection: `PATCH /tenant/lead-sheet`.
 * Any field may be omitted to leave it as-is. The mapping's column names are the
 * exact CSV headers the user typed; phone is the required field at sync time.
 */
export async function saveLeadSheetConfigAction(input: {
  enabled?: boolean;
  csvUrl?: string;
  mapping?: LeadSheetMapping;
  sourceKey?: string;
}): Promise<ActionState<LeadSheetConfig>> {
  const body: Record<string, unknown> = {};
  if (typeof input.enabled === "boolean") body.enabled = input.enabled;
  if (typeof input.csvUrl === "string") body.csvUrl = input.csvUrl.trim();
  if (input.mapping) {
    body.mapping = {
      ...(input.mapping.name?.trim() ? { name: input.mapping.name.trim() } : {}),
      ...(input.mapping.phone?.trim() ? { phone: input.mapping.phone.trim() } : {}),
      ...(input.mapping.email?.trim() ? { email: input.mapping.email.trim() } : {})
    };
  }
  if (typeof input.sourceKey === "string") body.sourceKey = input.sourceKey;
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to save." };

  const result = await coreApi<LeadSheetConfig>("/tenant/lead-sheet", { method: "PATCH", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the sheet connection." };
  revalidatePath("/staff/leads");
  return { ok: true, data: result.data, message: "Sheet connection saved." };
}

/**
 * Triggers an immediate pull of the connected sheet's rows into Leads:
 * `POST /tenant/lead-sheet/sync`. Returns the run's counts (or an envelope error
 * if the URL is unreachable / mapping is incomplete).
 */
export async function syncLeadSheetAction(): Promise<
  ActionState<{ imported: number; skipped: number; total: number }>
> {
  const result = await coreApi<{ imported: number; skipped: number; total: number }>(
    "/tenant/lead-sheet/sync",
    { method: "POST", body: {} }
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not sync the sheet." };
  revalidatePath("/staff/leads");
  return {
    ok: true,
    data: result.data,
    message: `Imported ${result.data.imported} new lead${
      result.data.imported === 1 ? "" : "s"
    }, skipped ${result.data.skipped}.`
  };
}

// ---- Forms -----------------------------------------------------------------

export async function createFormAction(input: {
  title: string;
  description?: string;
  fields: LeadFormField[];
  branchId?: string;
  source?: string;
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
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.source ? { source: input.source } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the form." };
  revalidatePath("/staff/leads");
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
  revalidatePath("/staff/leads");
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
  revalidatePath("/staff/leads");
  revalidatePath("/staff/campaigns");
  return { ok: true, data: result.data, message: "Funnel updated." };
}
