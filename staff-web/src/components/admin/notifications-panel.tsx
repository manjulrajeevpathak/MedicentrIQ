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
  /** Plain-English description of WHEN this fires (the automation trigger). */
  when: string;
  icon: React.ReactNode;
  needsConfirmLink: boolean;
  /** Reminders fire N hours before the appointment — N is editable. */
  isReminder?: boolean;
};

const EVENTS: EventMeta[] = [
  {
    event: "booked",
    label: "On booking",
    when: "Sent immediately when an appointment is booked.",
    icon: <CalendarCheck className="size-4 text-brand-600" />,
    needsConfirmLink: true
  },
  {
    event: "reminder24h",
    label: "Early reminder",
    when: "Sent this many hours before the appointment.",
    icon: <Clock className="size-4 text-brand-600" />,
    needsConfirmLink: true,
    isReminder: true
  },
  {
    event: "reminder3h",
    label: "Final reminder",
    when: "Sent this many hours before the appointment.",
    icon: <Clock className="size-4 text-brand-600" />,
    needsConfirmLink: true,
    isReminder: true
  },
  {
    event: "cancelled",
    label: "On cancellation",
    when: "Sent immediately when an appointment is cancelled.",
    icon: <XCircle className="size-4 text-brand-600" />,
    needsConfirmLink: false
  }
];

const textareaCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 min-h-[88px] resize-y";

function RuleCard({
  meta,
  rule
}: {
  meta: EventMeta;
  rule: { enabled: boolean; body: string; offsetHours?: number };
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [body, setBody] = useState(rule.body);
  const [offsetHours, setOffsetHours] = useState<number>(rule.offsetHours ?? (meta.event === "reminder24h" ? 24 : 3));
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
      const result = await saveNotificationRuleAction(meta.event, {
        enabled,
        body,
        ...(meta.isReminder ? { offsetHours } : {})
      });
      if (result.ok) toast(result.message ?? "Notification saved.", "success");
      else toast(result.error ?? "Could not save the notification.", "error");
    });
  }

  return (
    <Panel>
      <div className="mb-1 flex items-center justify-between gap-2">
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

      {/* WHEN it fires — the automation trigger */}
      {meta.isReminder ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <span>Send</span>
          <input
            type="number"
            min={1}
            max={720}
            value={offsetHours}
            onChange={(e) => setOffsetHours(Math.max(1, Math.min(720, Number(e.target.value) || 1)))}
            className="h-7 w-16 rounded-md border border-line bg-surface px-2 text-center text-sm text-ink outline-none focus:border-brand-400"
          />
          <span>hours before the appointment.</span>
        </div>
      ) : (
        <p className="mb-2.5 text-xs text-ink-muted">{meta.when}</p>
      )}

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
          Automations: each rule is a trigger (when it fires) and the WhatsApp message it sends. Toggle any off, edit the
          wording, or change how many hours before the reminders go out.
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
