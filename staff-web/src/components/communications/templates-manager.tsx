"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Cloud, FileText, MessageSquare, Phone, Plus, RefreshCw, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FormError, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import {
  saveTemplateAction,
  archiveTemplateAction,
  submitTemplateToMetaAction,
  syncMetaTemplatesAction,
  importMetaTemplateAction
} from "@/app/(app)/communications/actions";
import {
  CHANNEL_LABELS,
  KIND_LABELS,
  TEMPLATE_TOKENS,
  type CommTemplate,
  type CommTemplateMeta,
  type CommChannel,
  type CommKind,
  type TemplateMessageStats
} from "@/lib/comms-types";
import {
  WA_LANGUAGE_OPTIONS,
  WA_TEMPLATE_CATEGORY_OPTIONS,
  waStatusTone,
  type WaTemplate,
  type WaTemplateCategory
} from "@/lib/whatsapp-cloud-types";

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

/** Meta review chip for whatsapp/text templates that have been promoted. */
function MetaChip({ meta }: { meta?: CommTemplateMeta }) {
  if (!meta) return null;
  const s = meta.status.toUpperCase();
  if (s === "APPROVED") return <Badge tone="good">Meta ✓ approved</Badge>;
  if (s === "PENDING") return <Badge tone="high">Meta · pending</Badge>;
  if (s === "REJECTED") return <Badge tone="critical">Meta · rejected</Badge>;
  return <Badge tone="neutral">Meta · {meta.status.toLowerCase()}</Badge>;
}

/** True when every positional param maps to a plain number ("1", "2"…). */
function hasNumericTokens(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((t) => /^\d+$/.test(t));
}

const CUSTOM_LANGUAGE = "__custom__";

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

  // Meta (WhatsApp Cloud) promotion state
  const [metaCategory, setMetaCategory] = useState<WaTemplateCategory>("MARKETING");
  const [metaLanguage, setMetaLanguage] = useState("en");
  const [metaCustomLanguage, setMetaCustomLanguage] = useState("");
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaPending, startMeta] = useTransition();
  const [syncing, startSync] = useTransition();
  /** Templates on the WABA but not in the library; null until first sync. */
  const [wabaOnly, setWabaOnly] = useState<WaTemplate[] | null>(null);

  const selectTemplate = useCallback((t: CommTemplate) => {
    setCreating(false);
    setSelectedId(t.id);
    setDraft(toDraft(t));
    setMetaError(null);
  }, []);

  const startNew = useCallback(() => {
    setCreating(true);
    setSelectedId(null);
    setDraft(NEW_DRAFT);
    setMetaError(null);
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

  /** Submit (or re-submit) the selected template for Meta review. */
  function submitToMeta(id: string, category: WaTemplateCategory, language: string) {
    const lang = language.trim();
    if (!lang) return setMetaError("Enter a language code (e.g. en, en_US, hi).");
    setMetaError(null);
    startMeta(async () => {
      const result = await submitTemplateToMetaAction(id, { category, language: lang });
      if (result.ok) {
        toast(result.message ?? "Submitted for Meta review.", "success");
      } else {
        setMetaError(result.error ?? "Could not submit the template to Meta.");
      }
    });
  }

  /** Refresh Meta statuses on library templates + list WABA-only templates. */
  function syncMeta() {
    startSync(async () => {
      const result = await syncMetaTemplatesAction();
      if (!result.ok) {
        toast(result.error ?? "Could not sync templates from Meta.", "error");
        return;
      }
      const only = result.data?.wabaOnly ?? [];
      setWabaOnly(only);
      toast(`Statuses refreshed · ${only.length} on Meta only`, "success");
    });
  }

  /** Pull a WABA-only Meta template into the library. */
  function importFromMeta(t: WaTemplate) {
    startMeta(async () => {
      const result = await importMetaTemplateAction({ name: t.name, language: t.language });
      if (!result.ok) {
        toast(result.error ?? "Could not import the template.", "error");
        return;
      }
      toast(result.message ?? `Imported "${t.name}" to the library.`, "success");
      setWabaOnly((prev) => (prev ?? []).filter((x) => !(x.name === t.name && x.language === t.language)));
      if (result.data) {
        setCreating(false);
        setSelectedId(result.data.id);
        setDraft(toDraft(result.data));
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:h-[calc(100vh-12rem)]">
      {/* LEFT — list */}
      <Panel padded={false} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Templates</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={syncMeta} disabled={syncing}>
              <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
              {syncing ? "Syncing…" : "Sync Meta"}
            </Button>
            <Button size="sm" variant="secondary" onClick={startNew}>
              <Plus className="size-3.5" /> New template
            </Button>
          </div>
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
                        {t.channel === "whatsapp" && t.kind === "text" ? <MetaChip meta={t.meta} /> : null}
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

        {/* WABA-only templates surfaced by "Sync Meta" */}
        {wabaOnly && wabaOnly.length > 0 ? (
          <div className="border-t border-line p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <Cloud className="size-3.5" /> On your WABA only
            </p>
            <ul className="mt-2 space-y-1.5">
              {wabaOnly.map((t) => (
                <li
                  key={`${t.name}-${t.language}`}
                  className="rounded-lg border border-line bg-fill/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-xs text-ink">{t.name}</span>
                    <Badge tone={waStatusTone(t.status)} dot>
                      {t.status}
                    </Badge>
                  </div>
                  {t.body ? (
                    <p className="mt-1 truncate text-[11px] text-ink-muted" title={t.body}>
                      {t.body}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-ink-muted">{t.language}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => importFromMeta(t)}
                      disabled={metaPending}
                    >
                      Import to library
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

          {/* WhatsApp Cloud (Meta) promotion */}
          {!creating && selected && selected.channel === "whatsapp" && selected.kind === "text" ? (
            <div className="space-y-3 rounded-lg border border-line bg-fill/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Cloud className="size-3.5" /> WhatsApp Cloud (Meta)
              </p>

              {selected.meta ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    <Badge tone={waStatusTone(selected.meta.status)} dot>
                      {selected.meta.status}
                    </Badge>
                    <span>
                      as <code className="font-mono text-ink">{selected.meta.name}</code>
                    </span>
                    <span>· {selected.meta.language}</span>
                    <span>· {selected.meta.category}</span>
                    <span>· synced {new Date(selected.meta.syncedAt).toLocaleString()}</span>
                  </div>
                  {selected.meta.rejectionReason ? (
                    <p className="text-[11px] font-medium text-[var(--color-critical)]">
                      {selected.meta.rejectionReason}
                    </p>
                  ) : null}
                  {selected.meta.paramTokens.length > 0 ? (
                    <p className="text-[11px] text-ink-muted">
                      {hasNumericTokens(selected.meta.paramTokens)
                        ? "Params need manual values in campaigns."
                        : `Params auto-fill from: ${selected.meta.paramTokens
                            .map((tok) => `{{${tok}}}`)
                            .join(", ")}`}
                    </p>
                  ) : null}
                  <FormError message={metaError} />
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        submitToMeta(selected.id, selected.meta!.category, selected.meta!.language)
                      }
                      disabled={metaPending}
                    >
                      {metaPending ? "Submitting…" : "Re-submit to Meta"}
                    </Button>
                    <span className="text-[11px] text-ink-muted">Body edits need Meta re-approval.</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-ink-muted">
                    Approve this template with Meta to send it outside the 24-hour window (campaigns).
                    Your <code className="font-mono">{"{{tokens}}"}</code> are converted to Meta&apos;s{" "}
                    <code className="font-mono">{"{{1}}"}</code> format automatically.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Category" htmlFor="meta-category">
                      <select
                        id="meta-category"
                        value={metaCategory}
                        onChange={(e) => setMetaCategory(e.target.value as WaTemplateCategory)}
                        className={selectCls}
                      >
                        {WA_TEMPLATE_CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Language" htmlFor="meta-language">
                      <select
                        id="meta-language"
                        value={metaLanguage}
                        onChange={(e) => setMetaLanguage(e.target.value)}
                        className={selectCls}
                      >
                        {WA_LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                        <option value={CUSTOM_LANGUAGE}>Other…</option>
                      </select>
                      {metaLanguage === CUSTOM_LANGUAGE ? (
                        <Input
                          className="mt-1.5"
                          value={metaCustomLanguage}
                          onChange={(e) => setMetaCustomLanguage(e.target.value)}
                          placeholder="Locale code, e.g. mr, ta, bn"
                          aria-label="Custom language code"
                        />
                      ) : null}
                    </Field>
                  </div>
                  {metaError ? (
                    <div className="space-y-1">
                      <FormError message={metaError} />
                      {/configur/i.test(metaError) ? (
                        <p className="text-[11px]">
                          <Link
                            href="/communications/channels"
                            className="font-medium text-brand-600 hover:underline"
                          >
                            Set up WhatsApp Cloud in Admin → Channels →
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() =>
                      submitToMeta(
                        selected.id,
                        metaCategory,
                        metaLanguage === CUSTOM_LANGUAGE ? metaCustomLanguage : metaLanguage
                      )
                    }
                    disabled={metaPending}
                  >
                    {metaPending ? "Submitting…" : "Submit to Meta"}
                  </Button>
                </>
              )}
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
