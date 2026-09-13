export type SendWhatsAppResult = { ok: boolean; id?: string | null; error?: string };

/** Client helper: posts to the server route that talks to UltraMsg (token stays server-side). */
export async function sendWhatsApp(input: { to: string; body: string }): Promise<SendWhatsAppResult> {
  try {
    const response = await fetch("/staff/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = (await response.json().catch(() => ({}))) as SendWhatsAppResult;
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? `Send failed (${response.status}).` };
    }
    return data;
  } catch {
    return { ok: false, error: "Network error while sending WhatsApp message." };
  }
}
