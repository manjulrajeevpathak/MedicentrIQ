"use client";

import { useRef, useState, useTransition } from "react";
import { Bell, CalendarCheck, Clock, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveNotificationRuleAction } from "@/app/(app)/admin/actions";
import type { AppointmentNotifications, NotificationEvent } from "@/lib/users-types";

const TOKENS = ["{{patientName}}", "{{doctorName}}", "{{date}}", "{{time}}", "{{branch}}", "{{confirmLink}}"];

type EventMeta = {
  event: NotificationEvent;
  label: string;
  icon: React.ReactNode;
  needsConfirmLink: boolean;
};

const EVENTS: EventMeta[] = [
  { event: "booked", label: "Booked", icon: <CalendarCheck className="size-4 text-brand-600" />, needsConfirmLink: true },
  { event: "reminder24h", label: "24-hour reminder", icon: <Clock className="size-4 text-brand-600" />, needsConfirmLink: true },
  { event: "reminder3h", label: "3-hour reminder", icon: <Clock className="size-4 text-brand-600" />, needsConfirmLink: true },
  { event: "cancelled", label: "Cancelled", icon: <XCircle className="size-4 text-brand-600" />, needsConfirmLink: false }
];

const textareaCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 min-h-[88px] resize-y";

function RuleCard({
  meta,
  rule
}: {
  meta: EventMeta;
  rule: { enabled: boolean; body: string };
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [body, setBody] = useState(rule.body);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveNotificationRuleAction(meta.event, { enabled, body });
      if (result.ok) toast(result.message ?? "Notification saved.", "success");
      else toast(result.error ?? "Could not save the notification.", "error");
    });
  }

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {meta.icon}
          <span className="text-sm font-semibold text-ink">{meta.label}</span>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
          />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message template…"
        className={textareaCls}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insertToken(token)}
            className="rounded bg-fill px-1.5 py-0.5 font-mono text-[10px] text-ink-muted transition hover:bg-fill-strong hover:text-ink"
          >
            {token}
          </button>
        ))}
      </div>

      {meta.needsConfirmLink ? (
        <p className="mt-2 text-[11px] text-ink-faint">
          Include <span className="font-mono">{"{{confirmLink}}"}</span> to send the patient a tap-to-confirm link.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Panel>
  );
}

export function NotificationsPanel({ notifications }: { notifications: AppointmentNotifications }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Bell className="size-4 text-brand-600" /> Appointment notifications
        </h2>
        <p className="text-xs text-ink-muted">
          Auto-sent over WhatsApp when an appointment is booked, cancelled, or due.
        </p>
        <p className="mt-1 text-[11px] text-ink-faint">
          Messages send via this hospital&rsquo;s configured WhatsApp channel (Admin &rarr; Integrations). Real delivery
          needs live UltraMsg/AISensy credentials.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {EVENTS.map((meta) => (
          <RuleCard key={meta.event} meta={meta} rule={notifications[meta.event]} />
        ))}
      </div>
    </div>
  );
}
