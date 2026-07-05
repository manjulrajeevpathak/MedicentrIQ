"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Cloud, Plus, RefreshCw, Settings2 } from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, FormError } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import {
  listWhatsappTemplatesAction,
  createWhatsappTemplateAction
} from "@/app/(app)/communications/actions";
import {
  WA_LANGUAGE_OPTIONS,
  WA_TEMPLATE_CATEGORY_OPTIONS,
  slugifyWaTemplateName,
  waStatusTone,
  type WaTemplate,
  type WaTemplateCategory
} from "@/lib/whatsapp-cloud-types";

const selectCls =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200";
const textareaCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200 min-h-[100px] resize-y";

const CUSTOM_LANGUAGE = "__custom__";

/**
 * "WhatsApp templates (Meta)" section on Communications → Templates: a live
 * sync of the tenant's per-WABA template catalog plus a form to submit a new
 * template for Meta review. Distinct from the free-text Templates library above
 * — these are the pre-approved messages required outside the 24-hour window.
 */
export function WaTemplatesPanel() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [syncing, startSync] = useTransition();

  // New-template form
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WaTemplateCategory>("UTILITY");
  const [language, setLanguage] = useState("en");
  const [customLanguage, setCustomLanguage] = useState("");
  const [body, setBody] = useState("");
  const [sampleParams, setSampleParams] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const hasPlaceholders = body.includes("{{");

  function sync() {
    startSync(async () => {
      const result = await listWhatsappTemplatesAction();
      if (!result.ok) {
        setTemplates(null);
        setNotConfigured(Boolean(result.notConfigured));
        setError(result.error ?? "Could not load the WhatsApp templates.");
        return;
      }
      setNotConfigured(false);
      setError(null);
      setTemplates(result.templates ?? []);
    });
  }

  // Initial load; the Sync button re-fetches from Meta on demand.
  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    const lang = language === CUSTOM_LANGUAGE ? customLanguage.trim() : language;
    if (!name.trim()) return setFormError("Enter a template name.");
    if (!lang) return setFormError("Enter a language code (e.g. en, en_US, hi).");
    if (!body.trim()) return setFormError("Enter the template body.");
    const params = sampleParams.split(",").map((p) => p.trim()).filter(Boolean);
    if (hasPlaceholders && params.length === 0) {
      return setFormError("Meta needs a sample value for each {{n}} placeholder.");
    }
    setFormError(null);

    startSubmit(async () => {
      const result = await createWhatsappTemplateAction({
        name: slugifyWaTemplateName(name),
        category,
        language: lang,
        body,
        sampleParams: params.length ? params : undefined
      });
      if (!result.ok) {
        setFormError(result.error ?? "Could not submit the template to Meta.");
        return;
      }
      toast(result.message ?? "Submitted for Meta review — status PENDING.", "success");
      setFormOpen(false);
      setName("");
      setBody("");
      setSampleParams("");
      sync();
    });
  }

  return (
    <Panel>
      <SectionTitle
        icon={<Cloud className="size-4" />}
        title="WhatsApp templates (Meta)"
        subtitle="Approved by Meta per-WABA — required for messages outside the 24-hour window."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
              <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
              {syncing ? "Syncing…" : "Sync from Meta"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFormOpen((v) => !v)}>
              <Plus className="size-3.5" /> New WhatsApp template
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-4">
        {notConfigured ? (
          <EmptyState
            icon={<Settings2 className="size-5" />}
            title="WhatsApp Cloud API isn't configured yet"
            description="Add your Meta Phone Number ID, WABA ID and access token first — then sync your approved templates here."
          />
        ) : error ? (
          <FormError message={error} />
        ) : null}
        {notConfigured ? (
          <p className="text-center text-xs">
            <Link href="/communications/channels" className="font-medium text-brand-600 hover:underline">
              Configure WhatsApp Business (Meta) in Integrations →
            </Link>
          </p>
        ) : null}

        {templates && templates.length === 0 ? (
          <EmptyState
            icon={<Cloud className="size-5" />}
            title="No templates on this WABA yet"
            description="Submit your first template below — Meta usually reviews within minutes to a few hours."
          />
        ) : null}

        {templates && templates.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-fill/40 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {templates.map((t) => (
                  <tr key={`${t.id}-${t.language}`} className="align-top">
                    <td className="px-3 py-2.5 font-mono text-xs text-ink">{t.name}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">{t.category}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">{t.language}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={waStatusTone(t.status)} dot>
                        {t.status}
                      </Badge>
                      {t.rejectionReason ? (
                        <p className="mt-1 max-w-[180px] text-[10px] leading-tight text-[var(--color-critical)]" title={t.rejectionReason}>
                          {t.rejectionReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5 text-xs text-ink-muted">
                      <span className="line-clamp-2" title={t.body}>
                        {t.body || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {formOpen ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface-muted/40 p-4">
            <p className="text-xs font-semibold text-ink">New WhatsApp template</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Name"
                htmlFor="wa-tpl-name"
                hint={name && slugifyWaTemplateName(name) !== name ? <>Will be submitted as <code className="font-mono">{slugifyWaTemplateName(name)}</code></> : "lowercase_with_underscores"}
              >
                <Input
                  id="wa-tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setName((n) => slugifyWaTemplateName(n))}
                  placeholder="appointment_reminder"
                />
              </Field>
              <Field label="Category" htmlFor="wa-tpl-category">
                <select
                  id="wa-tpl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as WaTemplateCategory)}
                  className={selectCls}
                >
                  {WA_TEMPLATE_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language" htmlFor="wa-tpl-language">
                <select
                  id="wa-tpl-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={selectCls}
                >
                  {WA_LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                  <option value={CUSTOM_LANGUAGE}>Other…</option>
                </select>
                {language === CUSTOM_LANGUAGE ? (
                  <Input
                    className="mt-1.5"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    placeholder="Locale code, e.g. mr, ta, bn"
                    aria-label="Custom language code"
                  />
                ) : null}
              </Field>
            </div>
            <Field
              label="Body"
              htmlFor="wa-tpl-body"
              hint={
                <>
                  Use <code className="font-mono">{"{{1}}"}</code>, <code className="font-mono">{"{{2}}"}</code>… as
                  placeholders — Meta requires sample values for each one.
                </>
              }
            >
              <textarea
                id="wa-tpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Hi {{1}}, your appointment at {{2}} is confirmed. Reply STOP to opt out."}
                className={textareaCls}
              />
            </Field>
            {hasPlaceholders ? (
              <Field
                label="Sample values"
                htmlFor="wa-tpl-samples"
                hint="Comma-separated — one example per {{n}} placeholder, in order."
              >
                <Input
                  id="wa-tpl-samples"
                  value={sampleParams}
                  onChange={(e) => setSampleParams(e.target.value)}
                  placeholder="Asha, Indiranagar clinic"
                />
              </Field>
            ) : null}
            <FormError message={formError} />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit for review"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
