import { NextResponse } from "next/server";

/**
 * Server-side outbound WhatsApp send via UltraMsg.
 *
 * The UltraMsg token stays on the server (read from env) and is never shipped to
 * the browser. Mirrors:
 *   curl --request POST \
 *     --url https://api.ultramsg.com/<instance>/messages/chat \
 *     --header 'content-type: application/x-www-form-urlencoded' \
 *     --data-urlencode 'token=...' --data-urlencode 'to=...' --data-urlencode 'body=...'
 */
const ULTRAMSG_BASE = "https://api.ultramsg.com";

export async function POST(request: Request) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp sending is not configured. Set ULTRAMSG_INSTANCE_ID and ULTRAMSG_TOKEN in staff-web/.env.local." },
      { status: 503 }
    );
  }

  let payload: { to?: string; body?: string };
  try {
    payload = (await request.json()) as { to?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const to = (payload.to ?? process.env.ULTRAMSG_DEFAULT_TO ?? "").trim();
  const body = (payload.body ?? "").trim();

  if (!to) return NextResponse.json({ ok: false, error: "Recipient number (to) is required." }, { status: 400 });
  if (!body) return NextResponse.json({ ok: false, error: "Message body is required." }, { status: 400 });

  const form = new URLSearchParams({ token, to, body });

  try {
    const response = await fetch(`${ULTRAMSG_BASE}/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    // UltraMsg returns { sent: "true", id, message } on success, or { error } otherwise.
    const result = (await response.json().catch(() => ({}))) as {
      sent?: string | boolean;
      id?: string;
      error?: string;
      message?: string;
    };

    const sent = response.ok && (result.sent === "true" || result.sent === true);
    if (!sent) {
      const message = result.error ?? result.message ?? `UltraMsg responded with ${response.status}.`;
      return NextResponse.json({ ok: false, error: String(message), raw: result }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: result.id ?? null, to });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to reach UltraMsg.", detail: String(error) }, { status: 502 });
  }
}
