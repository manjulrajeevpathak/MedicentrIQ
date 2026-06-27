/**
 * UltraMsg WhatsApp adapter — free-form/session messages (transactional).
 * Per-tenant credentials are passed in (never read from global env). Zero deps.
 */
const ULTRAMSG_BASE = "https://api.ultramsg.com";

export type UltraMsgCreds = { instanceId: string; token: string };
export type SendResult = { ok: true; providerId?: string } | { ok: false; error: string };

export const sendUltraMsg = async (
  creds: UltraMsgCreds,
  to: string,
  body: string
): Promise<SendResult> => {
  if (!creds.instanceId || !creds.token) {
    return { ok: false, error: "UltraMsg is not configured for this hospital." };
  }
  const form = new URLSearchParams({ token: creds.token, to, body });
  try {
    const response = await fetch(`${ULTRAMSG_BASE}/${creds.instanceId}/messages/chat`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000)
    });
    const result = (await response.json().catch(() => ({}))) as {
      sent?: string | boolean;
      id?: string;
      error?: string;
      message?: string;
    };
    const sent = response.ok && (result.sent === "true" || result.sent === true);
    if (!sent) {
      return { ok: false, error: String(result.error ?? result.message ?? `UltraMsg responded with ${response.status}.`) };
    }
    return { ok: true, providerId: result.id ? String(result.id) : undefined };
  } catch (error) {
    return { ok: false, error: `Failed to reach UltraMsg: ${String(error)}` };
  }
};
