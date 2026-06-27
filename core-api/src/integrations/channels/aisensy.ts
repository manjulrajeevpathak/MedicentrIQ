/**
 * AISensy WhatsApp adapter — template/campaign messages (marketing). AISensy
 * sends pre-approved campaigns, so a campaign name is required (and optional
 * template params). Per-tenant API key passed in. Zero deps.
 *
 * Send Campaign API: POST https://backend.aisensy.com/campaign/t1/api/v2
 *   { apiKey, campaignName, destination, userName, templateParams[], source }
 */
const AISENSY_BASE = "https://backend.aisensy.com/campaign/t1/api/v2";

export type AiSensyCreds = { apiKey: string };
export type SendResult = { ok: true; providerId?: string } | { ok: false; error: string };

export const sendAiSensy = async (
  creds: AiSensyCreds,
  to: string,
  options: { campaign?: string; userName?: string; params?: string[] }
): Promise<SendResult> => {
  if (!creds.apiKey) {
    return { ok: false, error: "AISensy is not configured for this hospital." };
  }
  if (!options.campaign) {
    return { ok: false, error: "A campaign name is required for marketing (AISensy) messages." };
  }
  try {
    const response = await fetch(AISENSY_BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: creds.apiKey,
        campaignName: options.campaign,
        destination: to,
        userName: options.userName ?? "Patient",
        templateParams: options.params ?? [],
        source: "healthcareos"
      }),
      signal: AbortSignal.timeout(8000)
    });
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      submitted_message_id?: string;
      messageId?: string;
      errorMessage?: string;
      message?: string;
    };
    if (!response.ok || result.success === false) {
      return { ok: false, error: String(result.errorMessage ?? result.message ?? `AISensy responded with ${response.status}.`) };
    }
    return { ok: true, providerId: result.submitted_message_id ?? result.messageId };
  } catch (error) {
    return { ok: false, error: `Failed to reach AISensy: ${String(error)}` };
  }
};
