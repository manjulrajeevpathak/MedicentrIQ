"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { CheckCircle2, FileText, MessageSquare, Phone, Plus, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { saveTemplateAction, archiveTemplateAction } from "@/app/(app)/communications/actions";
import {
  CHANNEL_LABELS,
  KIND_LABELS,
  TEMPLATE_TOKENS,
  type CommTemplate,
  type CommChannel,
  type CommKind,
  type TemplateMessageStats
} from "@/lib/comms-types";

const selectCls =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200";
const textareaCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200 min-h-[140px] resize-y";

type Draft = {
  id?: string;
  name: string;
  channel: CommChannel;
  kind: CommKind;
  body: string;
  formId: string;
  status: CommTemplate["status"];
};

const NEW_DRAFT: Draft = { name: "", channel: "whatsapp", kind: "text", body: "", formId: "", status: "active" };

function toDraft(t: CommTemplate): Draft {
  return {
    id: t.id,
    name: t.name,
    channel: t.channel,
    kind: t.kind,
    body: t.body ?? "",
    formId: t.formId ?? "",
    status: t.status
  };
}

function ChannelBadge({ channel }: { channel: CommChannel }) {
  return (
    <Badge tone={channel === "whatsapp" ? "good" : "violet"}>
      {channel === "whatsapp" ? <MessageSquare className="size-3" /> : <Phone className="size-3" />}
      {CHANNEL_LABELS[channel]}
    </Badge>
  );
}

export function TemplatesManager({
  templates,
  stats
}: {
  templates: CommTemplate[];
  stats: Record<string, TemplateMessageStats>;
}) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [creating, setCreating] = useState(templates.length === 0);
  const [draft, setDraft] = useState<Draft>(
    templates[0] ? toDraft(templates[0]) : NEW_DRAFT
  );
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectTemplate = useCallback((t: CommTemplate) => {
    setCreating(false);
    setSelectedId(t.id);
    setDraft(toDraft(t));
  }, []);

  const startNew = useCallback(() => {
    setCreating(true);
    setSelectedId(null);
    setDraft(NEW_DRAFT);
  }, []);

  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => ({ ...d, body: d.body + token }));
      return;
    }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? draft.body.length;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((d) => ({ ...d, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined;
  const selectedStats = selectedId ? stats[selectedId] : undefined;

  function save() {
    startTransition(async () => {
      const result = await saveTemplateAction({
        id: draft.id,
        name: draft.name,
        channel: draft.channel,
        kind: draft.kind,
        body: draft.kind === "text" ? draft.body : undefined,
        formId: draft.kind === "form" ? draft.formId : undefined,
        status: draft.status
      });
      if (result.ok) {
        toast(result.message ?? "Template saved.", "success");
        if (result.data) {
          setCreating(false);
          setSelectedId(result.data.id);
          setDraft(toDraft(result.data));
        }
      } else {
        toast(result.error ?? "Could not save the template.", "error");
      }
    });
  }

  function archive() {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await archiveTemplateAction(draft.id!);
      if (result.ok) {
        toast(result.message ?? "Template archived.", "success");
        setDraft((d) => ({ ...d, status: "archived" }));
      } else {
        toast(result.error ?? "Could not archive the template.", "error");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:h-[calc(100vh-12rem)]">
      {/* LEFT — list */}
      <Panel padded={false} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Templates</h2>
          <Button size="sm" variant="secondary" onClick={startNew}>
            <Plus className="size-3.5" /> New template
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {templates.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" />}
              title="No templates yet"
              description="Create your first message or call-script template."
            />
          ) : (
            <ul className="space-y-1">
              {templates.map((t) => {
                const active = !creating && t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectTemplate(t)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-brand-300 bg-brand-50"
                          : "border-transparent hover:border-line hover:bg-fill"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                        {t.status === "archived" ? (
                          <Badge tone="neutral">Archived</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <ChannelBadge channel={t.channel} />
                        <Badge tone="outline">{KIND_LABELS[t.kind]}</Badge>
                        <span className="text-[11px] text-ink-muted">
                          {t.usageCount === 0
                            ? "Unused"
                            : `in ${t.usageCount} workflow${t.usageCount === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      {/* RIGHT — editor */}
      <Panel padded={false} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {creating ? "New template" : draft.name || "Template"}
          </h2>
          {!creating && draft.status !== "archived" ? (
            <Button size="sm" variant="outline" onClick={archive} disabled={pending}>
              Archive
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <Field label="Name" htmlFor="tpl-name">
            <Input
              id="tpl-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Appointment confirmation"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel" htmlFor="tpl-channel">
              <select
                id="tpl-channel"
                value={draft.channel}
                onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as CommChannel }))}
                className={selectCls}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="call_script">Call script</option>
              </select>
            </Field>
            <Field label="Kind" htmlFor="tpl-kind">
              <select
                id="tpl-kind"
                value={draft.kind}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as CommKind }))}
                className={selectCls}
              >
                <option value="text">Text</option>
                <option value="form">Form</option>
              </select>
            </Field>
          </div>

          {draft.kind === "text" ? (
            <Field label="Message body" htmlFor="tpl-body" hint="Insert tokens to personalise the message.">
              <textarea
                id="tpl-body"
                ref={textareaRef}
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="Hi {{patientName}}, your appointment with {{doctorName}} is on {{date}} at {{time}}…"
                className={textareaCls}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_TOKENS.map((token) => (
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
            </Field>
          ) : (
            <Field
              label="Form ID"
              htmlFor="tpl-form"
              hint="The form this template collects (form picker — enter the form id)."
            >
              <Input
                id="tpl-form"
                value={draft.formId}
                onChange={(e) => setDraft((d) => ({ ...d, formId: e.target.value }))}
                placeholder="form_…"
              />
            </Field>
          )}

          {/* Stats */}
          {!creating && selected ? (
            <div className="rounded-lg border border-line bg-fill/40 p-3">
              <p className="text-xs font-semibold text-ink">Usage &amp; delivery</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                <span>
                  Used in{" "}
                  <span className="font-semibold text-ink">{selected.usageCount}</span>{" "}
                  workflow{selected.usageCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-[var(--color-good)]" />
                  <span className="font-semibold text-ink">{selectedStats?.sent ?? 0}</span> sent
                </span>
                <span className="inline-flex items-center gap-1">
                  <XCircle className="size-3.5 text-[var(--color-critical)]" />
                  <span className="font-semibold text-ink">{selectedStats?.failed ?? 0}</span> failed
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : creating ? "Create template" : "Save"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
