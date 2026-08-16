import { coreApi } from "./users-api";
import type { CommTemplate, TemplateMessageStats, Workflow } from "./comms-types";

/**
 * Server-only reads for the Communication Workflows engine. Each call goes
 * through `coreApi` (attaches the session bearer + unwraps the envelope) and is
 * gated by the org-admin session the /communications pages already use.
 * Client-safe types live in ./comms-types.
 */

export async function fetchTemplates(): Promise<CommTemplate[]> {
  const result = await coreApi<CommTemplate[]>("/templates");
  if (!result.ok) return [];
  return result.data ?? [];
}

export async function fetchTemplate(id: string): Promise<CommTemplate | null> {
  const result = await coreApi<CommTemplate>(`/templates/${id}`);
  if (!result.ok) return null;
  return result.data;
}

export async function fetchWorkflows(): Promise<Workflow[]> {
  const result = await coreApi<Workflow[]>("/workflows");
  if (!result.ok) return [];
  return result.data ?? [];
}

type MessageLog = { status?: string };

/**
 * Delivery stats for a template: counts message logs by status
 * ("sent" vs "failed") from GET /messages?templateId=<id>.
 */
export async function fetchTemplateMessageStats(id: string): Promise<TemplateMessageStats> {
  const result = await coreApi<MessageLog[]>(`/messages?templateId=${encodeURIComponent(id)}`);
  if (!result.ok) return { sent: 0, failed: 0, total: 0 };
  const logs = result.data ?? [];
  let sent = 0;
  let failed = 0;
  for (const log of logs) {
    if (log.status === "sent") sent += 1;
    else if (log.status === "failed") failed += 1;
  }
  return { sent, failed, total: logs.length };
}
