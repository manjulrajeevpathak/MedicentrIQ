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

export type AssistantTopicMode = "answer" | "handoff" | "off";

/** A governed capability the bot handles / hands off / doesn't offer. */
export type AssistantTopic = {
  id: string;
  key: string;
  label: string;
  mode: AssistantTopicMode;
  content?: string;
  usesLiveData?: ("doctors" | "branches" | "slots")[];
};

/** A clinical topic the bot may share general (non-diagnostic) info about. */
export type AssistantMedicalTopic = { id?: string; label: string; content: string };

export type AssistantMedicalScope = {
  answerable: AssistantMedicalTopic[];
  handoffTopics: string[];
};

export type AssistantChannels = { whatsapp: boolean; voice: boolean };

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
  /** Which channels the shared policy is live on. */
  channels: AssistantChannels;
  /** The governance grid — what the bot answers / hands off / doesn't offer. */
  topics: AssistantTopic[];
  /** Granular clinical governance. */
  medical: AssistantMedicalScope;
  /** Note appended on handoff (e.g. business hours). */
  hoursNote?: string;
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
  channels?: AssistantChannels;
  topics?: AssistantTopic[];
  medical?: AssistantMedicalScope;
  hoursNote?: string;
};
