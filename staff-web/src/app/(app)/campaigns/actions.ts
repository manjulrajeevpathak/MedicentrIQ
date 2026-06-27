"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type {
  AudiencePreview,
  Campaign,
  CampaignAudience,
  CampaignInput,
  SendResult
} from "@/lib/campaigns-types";

/**
 * Campaigns server actions. Each reads the session bearer (via `coreApi`),
 * calls core-api with the `{data}`/`{error.message}` envelope, then revalidates
 * the /campaigns route so the server-rendered list reflects changes. The
 * audience preview is read-only (no revalidate).
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

/** Strip empty arrays so the audience body stays compact. */
function cleanAudience(a: CampaignAudience): CampaignAudience {
  const out: CampaignAudience = { include: a.include };
  if (a.leadStages?.length) out.leadStages = a.leadStages;
  if (a.leadSources?.length) out.leadSources = a.leadSources;
  if (a.patientStages?.length) out.patientStages = a.patientStages;
  if (a.conditionCodes?.length) out.conditionCodes = a.conditionCodes;
  if (a.tags?.length) out.tags = a.tags;
  return out;
}

// ---- Create campaign (status: draft) ---------------------------------------

export async function createCampaignAction(input: CampaignInput): Promise<ActionState<Campaign>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a campaign name." };

  if (input.channelType === "transactional" && !input.body?.trim()) {
    return { ok: false, error: "Enter the WhatsApp message body." };
  }
  if (input.channelType === "marketing" && !input.aisensyCampaign?.trim()) {
    return { ok: false, error: "Enter the AISensy campaign name." };
  }

  const body: Record<string, unknown> = {
    name,
    channelType: input.channelType,
    audience: cleanAudience(input.audience),
    trigger: input.trigger
  };
  if (input.channelType === "transactional" && input.body?.trim()) {
    body.body = input.body.trim();
  }
  if (input.channelType === "marketing") {
    body.aisensyCampaign = input.aisensyCampaign?.trim();
    const params = (input.templateParams ?? []).map((p) => p.trim()).filter(Boolean);
    if (params.length) body.templateParams = params;
  }
  if (input.trigger === "automated" && input.automatedOn) {
    body.automatedOn = input.automatedOn;
  }

  const result = await coreApi<Campaign>("/campaigns", { method: "POST", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the campaign." };
  revalidatePath("/campaigns");
  return { ok: true, data: result.data, message: "Campaign saved as a draft." };
}

// ---- Update campaign -------------------------------------------------------

export async function updateCampaignAction(
  id: string,
  patch: Partial<CampaignInput>
): Promise<ActionState<Campaign>> {
  if (!id) return { ok: false, error: "Missing campaign." };
  const body: Record<string, unknown> = {};
  if (typeof patch.name === "string") body.name = patch.name.trim();
  if (patch.channelType) body.channelType = patch.channelType;
  if (patch.audience) body.audience = cleanAudience(patch.audience);
  if (typeof patch.body === "string") body.body = patch.body;
  if (typeof patch.aisensyCampaign === "string") body.aisensyCampaign = patch.aisensyCampaign;
  if (patch.templateParams) body.templateParams = patch.templateParams;
  if (patch.trigger) body.trigger = patch.trigger;
  if (typeof patch.automatedOn === "string") body.automatedOn = patch.automatedOn;
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to update." };

  const result = await coreApi<Campaign>(`/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the campaign." };
  revalidatePath("/campaigns");
  return { ok: true, data: result.data, message: "Campaign updated." };
}

// ---- Live audience preview (read-only) -------------------------------------

export async function previewAudienceAction(
  audience: CampaignAudience
): Promise<ActionState<AudiencePreview>> {
  const result = await coreApi<AudiencePreview>("/campaigns/preview-audience", {
    method: "POST",
    body: { audience: cleanAudience(audience) }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not preview the audience." };
  return { ok: true, data: result.data };
}

// ---- Send now --------------------------------------------------------------

export async function sendCampaignAction(id: string): Promise<ActionState<SendResult>> {
  if (!id) return { ok: false, error: "Missing campaign." };
  const result = await coreApi<SendResult>(`/campaigns/${encodeURIComponent(id)}/send`, {
    method: "POST"
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error ??
        "Could not send. Check the hospital's WhatsApp channels in Admin → Integrations."
    };
  }
  revalidatePath("/campaigns");
  const { sent, failed, audienceSize } = result.data;
  return {
    ok: true,
    data: result.data,
    message: `Sent ${sent} of ${audienceSize}${failed ? ` · ${failed} failed` : ""}.`
  };
}
