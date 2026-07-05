/**
 * Meta WhatsApp Cloud API adapter — direct Graph API, no BSP. Covers:
 *  - free-form session messages (inside the 24h customer-service window)
 *  - template messages (marketing/utility, outside the window)
 *  - template management on the WABA (list + create/submit for approval)
 *
 * Per-tenant credentials are passed in (never read from global env). Zero deps.
 * The same calls work whether creds were pasted manually (interim path) or
 * obtained via Embedded Signup later — only credential acquisition differs.
 */

const GRAPH_BASE = "https://graph.facebook.com";
const GRAPH_VERSION = "v23.0";

export type WhatsAppCloudCreds = { phoneNumberId: string; accessToken: string };
export type SendResult = { ok: true; providerId?: string } | { ok: false; error: string };

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

const graphUrl = (path: string) => `${GRAPH_BASE}/${GRAPH_VERSION}/${path}`;

const graphErrorText = (result: GraphError, status: number): string =>
  String(result.error?.message ?? `WhatsApp Cloud API responded with ${status}.`);

/** Free-form text message — only delivered inside the 24h service window. */
export const sendWhatsAppCloudText = async (
  creds: WhatsAppCloudCreds,
  to: string,
  body: string
): Promise<SendResult> => {
  if (!creds.phoneNumberId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  return postMessage(creds, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body }
  });
};

/**
 * Template message — required outside the 24h window (marketing/retention).
 * `params` fill the template's positional body variables {{1}}, {{2}}, … in order.
 */
export const sendWhatsAppCloudTemplate = async (
  creds: WhatsAppCloudCreds,
  to: string,
  template: { name: string; language: string; params?: string[] }
): Promise<SendResult> => {
  if (!creds.phoneNumberId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  if (!template.name) {
    return { ok: false, error: "A template name is required for WhatsApp Cloud template sends." };
  }
  const components =
    template.params && template.params.length > 0
      ? [
          {
            type: "body",
            parameters: template.params.map((text) => ({ type: "text", text }))
          }
        ]
      : undefined;
  return postMessage(creds, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language || "en" },
      ...(components ? { components } : {})
    }
  });
};

const postMessage = async (creds: WhatsAppCloudCreds, payload: unknown): Promise<SendResult> => {
  try {
    const response = await fetch(graphUrl(`${creds.phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${creds.accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });
    const result = (await response.json().catch(() => ({}))) as GraphError & {
      messages?: { id?: string }[];
    };
    if (!response.ok) {
      return { ok: false, error: graphErrorText(result, response.status) };
    }
    return { ok: true, providerId: result.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: `Failed to reach WhatsApp Cloud API: ${String(error)}` };
  }
};

// ---- Template management (WABA-level) ---------------------------------------

/** An approved/pending message template on the tenant's WABA. */
export type WaTemplate = {
  id: string;
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | PAUSED | …
  category: string; // MARKETING | UTILITY | AUTHENTICATION
  language: string;
  /** The BODY component text, with {{1}}-style placeholders. */
  body?: string;
  rejectionReason?: string;
};

export type TemplateListResult = { ok: true; templates: WaTemplate[] } | { ok: false; error: string };

/** List message templates on the WABA (paginates up to ~200). */
export const listWhatsAppCloudTemplates = async (creds: {
  wabaId: string;
  accessToken: string;
}): Promise<TemplateListResult> => {
  if (!creds.wabaId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  try {
    const url = new URL(graphUrl(`${creds.wabaId}/message_templates`));
    url.searchParams.set("fields", "id,name,status,category,language,components,rejected_reason");
    url.searchParams.set("limit", "200");
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000)
    });
    const result = (await response.json().catch(() => ({}))) as GraphError & {
      data?: {
        id?: string;
        name?: string;
        status?: string;
        category?: string;
        language?: string;
        rejected_reason?: string;
        components?: { type?: string; text?: string }[];
      }[];
    };
    if (!response.ok) {
      return { ok: false, error: graphErrorText(result, response.status) };
    }
    const templates: WaTemplate[] = (result.data ?? []).map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.name ?? ""),
      status: String(t.status ?? "UNKNOWN"),
      category: String(t.category ?? "UNKNOWN"),
      language: String(t.language ?? ""),
      body: t.components?.find((c) => c.type === "BODY")?.text,
      ...(t.rejected_reason && t.rejected_reason !== "NONE" ? { rejectionReason: t.rejected_reason } : {})
    }));
    return { ok: true, templates };
  } catch (error) {
    return { ok: false, error: `Failed to reach WhatsApp Cloud API: ${String(error)}` };
  }
};

export type TemplateCreateResult = { ok: true; id?: string; status?: string } | { ok: false; error: string };

/**
 * Create a template on the WABA and submit it for Meta approval. Body text uses
 * {{1}}-style placeholders; `sampleParams` provides the example values Meta
 * requires when placeholders are present.
 */
export const createWhatsAppCloudTemplate = async (
  creds: { wabaId: string; accessToken: string },
  template: {
    name: string;
    category: "MARKETING" | "UTILITY";
    language: string;
    body: string;
    sampleParams?: string[];
  }
): Promise<TemplateCreateResult> => {
  if (!creds.wabaId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  const bodyComponent: Record<string, unknown> = { type: "BODY", text: template.body };
  if (template.sampleParams && template.sampleParams.length > 0) {
    bodyComponent.example = { body_text: [template.sampleParams] };
  }
  try {
    const response = await fetch(graphUrl(`${creds.wabaId}/message_templates`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${creds.accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: template.language,
        components: [bodyComponent]
      }),
      signal: AbortSignal.timeout(10_000)
    });
    const result = (await response.json().catch(() => ({}))) as GraphError & { id?: string; status?: string };
    if (!response.ok) {
      return { ok: false, error: graphErrorText(result, response.status) };
    }
    return { ok: true, id: result.id, status: result.status };
  } catch (error) {
    return { ok: false, error: `Failed to reach WhatsApp Cloud API: ${String(error)}` };
  }
};
