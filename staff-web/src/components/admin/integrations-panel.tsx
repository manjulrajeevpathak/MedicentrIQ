"use client";

import { useActionState, useState } from "react";
import { MessageSquare, Megaphone, Phone, Send, CheckCircle2, Circle, Cloud, Copy, Check } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  saveChannelsAction,
  sendTestMessageAction,
  type ChannelActionState
} from "@/app/(app)/admin/actions";
import type { ChannelStatus } from "@/lib/users-types";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-xs font-medium text-ink-muted";

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
      <CheckCircle2 className="size-3.5" /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint">
      <Circle className="size-3.5" /> Not configured
    </span>
  );
}

/** Small copy-to-clipboard affordance for the webhook URL. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      title="Copy to clipboard"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition hover:bg-fill"
    >
      {copied ? <Check className="size-3 text-good" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function IntegrationsPanel({
  channels,
  gatewayBase
}: {
  channels: ChannelStatus;
  /** Public gateway origin (NEXT_PUBLIC_GATEWAY_URL, read server-side) for the Meta webhook URL. */
  gatewayBase: string;
}) {
  const [umState, saveUm] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [aiState, saveAi] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [waState, saveWa] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [telState, saveTel] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [testState, sendTest] = useActionState<ChannelActionState, FormData>(sendTestMessageAction, { ok: false });

  const wa = channels.whatsappCloud;
  const webhookUrl = `${gatewayBase.replace(/\/$/, "")}${wa.webhookPath}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Integrations · Channels</h2>
        <p className="text-xs text-ink-muted">
          Configure this hospital&rsquo;s own messaging &amp; telephony credentials. Transactional messages send via UltraMsg; marketing via AISensy; calls are logged via telephony.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* UltraMsg */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-brand-600" />
              <span className="text-sm font-semibold text-ink">UltraMsg</span>
              <span className="rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">Transactional</span>
            </div>
            <StatusPill ok={channels.ultramsg.configured} />
          </div>
          <form action={saveUm} className="space-y-3">
            <input type="hidden" name="provider" value="ultramsg" />
            <div>
              <label className={labelCls}>Instance ID</label>
              <input name="instanceId" defaultValue={channels.ultramsg.instanceId ?? ""} placeholder="instance12345" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Token {channels.ultramsg.tokenTail ? `(saved ${channels.ultramsg.tokenTail})` : ""}</label>
              <input name="token" type="password" placeholder={channels.ultramsg.configured ? "•••••• leave blank to keep" : "token"} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="enabled" defaultChecked={channels.ultramsg.enabled} className="size-4" /> Enabled
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              {umState.error ? <span className="text-xs text-critical">{umState.error}</span> : umState.ok ? <span className="text-xs text-good">{umState.message}</span> : null}
            </div>
          </form>
        </Panel>

        {/* AISensy */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-brand-600" />
              <span className="text-sm font-semibold text-ink">AISensy</span>
              <span className="rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">Marketing</span>
            </div>
            <StatusPill ok={channels.aisensy.configured} />
          </div>
          <form action={saveAi} className="space-y-3">
            <input type="hidden" name="provider" value="aisensy" />
            <div>
              <label className={labelCls}>API key {channels.aisensy.apiKeyTail ? `(saved ${channels.aisensy.apiKeyTail})` : ""}</label>
              <input name="apiKey" type="password" placeholder={channels.aisensy.configured ? "•••••• leave blank to keep" : "AISensy API key"} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="enabled" defaultChecked={channels.aisensy.enabled} className="size-4" /> Enabled
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              {aiState.error ? <span className="text-xs text-critical">{aiState.error}</span> : aiState.ok ? <span className="text-xs text-good">{aiState.message}</span> : null}
            </div>
            <p className="text-[11px] text-ink-faint">AISensy sends pre-approved templates — a test needs an existing campaign name.</p>
          </form>
        </Panel>

        {/* WhatsApp Business (Meta) — Cloud API */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-brand-600" />
              <span className="text-sm font-semibold text-ink">WhatsApp Business (Meta)</span>
              <span className="rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">Cloud API</span>
              {wa.configured && wa.enabled ? (
                <span className="rounded bg-[var(--color-good-soft)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-good)]">Enabled</span>
              ) : null}
            </div>
            <StatusPill ok={wa.configured} />
          </div>
          <form action={saveWa} className="space-y-3">
            <input type="hidden" name="provider" value="whatsapp_cloud" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input name="phoneNumberId" defaultValue={wa.phoneNumberId ?? ""} placeholder="1234567890…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WABA ID</label>
                <input name="wabaId" defaultValue={wa.wabaId ?? ""} placeholder="WhatsApp Business Account ID" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Access token {wa.accessTokenTail ? `(saved ${wa.accessTokenTail})` : ""}</label>
              <input name="accessToken" type="password" autoComplete="off" placeholder={wa.accessTokenTail ? "•••••• leave blank to keep" : "Permanent system-user access token"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>App secret {wa.appSecretTail ? `(saved ${wa.appSecretTail})` : ""}</label>
              <input name="appSecret" type="password" autoComplete="off" placeholder={wa.appSecretTail ? "•••••• leave blank to keep" : "Meta app secret (webhook signature check)"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Verify token</label>
              <input name="verifyToken" defaultValue={wa.verifyToken ?? ""} placeholder="Any string you choose" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="enabled" defaultChecked={wa.enabled} className="size-4" /> Enabled
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              {waState.error ? <span className="text-xs text-critical">{waState.error}</span> : waState.ok ? <span className="text-xs text-good">{waState.message}</span> : null}
            </div>
          </form>
          <div className="mt-4 space-y-1.5 rounded-lg border border-line bg-fill/40 p-3">
            <p className="text-xs font-semibold text-ink">Webhook callback URL</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-ink-soft ring-1 ring-inset ring-line">{webhookUrl}</code>
              <CopyButton value={webhookUrl} />
            </div>
            <p className="text-[11px] text-ink-faint">
              Paste this as the callback URL in Meta&rsquo;s webhook configuration, and enter this same
              Verify token there — Meta calls it back to confirm the subscription.
            </p>
          </div>
        </Panel>

        {/* Telephony */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-brand-600" />
              <span className="text-sm font-semibold text-ink">Telephony</span>
              <span className="rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">Calls</span>
            </div>
            <StatusPill ok={channels.telephony.configured} />
          </div>
          <form action={saveTel} className="space-y-3">
            <input type="hidden" name="provider" value="telephony" />
            <div>
              <label className={labelCls}>Provider</label>
              <input name="telProvider" defaultValue={channels.telephony.provider ?? ""} placeholder="e.g. twilio, exotel" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Caller ID</label>
              <input name="callerId" defaultValue={channels.telephony.callerId ?? ""} placeholder="+9180xxxxxxxx" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>API key {channels.telephony.apiKeyTail ? `(saved ${channels.telephony.apiKeyTail})` : ""}</label>
              <input name="apiKey" type="password" placeholder={channels.telephony.configured ? "•••••• leave blank to keep" : "Telephony API key"} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="enabled" defaultChecked={channels.telephony.enabled} className="size-4" /> Enabled
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
              {telState.error ? <span className="text-xs text-critical">{telState.error}</span> : telState.ok ? <span className="text-xs text-good">{telState.message}</span> : null}
            </div>
            <p className="text-[11px] text-ink-faint">Click-to-call &amp; AI-voice — provider integration coming soon. Calls are logged via the call-log API today.</p>
          </form>
        </Panel>
      </div>

      {/* Test send */}
      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <Send className="size-4 text-brand-600" />
          <span className="text-sm font-semibold text-ink">Send a test message</span>
        </div>
        <form action={sendTest} className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className={labelCls}>Channel</label>
            <select name="type" className={inputCls} defaultValue="transactional">
              <option value="transactional">Transactional (UltraMsg)</option>
              <option value="marketing">Marketing (AISensy)</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className={labelCls}>To (with country code)</label>
            <input name="to" placeholder="+9198xxxxxxxx" className={inputCls} />
          </div>
          <div className="md:col-span-1">
            <label className={labelCls}>Message / campaign name</label>
            <input name="body" placeholder="Test message" className={inputCls} />
          </div>
          <div className="md:col-span-1">
            <label className={labelCls}>Campaign (marketing only)</label>
            <input name="campaign" placeholder="campaign name" className={inputCls} />
          </div>
          <div className="md:col-span-4 flex items-center gap-3">
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Send test</button>
            {testState.error ? <span className="text-xs text-critical">{testState.error}</span> : testState.ok ? <span className="text-xs text-good">{testState.message}</span> : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}
