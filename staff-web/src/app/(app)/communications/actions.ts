"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { CommTemplate, Workflow, WorkflowStage } from "@/lib/comms-types";

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
