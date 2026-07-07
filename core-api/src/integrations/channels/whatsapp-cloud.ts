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
  template: { name: string; language: string; params?: string[]; headerImageLink?: string }
): Promise<SendResult> => {
  if (!creds.phoneNumberId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  if (!template.name) {
    return { ok: false, error: "A template name is required for WhatsApp Cloud template sends." };
  }
  const components: Record<string, unknown>[] = [];
  if (template.headerImageLink) {
    // IMAGE-header templates need the image supplied per send (Meta fetches the link).
    components.push({ type: "header", parameters: [{ type: "image", image: { link: template.headerImageLink } }] });
  }
  if (template.params && template.params.length > 0) {
    components.push({ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) });
  }
  return postMessage(creds, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language || "en" },
      ...(components.length > 0 ? { components } : {})
    }
  });
};

/**
 * Media message by publicly fetchable link (Meta downloads it at send time) —
 * image or document, delivered inside the 24h service window like free-form text.
 */
export const sendWhatsAppCloudMedia = async (
  creds: WhatsAppCloudCreds,
  to: string,
  media: { kind: "image" | "document"; link: string; caption?: string; filename?: string }
): Promise<SendResult> => {
  if (!creds.phoneNumberId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  const payload =
    media.kind === "image"
      ? { type: "image", image: { link: media.link, ...(media.caption ? { caption: media.caption } : {}) } }
      : {
          type: "document",
          document: {
            link: media.link,
            ...(media.caption ? { caption: media.caption } : {}),
            ...(media.filename ? { filename: media.filename } : {})
          }
        };
  return postMessage(creds, { messaging_product: "whatsapp", recipient_type: "individual", to, ...payload });
};

export type WabaHealthResult =
  | {
      ok: true;
      phone: {
        displayPhoneNumber?: string;
        verifiedName?: string;
        qualityRating?: string;
        messagingLimitTier?: string;
      };
      /** Meta-reported usage for the requested window; absent when analytics are unavailable. */
      spend?: { conversations: number; cost: number };
    }
  | { ok: false; error: string };

/**
 * Number health + spend, straight from Meta. There is NO wallet-balance API for
 * card-billed accounts (Meta invoices after usage), so spend + limits are the
 * trackable signals. `conversation_analytics` needs no extra permissions beyond
 * the WABA-scoped token; it may be absent on brand-new WABAs — tolerated.
 */
export const fetchWhatsAppCloudHealth = async (
  creds: { phoneNumberId: string; wabaId?: string; accessToken: string },
  window: { startTs: number; endTs: number }
): Promise<WabaHealthResult> => {
  const headers = { authorization: `Bearer ${creds.accessToken}` };
  const getPhone = async (fields: string) => {
    const response = await fetch(graphUrl(`${creds.phoneNumberId}?fields=${fields}`), {
      headers,
      signal: AbortSignal.timeout(10_000)
    });
    const result = (await response.json().catch(() => ({}))) as GraphError & Record<string, unknown>;
    return { ok: response.ok, status: response.status, result };
  };

  try {
    // messaging_limit_tier is newer — retry without it for older Graph versions.
    let phone = await getPhone("display_phone_number,verified_name,quality_rating,messaging_limit_tier");
    if (!phone.ok) {
      phone = await getPhone("display_phone_number,verified_name,quality_rating");
    }
    if (!phone.ok) {
      return { ok: false, error: graphErrorText(phone.result, phone.status) };
    }

    let spend: { conversations: number; cost: number } | undefined;
    if (creds.wabaId) {
      const analytics = `conversation_analytics.start(${window.startTs}).end(${window.endTs}).granularity(MONTHLY).phone_numbers([])`;
      const response = await fetch(graphUrl(`${creds.wabaId}?fields=${encodeURIComponent(analytics)}`), {
        headers,
        signal: AbortSignal.timeout(10_000)
      });
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const analyticsData = isRecord(result.conversation_analytics)
        ? (result.conversation_analytics as { data?: { data_points?: { conversation?: number; cost?: number }[] }[] })
        : undefined;
      if (response.ok && analyticsData?.data) {
        let conversations = 0;
        let cost = 0;
        for (const bucket of analyticsData.data) {
          for (const point of bucket.data_points ?? []) {
            conversations += point.conversation ?? 0;
            cost += point.cost ?? 0;
          }
        }
        spend = { conversations, cost };
      }
    }

    return {
      ok: true,
      phone: {
        displayPhoneNumber: asString(phone.result.display_phone_number),
        verifiedName: asString(phone.result.verified_name),
        qualityRating: asString(phone.result.quality_rating),
        messagingLimitTier: asString(phone.result.messaging_limit_tier)
      },
      spend
    };
  } catch (error) {
    return { ok: false, error: `Failed to reach WhatsApp Cloud API: ${String(error)}` };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export type MediaDownload = { ok: true; bytes: Buffer; mimeType: string } | { ok: false; error: string };

/**
 * Download inbound media (patient-sent photo/document). Two steps: resolve the
 * media id to a short-lived lookaside URL, then fetch the bytes — both need the
 * access token. Meta keeps media ~30 days; we persist our own copy on arrival.
 */
export const downloadWhatsAppCloudMedia = async (
  creds: WhatsAppCloudCreds,
  mediaId: string
): Promise<MediaDownload> => {
  try {
    const metaResponse = await fetch(graphUrl(mediaId), {
      headers: { authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(10_000)
    });
    const meta = (await metaResponse.json().catch(() => ({}))) as GraphError & { url?: string; mime_type?: string };
    if (!metaResponse.ok || !meta.url) {
      return { ok: false, error: graphErrorText(meta, metaResponse.status) };
    }
    const fileResponse = await fetch(meta.url, {
      headers: { authorization: `Bearer ${creds.accessToken}` },
      signal: AbortSignal.timeout(30_000)
    });
    if (!fileResponse.ok) {
      return { ok: false, error: `Media download failed (${fileResponse.status}).` };
    }
    return {
      ok: true,
      bytes: Buffer.from(await fileResponse.arrayBuffer()),
      mimeType: meta.mime_type ?? "application/octet-stream"
    };
  } catch (error) {
    return { ok: false, error: `Failed to download WhatsApp media: ${String(error)}` };
  }
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

// ---- Library-template → Meta-template conversion ------------------------------

/**
 * Convert a library template body written with named tokens ({{patientName}},
 * {{branch}}, …) into Meta's positional form ({{1}}, {{2}}, …). Every token
 * OCCURRENCE gets its own sequential number (Meta requires strictly sequential
 * params), and `paramTokens[i]` records the named token behind {{i+1}} so sends
 * can render each param per recipient. Unknown/never-seen tokens are fine —
 * they simply become params too.
 */
export const toMetaTemplateBody = (body: string): { text: string; paramTokens: string[] } => {
  const paramTokens: string[] = [];
  const text = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => {
    paramTokens.push(token);
    return `{{${paramTokens.length}}}`;
  });
  return { text, paramTokens };
};

/** Realistic example values Meta requires for template review, per known token. */
export const SAMPLE_TOKEN_VALUES: Record<string, string> = {
  name: "Anita",
  patientName: "Anita",
  firstName: "Anita",
  doctorName: "Dr. Mehta",
  date: "12 Aug 2026",
  time: "10:30 AM",
  branch: "Main Branch",
  address: "12 MG Road, Delhi",
  mapLink: "https://maps.app.goo.gl/example",
  clinicPhone: "+91 9800000000",
  confirmLink: "https://example.com/c/abc123"
};

export const sampleValueForToken = (token: string): string => SAMPLE_TOKEN_VALUES[token] ?? "Sample";

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
export type TemplateButtonSpec =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url: string }
  | { type: "phone"; text: string; phone: string };

/**
 * Sample-media upload for template approval (Resumable Upload API). Meta wants
 * an uploaded-asset HANDLE (not a URL) as the example for image headers. Needs
 * the Meta App ID; the token is the same WABA-scoped token used everywhere.
 */
export const uploadWhatsAppSampleMedia = async (
  creds: { appId: string; accessToken: string },
  file: { bytes: Buffer; mimeType: string }
): Promise<{ ok: true; handle: string } | { ok: false; error: string }> => {
  try {
    const startResponse = await fetch(
      graphUrl(
        `${creds.appId}/uploads?file_length=${file.bytes.length}&file_type=${encodeURIComponent(file.mimeType)}&access_token=${encodeURIComponent(creds.accessToken)}`
      ),
      { method: "POST", signal: AbortSignal.timeout(10_000) }
    );
    const start = (await startResponse.json().catch(() => ({}))) as GraphError & { id?: string };
    if (!startResponse.ok || !start.id) {
      return { ok: false, error: graphErrorText(start, startResponse.status) };
    }
    const uploadResponse = await fetch(graphUrl(start.id), {
      method: "POST",
      // The Upload API uses the OAuth scheme (not Bearer) + a file_offset header.
      headers: { authorization: `OAuth ${creds.accessToken}`, file_offset: "0" },
      body: new Uint8Array(file.bytes),
      signal: AbortSignal.timeout(30_000)
    });
    const upload = (await uploadResponse.json().catch(() => ({}))) as GraphError & { h?: string };
    if (!uploadResponse.ok || !upload.h) {
      return { ok: false, error: graphErrorText(upload, uploadResponse.status) };
    }
    return { ok: true, handle: upload.h };
  } catch (error) {
    return { ok: false, error: `Failed to upload sample media: ${String(error)}` };
  }
};

export const createWhatsAppCloudTemplate = async (
  creds: { wabaId: string; accessToken: string },
  template: {
    name: string;
    category: "MARKETING" | "UTILITY";
    language: string;
    body: string;
    sampleParams?: string[];
    headerText?: string;
    /** Upload-API handle of the sample image — makes this an IMAGE-header template. */
    headerImageHandle?: string;
    footerText?: string;
    buttons?: TemplateButtonSpec[];
  }
): Promise<TemplateCreateResult> => {
  if (!creds.wabaId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp Cloud API is not configured for this hospital." };
  }
  const components: Record<string, unknown>[] = [];
  if (template.headerImageHandle) {
    components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [template.headerImageHandle] } });
  } else if (template.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: template.headerText });
  }
  const bodyComponent: Record<string, unknown> = { type: "BODY", text: template.body };
  if (template.sampleParams && template.sampleParams.length > 0) {
    bodyComponent.example = { body_text: [template.sampleParams] };
  }
  components.push(bodyComponent);
  if (template.footerText) {
    components.push({ type: "FOOTER", text: template.footerText });
  }
  if (template.buttons && template.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons.map((button) =>
        button.type === "url"
          ? { type: "URL", text: button.text, url: button.url }
          : button.type === "phone"
            ? { type: "PHONE_NUMBER", text: button.text, phone_number: button.phone }
            : { type: "QUICK_REPLY", text: button.text }
      )
    });
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
        components
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
