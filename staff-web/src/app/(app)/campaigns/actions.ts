"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type {
  AudiencePreview,
  Campaign,
  CampaignAudience,
  CampaignDetail,
  CampaignInput,
  CampaignProvider,
  CampaignRecipientsPreview,
  SendResult
} from "@/lib/campaigns-types";
import type { CommTemplate } from "@/lib/comms-types";
import type { WaTemplate } from "@/lib/whatsapp-cloud-types";

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
  if (a.visitOutcomes?.length) {
    out.visitOutcomes = a.visitOutcomes;
    // The look-back window only matters when outcomes are being filtered on.
    if (typeof a.visitWithinDays === "number") out.visitWithinDays = a.visitWithinDays;
  }
  return out;
}

// ---- Create campaign (status: draft) ---------------------------------------

export async function createCampaignAction(input: CampaignInput): Promise<ActionState<Campaign>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a campaign name." };

  const provider: CampaignProvider =
    input.provider === "aisensy" || input.provider === "whatsapp_cloud" ? input.provider : "ultramsg";
  if (provider === "ultramsg" && !input.body?.trim()) {
    return { ok: false, error: "Enter the WhatsApp message body." };
  }
  if (provider === "aisensy" && !input.aisensyCampaign?.trim()) {
    return { ok: false, error: "Enter the AISensy template/campaign name." };
  }
  if (provider === "whatsapp_cloud" && !input.waTemplateName?.trim()) {
    return { ok: false, error: "Pick the Meta-approved WhatsApp template to send." };
  }

  const body: Record<string, unknown> = {
    name,
    channelType: input.channelType,
    provider,
    audience: cleanAudience(input.audience),
    trigger: input.trigger
  };
  if (provider === "ultramsg" && input.body?.trim()) {
    body.body = input.body.trim();
  }
  if (provider === "aisensy" || provider === "whatsapp_cloud") {
    const params = (input.templateParams ?? []).map((p) => p.trim()).filter(Boolean);
    if (params.length) body.templateParams = params;
  }
  if (provider === "aisensy") {
    body.aisensyCampaign = input.aisensyCampaign?.trim();
  }
  if (provider === "whatsapp_cloud") {
    body.waTemplateName = input.waTemplateName?.trim();
    if (input.waTemplateLanguage?.trim()) body.waTemplateLanguage = input.waTemplateLanguage.trim();
  }
  if (input.trigger === "automated" && input.automatedOn) {
    body.automatedOn = input.automatedOn;
  }
  if (input.sendOncePerContact) {
    body.sendOncePerContact = true;
  }
  if (input.schedule && input.schedule.everyDays >= 1) {
    body.schedule = {
      everyDays: Math.floor(input.schedule.everyDays),
      enabled: input.schedule.enabled !== false,
      nextRunAt: input.schedule.nextRunAt
    };
  }

  const result = await coreApi<Campaign>("/campaigns", { method: "POST", body });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the campaign." };
  revalidatePath("/campaigns");
  const message =
    input.trigger === "automated"
      ? "Automated campaign armed."
      : input.schedule
        ? "Recurring campaign scheduled."
        : "Campaign saved as a draft.";
  return { ok: true, data: result.data, message };
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
  if (typeof patch.waTemplateName === "string") body.waTemplateName = patch.waTemplateName.trim();
  if (typeof patch.waTemplateLanguage === "string") body.waTemplateLanguage = patch.waTemplateLanguage.trim();
  if (patch.templateParams) body.templateParams = patch.templateParams;
  if (patch.provider) body.provider = patch.provider;
  if (patch.trigger) body.trigger = patch.trigger;
  if (typeof patch.automatedOn === "string") body.automatedOn = patch.automatedOn;
  if (typeof patch.sendOncePerContact === "boolean") body.sendOncePerContact = patch.sendOncePerContact;
  if (patch.schedule !== undefined) body.schedule = patch.schedule;
  if (Object.keys(body).length === 0) return { ok: false, error: "Nothing to update." };

  const result = await coreApi<Campaign>(`/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update the campaign." };
  revalidatePath("/campaigns");
  return { ok: true, data: result.data, message: "Campaign updated." };
}

// ---- Meta template picker (read-only) --------------------------------------

/** One sendable template for the composer's whatsapp_cloud picker. */
export type SendableWaTemplate = {
  /** Meta template name (what gets sent as waTemplateName). */
  name: string;
  language: string;
  /** Display label: library name, or "<name> (Meta only)" for WABA-only. */
  label: string;
  /**
   * Named token behind each positional param ({{1}} ← paramTokens[0]).
   * Numeric strings ("1", "2") mean params need manual values.
   */
  paramTokens: string[];
  source: "library" | "waba";
};

/** Positional {{n}} placeholders present in a WABA template body. */
function extractPositionalParams(body?: string): string[] {
  if (!body) return [];
  const nums = new Set<number>();
  for (const match of body.matchAll(/\{\{(\d+)\}\}/g)) nums.add(Number(match[1]));
  return [...nums].sort((a, b) => a - b).map(String);
}

/**
 * Approved WhatsApp Cloud (Meta) templates for the composer's template picker:
 * the unified library (templates promoted to Meta) first, then templates that
 * only exist on the WABA. Falls back to a free-text input in the composer when
 * this errors (e.g. the channel isn't configured or Meta is unreachable).
 */
export async function listApprovedWaTemplatesAction(): Promise<ActionState<SendableWaTemplate[]>> {
  const result = await coreApi<{ templates: CommTemplate[]; wabaOnly: WaTemplate[] }>(
    "/templates/sync-meta",
    { method: "POST" }
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not load the Meta templates." };
  }

  const library: SendableWaTemplate[] = (result.data.templates ?? [])
    .filter((t) => t.meta && t.meta.status.toUpperCase() === "APPROVED")
    .map((t) => ({
      name: t.meta!.name,
      language: t.meta!.language,
      label: t.name,
      paramTokens: t.meta!.paramTokens ?? [],
      source: "library" as const
    }));

  const wabaOnly: SendableWaTemplate[] = (result.data.wabaOnly ?? [])
    .filter((t) => t.status?.toUpperCase() === "APPROVED")
    .map((t) => ({
      name: t.name,
      language: t.language,
      label: `${t.name} (Meta only)`,
      paramTokens: extractPositionalParams(t.body),
      source: "waba" as const
    }));

  return { ok: true, data: [...library, ...wabaOnly] };
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

/**
 * Ledger-aware recipient preview for an existing campaign — who's in the segment
 * right now and who would actually receive the next send. Read-only.
 */
export async function previewCampaignRecipientsAction(
  id: string
): Promise<ActionState<CampaignRecipientsPreview>> {
  if (!id) return { ok: false, error: "Missing campaign." };
  const result = await coreApi<CampaignRecipientsPreview>(
    `/campaigns/${encodeURIComponent(id)}/recipients`
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load recipients." };
  return { ok: true, data: result.data };
}

/** Full campaign detail + effectiveness for the detail drawer. Read-only. */
export async function getCampaignDetailAction(id: string): Promise<ActionState<CampaignDetail>> {
  if (!id) return { ok: false, error: "Missing campaign." };
  const result = await coreApi<CampaignDetail>(`/campaigns/${encodeURIComponent(id)}/detail`);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not load campaign." };
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
