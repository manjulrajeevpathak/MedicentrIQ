/**
 * Anthropic Messages API adapter for the WhatsApp assistant. Zero deps (fetch).
 *
 * Uses the platform-level ANTHROPIC_API_KEY from core-api's environment — the
 * assistant is a platform capability; hospitals control its BEHAVIOUR via their
 * per-tenant AssistantConfig (instructions/knowledge/handoff), not the key.
 * If the key is unset the assistant is simply unavailable and inbound messages
 * fall through to the human inbox.
 */

const ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages";
// Haiku: right latency/cost point for a high-volume patient-facing chatbot.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export type AssistantReplyResult =
  | { ok: true; reply: string; handoff: boolean }
  | { ok: false; error: string };

export const assistantAvailable = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * One assistant completion. The system prompt carries hospital instructions +
 * knowledge + live context; `turns` is the recent conversation (oldest first,
 * ending with the patient's newest message). The model is asked to append a
 * literal `[HANDOFF]` marker when a human should take over — we strip it and
 * surface it as a flag.
 */
export const generateAssistantReply = async (
  systemPrompt: string,
  turns: AssistantTurn[]
): Promise<AssistantReplyResult> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }
  try {
    const response = await fetch(ANTHROPIC_BASE, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || DEFAULT_MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: turns.map((t) => ({ role: t.role, content: t.content }))
      }),
      signal: AbortSignal.timeout(30_000)
    });
    const result = (await response.json().catch(() => ({}))) as {
      content?: { type?: string; text?: string }[];
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ok: false, error: String(result.error?.message ?? `Anthropic API responded with ${response.status}.`) };
    }
    const text = (result.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) {
      return { ok: false, error: "Assistant returned an empty reply." };
    }
    const handoff = text.includes("[HANDOFF]");
    const reply = text.replaceAll("[HANDOFF]", "").trim();
    return { ok: true, reply, handoff };
  } catch (error) {
    return { ok: false, error: `Failed to reach the Anthropic API: ${String(error)}` };
  }
};
