"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { AssistantConfig, AssistantPatch } from "@/lib/assistant-types";
import type { OptOut } from "@/lib/whatsapp-cloud-types";

/**
 * Server actions for the WhatsApp AI Assistant page. Each reads the session
 * bearer (via `coreApi`), calls core-api with the `{data}`/`{error.message}`
 * envelope, then revalidates /assistant so the server-rendered config reflects
 * the change.
 */

export type AssistantActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Assistant config -------------------------------------------------------

export async function saveAssistantAction(
  patch: AssistantPatch
): Promise<AssistantActionState<AssistantConfig>> {
  const body: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") body.enabled = patch.enabled;
  if (typeof patch.instructions === "string") body.instructions = patch.instructions;
  if (typeof patch.handoffMessage === "string") body.handoffMessage = patch.handoffMessage;
  if (patch.handoffKeywords) {
    body.handoffKeywords = patch.handoffKeywords.map((k) => k.trim()).filter(Boolean);
  }
  if (patch.knowledge) {
    const invalid = patch.knowledge.some((k) => !k.title.trim() || !k.content.trim());
    if (invalid) return { ok: false, error: "Every knowledge entry needs a title and content." };
    body.knowledge = patch.knowledge.map((k) => ({
      ...(k.id ? { id: k.id } : {}),
      title: k.title.trim(),
      content: k.content.trim()
    }));
  }
  if (typeof patch.hoursNote === "string") body.hoursNote = patch.hoursNote;
  if (patch.channels) body.channels = patch.channels;
  if (patch.topics) body.topics = patch.topics;
  if (patch.medical) {
    body.medical = {
      answerable: patch.medical.answerable
        .filter((m) => m.label.trim() && m.content.trim())
        .map((m) => ({ ...(m.id ? { id: m.id } : {}), label: m.label.trim(), content: m.content.trim() })),
      handoffTopics: patch.medical.handoffTopics.map((t) => t.trim()).filter(Boolean)
    };
  }
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to save." };

  const result = await coreApi<AssistantConfig>("/tenant/assistant", { method: "PATCH", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not save the assistant settings." };
  revalidatePath("/staff/assistant");
  return { ok: true, data: result.data, message: "Assistant settings saved." };
}

/** Test the saved policy against a message (dry-run — never books a real slot). */
export async function previewAssistantAction(
  message: string
): Promise<AssistantActionState<{ reply: string; handoff: boolean }>> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Type a message to test." };
  const result = await coreApi<{ reply: string; handoff: boolean }>("/tenant/assistant/preview", {
    method: "POST",
    body: { message: text }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not run the test." };
  return { ok: true, data: result.data };
}

// ---- Opt-outs ----------------------------------------------------------------

export async function addOptOutAction(input: {
  phone: string;
  reason?: string;
  note?: string;
}): Promise<AssistantActionState<OptOut>> {
  const phone = input.phone.trim();
  if (!phone) return { ok: false, error: "Enter a phone number (with country code)." };

  const result = await coreApi<OptOut>("/tenant/opt-outs", {
    method: "POST",
    body: {
      phone,
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {})
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not add the opt-out." };
  revalidatePath("/staff/assistant");
  return { ok: true, data: result.data, message: "Number opted out — campaigns will skip it." };
}

export async function removeOptOutAction(id: string): Promise<AssistantActionState<never>> {
  if (!id) return { ok: false, error: "Missing opt-out." };
  const result = await coreApi<unknown>(`/tenant/opt-outs/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not remove the opt-out." };
  revalidatePath("/staff/assistant");
  return { ok: true, message: "Opt-out removed — the number can be messaged again." };
}
