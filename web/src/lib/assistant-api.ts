import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { AssistantConfig } from "./assistant-types";
import type { OptOut } from "./whatsapp-cloud-types";

/**
 * Server-only reads for the WhatsApp AI Assistant page. Each call goes through
 * `coreApi` (attaches the session bearer + unwraps the {data} envelope).
 * Client-safe types live in ./assistant-types and ./whatsapp-cloud-types.
 */

export async function fetchAssistant(): Promise<ApiResult<AssistantConfig>> {
  return coreApi<AssistantConfig>("/tenant/assistant");
}

export async function fetchOptOuts(): Promise<OptOut[]> {
  const result = await coreApi<OptOut[]>("/tenant/opt-outs");
  if (!result.ok) return [];
  return result.data ?? [];
}
