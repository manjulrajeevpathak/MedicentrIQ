"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { CommTemplate, Workflow, WorkflowStage } from "@/lib/comms-types";
import type { WaTemplate, WaTemplateInput } from "@/lib/whatsapp-cloud-types";

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

// ---- WhatsApp Cloud API (Meta) templates -----------------------------------

export type WaTemplatesState = {
  ok: boolean;
  error?: string;
  /** 400 from core-api = the WhatsApp Cloud channel isn't configured yet. */
  notConfigured?: boolean;
  templates?: WaTemplate[];
};

/** Live sync of the tenant's Meta-approved template catalog (per-WABA). */
export async function listWhatsappTemplatesAction(): Promise<WaTemplatesState> {
  const result = await coreApi<{ templates: WaTemplate[] }>("/tenant/whatsapp/templates");
  if (!result.ok) {
    return {
      ok: false,
      notConfigured: result.status === 400,
      error: result.error ?? "Could not load the WhatsApp templates."
    };
  }
  return { ok: true, templates: result.data.templates ?? [] };
}

/** Submit a new template to Meta for review. Returns Meta's initial status. */
export async function createWhatsappTemplateAction(
  input: WaTemplateInput
): Promise<CommActionState<{ name: string; id: string; status: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a template name." };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Enter the template body." };
  const language = input.language.trim();
  if (!language) return { ok: false, error: "Pick a language." };

  const sampleParams = (input.sampleParams ?? []).map((p) => p.trim()).filter(Boolean);
  const hasPlaceholders = /\{\{\d+\}\}/.test(body);
  if (hasPlaceholders && sampleParams.length === 0) {
    return { ok: false, error: "Meta needs sample values for each {{n}} placeholder." };
  }

  const result = await coreApi<{ name: string; id: string; status: string }>("/tenant/whatsapp/templates", {
    method: "POST",
    body: {
      name,
      category: input.category,
      language,
      body,
      ...(sampleParams.length ? { sampleParams } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not submit the template to Meta." };
  revalidatePath("/communications/templates");
  return {
    ok: true,
    data: result.data,
    message: `Submitted for Meta review — status ${result.data.status || "PENDING"}.`
  };
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
