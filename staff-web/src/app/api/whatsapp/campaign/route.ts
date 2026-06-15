import { NextResponse } from "next/server";

type Recipient = { name: string; phone: string; [key: string]: string };

function mergeTemplate(body: string, recipient: Recipient): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => recipient[key] ?? `{{${key}}}`);
}

async function sendOne(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  try {
    const params = new URLSearchParams({ token, to, body });
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    if (!res.ok) return { ok: false, error: `UltraMsg ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function POST(request: Request) {
  let body: { templateBody: string; recipients: Recipient[]; delayMs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { templateBody, recipients, delayMs = 600 } = body;
  if (!templateBody || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: "templateBody and recipients[] required" }, { status: 400 });
  }

  const results: Array<{ name: string; phone: string; ok: boolean; error?: string }> = [];

  for (const recipient of recipients) {
    const message = mergeTemplate(templateBody, recipient);
    const result = await sendOne(recipient.phone, message);
    results.push({ name: recipient.name, phone: recipient.phone, ...result });
    if (delayMs > 0 && recipient !== recipients[recipients.length - 1]) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ sent, failed, results });
}
