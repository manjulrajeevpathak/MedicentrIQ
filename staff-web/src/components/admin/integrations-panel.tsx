"use client";

import { useActionState } from "react";
import { MessageSquare, Megaphone, Send, CheckCircle2, Circle } from "lucide-react";
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

export function IntegrationsPanel({ channels }: { channels: ChannelStatus }) {
  const [umState, saveUm] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [aiState, saveAi] = useActionState<ChannelActionState, FormData>(saveChannelsAction, { ok: false });
  const [testState, sendTest] = useActionState<ChannelActionState, FormData>(sendTestMessageAction, { ok: false });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Integrations · WhatsApp channels</h2>
        <p className="text-xs text-ink-muted">
          Configure this hospital&rsquo;s own messaging credentials. Transactional messages send via UltraMsg; marketing via AISensy.
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
