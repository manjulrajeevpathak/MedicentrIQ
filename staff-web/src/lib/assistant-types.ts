/**
 * Client-safe types for the WhatsApp AI Assistant surface. No server-only
 * imports (next/headers) so client components can import these freely.
 * Mirrors core-api's GET/PATCH /tenant/assistant contract ({data} envelope).
 */

/** One knowledge-base entry the assistant can answer from. */
export type AssistantKnowledgeEntry = {
  /** Entries without an id get one assigned server-side on save. */
  id?: string;
  title: string;
  content: string;
};

export type AssistantConfig = {
  tenantId: string;
  enabled: boolean;
  /** Persona / behaviour instructions for the assistant. */
  instructions?: string;
  knowledge: AssistantKnowledgeEntry[];
  /** Message sent to the patient when the assistant hands off to staff. */
  handoffMessage?: string;
  /** Keywords that force an immediate handoff to the Inbox. */
  handoffKeywords: string[];
  /** False when the platform has no ANTHROPIC_API_KEY — messages fall through to the Inbox. */
  available: boolean;
};

/** Fields PATCHable on /tenant/assistant. */
export type AssistantPatch = {
  enabled?: boolean;
  instructions?: string;
  handoffMessage?: string;
  handoffKeywords?: string[];
  knowledge?: AssistantKnowledgeEntry[];
};
