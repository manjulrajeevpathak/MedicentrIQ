"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { CommTemplate, Workflow, WorkflowStage } from "@/lib/comms-types";
import type { WaTemplate, WaTemplateCategory } from "@/lib/whatsapp-cloud-types";

/**
 * Org-admin server actions for the Communication Workflows engine. Each reads
 * the session bearer (via `coreApi`), calls core-api, then revalidates the
 * relevant /communications route so the server-rendered list reflects changes.
 */

export type CommActionState<T> = { ok: boolean; error?: string; message?: string; data?: T };

// ---- Templates ------------------------------------------------------------

export type SaveTemplateInput = {
  id?: string;
  name: string;
  channel: CommTemplate["channel"];
  kind: CommTemplate["kind"];
  body?: string;
  formId?: string;
  status?: CommTemplate["status"];
};

export async function saveTemplateAction(input: SaveTemplateInput): Promise<CommActionState<CommTemplate>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a template name." };
  if (input.kind === "form" && !input.formId?.trim()) return { ok: false, error: "Pick a form for this template." };

  const payload: Record<string, unknown> = {
    name,
    channel: input.channel,
    kind: input.kind
  };
  if (input.kind === "text") payload.body = input.body ?? "";
  if (input.kind === "form") payload.formId = input.formId?.trim();
  if (input.status) payload.status = input.status;

  const result = input.id
    ? await coreApi<CommTemplate>(`/templates/${input.id}`, { method: "PATCH", body: payload })
    : await coreApi<CommTemplate>("/templates", { method: "POST", body: payload });

  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the template." };
  revalidatePath("/communications/templates");
  return { ok: true, message: input.id ? "Template saved." : "Template created.", data: result.data };
}

export async function archiveTemplateAction(id: string): Promise<CommActionState<never>> {
  const result = await coreApi<unknown>(`/templates/${id}`, { method: "DELETE" });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not archive the template." };
  revalidatePath("/communications/templates");
  return { ok: true, message: "Template archived." };
}

// ---- WhatsApp Cloud API (Meta) promotion ------------------------------------

/**
 * Promote a library template to Meta for review (or re-submit after a body
 * edit). Named {{tokens}} are converted to Meta's {{1}}/{{2}} positional
 * params server-side.
 */
export async function submitTemplateToMetaAction(
  id: string,
  input: { category: WaTemplateCategory; language: string }
): Promise<CommActionState<CommTemplate>> {
  const language = input.language.trim();
  if (!language) return { ok: false, error: "Enter a language code (e.g. en, en_US, hi)." };

  const result = await coreApi<CommTemplate>(`/templates/${id}/submit-meta`, {
    method: "POST",
    body: { category: input.category, language }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not submit the template to Meta." };
  revalidatePath("/communications/templates");
  return {
    ok: true,
    data: result.data,
    message: `Submitted for Meta review — status ${result.data.meta?.status ?? "PENDING"}.`
  };
}

export type SyncMetaResult = {
  /** Active library templates with refreshed Meta statuses. */
  templates: CommTemplate[];
  /** Templates that exist on the WABA but not in the library. */
  wabaOnly: WaTemplate[];
};

/** Refresh Meta statuses on library templates + list WABA-only templates. */
export async function syncMetaTemplatesAction(): Promise<CommActionState<SyncMetaResult>> {
  const result = await coreApi<SyncMetaResult>("/templates/sync-meta", { method: "POST" });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not sync templates from Meta." };
  revalidatePath("/communications/templates");
  return { ok: true, data: result.data };
}

/** Create a library template from a WABA-only Meta template. */
export async function importMetaTemplateAction(input: {
  name: string;
  language: string;
}): Promise<CommActionState<CommTemplate>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Missing template name." };

  const result = await coreApi<CommTemplate>("/templates/import-meta", {
    method: "POST",
    body: { name, language: input.language.trim() }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not import the template." };
  revalidatePath("/communications/templates");
  return { ok: true, data: result.data, message: `Imported "${name}" to the library.` };
}

// ---- Workflows ------------------------------------------------------------

export type SaveWorkflowInput = {
  id?: string;
  name: string;
  description?: string;
  anchor: Workflow["anchor"];
  status?: Workflow["status"];
  stages: WorkflowStage[];
};

function validateStages(stages: WorkflowStage[]): string | null {
  for (const stage of stages) {
    if (!stage.name.trim()) return "Every stage needs a name.";
    if (["message", "call", "form"].includes(stage.action) && !stage.templateId) {
      return `Stage "${stage.name}" needs a template.`;
    }
  }
  return null;
}

export async function saveWorkflowAction(input: SaveWorkflowInput): Promise<CommActionState<Workflow>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a workflow name." };
  const stageError = validateStages(input.stages);
  if (stageError) return { ok: false, error: stageError };

  const result = input.id
    ? await coreApi<Workflow>(`/workflows/${input.id}`, {
        method: "PATCH",
        body: {
          name,
          description: input.description ?? "",
          ...(input.status ? { status: input.status } : {}),
          stages: input.stages
        }
      })
    : await coreApi<Workflow>("/workflows", {
        method: "POST",
        body: {
          name,
          anchor: input.anchor,
          description: input.description ?? "",
          stages: input.stages
        }
      });

  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the workflow." };
  revalidatePath("/communications/workflows");
  return { ok: true, message: input.id ? "Workflow saved." : "Workflow created.", data: result.data };
}

export async function archiveWorkflowAction(id: string): Promise<CommActionState<never>> {
  const result = await coreApi<unknown>(`/workflows/${id}`, { method: "DELETE" });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not archive the workflow." };
  revalidatePath("/communications/workflows");
  return { ok: true, message: "Workflow archived." };
}
