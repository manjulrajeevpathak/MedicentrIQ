"use server";

import { getDashboard } from "@/lib/data";
import { coreApi } from "@/lib/users-api";
import type { InboxItem } from "@/lib/types";

/**
 * Background poll for the Unified Inbox. Re-runs the session-authed dashboard
 * fetch (per-request cache, so always fresh) and returns just the inbox slice.
 * `source` lets the client skip updates when core-api fell back to mock data.
 */
export async function refreshInboxAction(): Promise<{
  ok: boolean;
  inbox?: InboxItem[];
  source?: string;
}> {
  try {
    const data = await getDashboard();
    return { ok: true, inbox: data.inbox, source: data.source };
  } catch {
    return { ok: false };
  }
}

type CoreSendResponse = { ok?: boolean; channel?: string; error?: string };

/**
 * Staff reply from the Unified Inbox. Sends through core-api so the message
 * goes out on the hospital's own WhatsApp Cloud line (same number and chat the
 * patient is already in) AND lands in the message log — which is what the
 * conversation thread renders from, so the reply survives a refresh.
 * Falls back to UltraMsg where the Cloud API isn't configured.
 */
export async function sendInboxWhatsAppAction(input: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; channel?: string; error?: string }> {
  const to = input.to.trim();
  const body = input.body.trim();
  if (!to || !body) return { ok: false, error: "Recipient and message are required." };

  const cloud = await coreApi<CoreSendResponse>("/messages/send", {
    method: "POST",
    body: { to, body, type: "transactional", provider: "whatsapp_cloud" }
  });
  if (cloud.ok && cloud.data?.ok) return { ok: true, channel: "whatsapp_cloud" };
  const cloudError = cloud.ok ? cloud.data?.error : cloud.error;

  const ultra = await coreApi<CoreSendResponse>("/messages/send", {
    method: "POST",
    body: { to, body, type: "transactional", provider: "ultramsg" }
  });
  if (ultra.ok && ultra.data?.ok) return { ok: true, channel: "ultramsg" };
  const ultraError = ultra.ok ? ultra.data?.error : ultra.error;

  return { ok: false, error: cloudError ?? ultraError ?? "WhatsApp send failed." };
}

/**
 * Staff attachment from the Unified Inbox. The file travels as base64 to
 * core-api, which stores it (S3/local) and sends it on the hospital's
 * WhatsApp Cloud line by link — logged like any message, so it shows in the
 * thread. Cloud API only (UltraMsg has no comparable media-by-link path here).
 */
export async function sendInboxAttachmentAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const to = String(formData.get("to") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const file = formData.get("file");
  if (!to) return { ok: false, error: "Recipient is required." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to send." };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "Attachment too large — 25 MB max." };

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const result = await coreApi<CoreSendResponse>("/messages/send-attachment", {
    method: "POST",
    body: {
      to,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
      ...(caption ? { caption } : {})
    }
  });
  if (result.ok && result.data?.ok) return { ok: true };
  return { ok: false, error: (result.ok ? result.data?.error : result.error) ?? "Attachment send failed." };
}

export type ApprovedWaTemplate = {
  id: string;
  name: string;
  body: string;
  meta: { name: string; language: string; paramTokens: string[] };
};

/** Approved WABA templates — the only messages Meta allows outside the 24h window. */
export async function listApprovedWaTemplatesAction(): Promise<{
  ok: boolean;
  templates?: ApprovedWaTemplate[];
  error?: string;
}> {
  const result = await coreApi<ApprovedWaTemplate[]>("/templates/wa-approved");
  if (result.ok) return { ok: true, templates: result.data ?? [] };
  return { ok: false, error: result.error };
}

/** Out-of-window reply: send an approved template through the Cloud API. */
export async function sendInboxTemplateAction(input: {
  to: string;
  templateName: string;
  language: string;
  params?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const result = await coreApi<CoreSendResponse>("/messages/send", {
    method: "POST",
    body: {
      to: input.to.trim(),
      type: "transactional",
      provider: "whatsapp_cloud",
      template: {
        name: input.templateName,
        language: input.language,
        ...(input.params && input.params.length > 0 ? { params: input.params } : {})
      }
    }
  });
  if (result.ok && result.data?.ok) return { ok: true };
  return { ok: false, error: (result.ok ? result.data?.error : result.error) ?? "Template send failed." };
}

/** Short-lived download URL for a message attachment — for inline images and doc downloads. */
export async function getMessageMediaUrlAction(messageId: string): Promise<{
  ok: boolean;
  url?: string;
  kind?: "image" | "document";
  filename?: string;
  error?: string;
}> {
  const result = await coreApi<{ url?: string; kind?: "image" | "document"; filename?: string }>(
    `/messages/${encodeURIComponent(messageId)}/media-url`
  );
  if (result.ok && result.data?.url) {
    return { ok: true, url: result.data.url, kind: result.data.kind, filename: result.data.filename };
  }
  return { ok: false, error: result.ok ? "No attachment found." : result.error };
}
