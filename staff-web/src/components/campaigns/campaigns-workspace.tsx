"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Megaphone,
  MessageCircle,
  BarChart3,
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Send,
  Sparkles,
  UserCheck,
  Users,
  X,
  Zap
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field, FormError } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_INCLUDE_OPTIONS,
  AUDIENCE_PATIENT_STAGES,
  AUTOMATED_ON_OPTIONS,
  CHANNEL_OPTIONS,
  CHANNEL_LABELS,
  CHANNEL_TONE,
  PROVIDER_OPTIONS,
  PROVIDER_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  TRIGGER_LABELS,
  TRIGGER_OPTIONS,
  automatedOnLabel,
  campaignProvider,
  formatCampaignDate,
  formatCampaignDateTime,
  type AudienceInclude,
  type AudiencePreview,
  type Campaign,
  type CampaignAudience,
  type CampaignChannel,
  type CampaignDetail,
  type CampaignInput,
  type CampaignProvider,
  type CampaignRecipientsPreview,
  type CampaignTrigger,
  type LabelCount,
  type RecipientPreviewRow,
  type ConditionCatalogEntry
} from "@/lib/campaigns-types";
import {
  createCampaignAction,
  getCampaignDetailAction,
  previewAudienceAction,
  previewCampaignRecipientsAction,
  sendCampaignAction,
  updateCampaignAction
} from "@/app/(app)/campaigns/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

/** Reusable text templates from the Templates library, usable as a campaign body. */
export type CampaignTemplateOption = { id: string; name: string; body: string };

type FilterOption = { value: string; label: string };

type Props = {
  campaigns: Campaign[];
  conditions: ConditionCatalogEntry[];
  templates: CampaignTemplateOption[];
  leadSources: FilterOption[];
  leadStages: FilterOption[];
};

export function CampaignsWorkspace({
  campaigns,
  conditions,
  templates,
  leadSources,
  leadStages
}: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  function openNew() {
    setEditing(null);
    setComposerOpen(true);
  }
  function openEdit(campaign: Campaign) {
    setDetailCampaign(null);
    setEditing(campaign);
    setComposerOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Megaphone className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Campaigns</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              WhatsApp broadcasts to lead and patient segments — transactional or marketing.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-3.5" /> New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="No campaigns yet"
            description="Build an audience segment and send a WhatsApp broadcast to leads or patients."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onOpenDetail={() => setDetailCampaign(campaign)}
              onEdit={() => openEdit(campaign)}
            />
          ))}
        </div>
      )}

      <CampaignComposer
        open={composerOpen}
        editing={editing}
        onClose={() => {
          setComposerOpen(false);
          setEditing(null);
        }}
        conditions={conditions}
        templates={templates}
        leadSources={leadSources}
        leadStages={leadStages}
      />

      <CampaignDetailDrawer
        campaign={detailCampaign}
        onClose={() => setDetailCampaign(null)}
        onEdit={openEdit}
      />
    </div>
  );
}

// ============================================================================
// Campaign card
// ============================================================================

function CampaignCard({
  campaign,
  onOpenDetail,
  onEdit
}: {
  campaign: Campaign;
  onOpenDetail: () => void;
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const [sending, startSending] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<CampaignRecipientsPreview | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const stats = campaign.stats;

  function loadPreview() {
    startPreview(async () => {
      const result = await previewCampaignRecipientsAction(campaign.id);
      if (!result.ok) {
        toast(result.error ?? "Could not load recipients.", "error");
        return;
      }
      setPreview(result.data ?? null);
    });
  }

  function togglePreview() {
    const next = !previewOpen;
    setPreviewOpen(next);
    if (next && !preview) loadPreview();
  }

  function send() {
    startSending(async () => {
      const result = await sendCampaignAction(campaign.id);
      if (!result.ok) {
        toast(result.error ?? "Could not send the campaign.", "error");
        return;
      }
      toast(result.message ?? "Campaign sent.", "success");
      // Refresh the recipient panel if it's open, so the ledger reflects the send.
      if (previewOpen) loadPreview();
    });
  }

  return (
    <Panel padded={false}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenDetail}
              className="truncate text-left text-sm font-semibold text-ink transition hover:text-brand-700 hover:underline"
              title="View campaign details"
            >
              {campaign.name}
            </button>
            <Badge tone={STATUS_TONE[campaign.status]} dot>
              {STATUS_LABELS[campaign.status]}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={CHANNEL_TONE[campaign.channelType]}>
              {CHANNEL_LABELS[campaign.channelType]}
            </Badge>
            <Badge tone="neutral">via {PROVIDER_LABELS[campaignProvider(campaign)]}</Badge>
            <Badge tone="neutral">
              {campaign.trigger === "automated" ? (
                <Zap className="size-3" />
              ) : (
                <Send className="size-3" />
              )}
              {TRIGGER_LABELS[campaign.trigger]}
            </Badge>
            {campaign.trigger === "automated" && campaign.automatedOn ? (
              <span className="text-[11px] text-ink-muted">{automatedOnLabel(campaign.automatedOn)}</span>
            ) : null}
            {campaign.schedule?.enabled ? (
              <Badge tone="brand">
                <Repeat className="size-3" /> Every {campaign.schedule.everyDays}d
              </Badge>
            ) : null}
            {campaign.sendOncePerContact ? (
              <Badge tone="neutral">
                <UserCheck className="size-3" /> Once per contact
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onEdit} title="Edit campaign">
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button size="sm" variant="primary" onClick={send} disabled={sending}>
            <Send className="size-3.5" /> {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" /> {audienceSummary(campaign.audience)}
        </span>
        {campaignProvider(campaign) === "aisensy" && campaign.aisensyCampaign ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3" /> {campaign.aisensyCampaign}
          </span>
        ) : null}
        <span>· created {formatCampaignDate(campaign.createdAt)}</span>
      </div>

      {campaignProvider(campaign) === "ultramsg" && campaign.body ? (
        <p className="mx-4 mb-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-soft">
          {campaign.body}
        </p>
      ) : null}

      <div className="border-t border-line">
        <button
          type="button"
          onClick={togglePreview}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-ink-soft transition hover:bg-surface-muted"
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-brand-600" /> Who will this go to?
          </span>
          <ChevronDown className={cn("size-4 text-ink-faint transition", previewOpen && "rotate-180")} />
        </button>
        {previewOpen ? (
          <div className="px-4 pb-3">
            {loadingPreview && !preview ? (
              <p className="py-2 text-[11px] text-ink-muted">Resolving the live segment…</p>
            ) : preview ? (
              <RecipientPreview preview={preview} loading={loadingPreview} onRefresh={loadPreview} />
            ) : (
              <p className="py-2 text-[11px] text-ink-muted">Couldn&apos;t load recipients.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-4 py-3">
        {stats ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatCell label="Audience" value={stats.audienceSize ?? "—"} />
            <StatCell label="Sent" value={stats.sent} tone="good" />
            <StatCell label="Failed" value={stats.failed} tone={stats.failed ? "critical" : undefined} />
          </div>
        ) : (
          <p className="text-center text-[11px] text-ink-muted">Not sent yet.</p>
        )}
        {stats?.skipped ? (
          <p className="mt-2 text-center text-[10px] text-ink-faint">
            {stats.skipped} already contacted · skipped
          </p>
        ) : null}
        {stats?.lastRunAt ? (
          <p className="mt-1 text-center text-[10px] text-ink-faint">
            Last run {formatCampaignDateTime(stats.lastRunAt)}
          </p>
        ) : null}
        {campaign.schedule?.enabled ? (
          <p className="mt-1 text-center text-[10px] text-ink-faint">
            Next run {formatCampaignDateTime(campaign.schedule.nextRunAt)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

/** A short "which bucket" line for a recipient: Lead · Stage · Source, or Patient · Stage. */
function recipientBucket(r: RecipientPreviewRow): string {
  const kind = r.kind === "patient" ? "Patient" : "Lead";
  const parts = [kind, r.stage, r.kind === "lead" ? r.source : undefined].filter(Boolean);
  return parts.join(" · ");
}

/** Lightly mask a phone for the recipient list (staff tool — still recognisable). */
function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length <= 6) return p;
  return `${p.slice(0, 4)}••••${p.slice(-2)}`;
}

/**
 * The "who will this go to?" panel: a live, ledger-aware read of the segment —
 * how many will actually receive the next send vs are already contacted, plus a
 * sample of names so a send is never blind.
 */
function RecipientPreview({
  preview,
  loading,
  onRefresh
}: {
  preview: CampaignRecipientsPreview;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { audienceSize, eligible, alreadyContacted, sendOncePerContact, sample } = preview;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-ink-soft">
          {audienceSize === 0 ? (
            "No one matches this segment yet — add or re-tag leads and refresh."
          ) : sendOncePerContact ? (
            <>
              <span className="font-semibold text-ink">{eligible}</span> will receive on the next send
              {alreadyContacted > 0 ? <> · {alreadyContacted} already contacted</> : null}
              <span className="text-ink-faint"> · {audienceSize} in segment</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">{audienceSize}</span> will receive — everyone in the
              segment (each send)
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-muted transition hover:bg-surface-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>
      {sample.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {sample.map((r, i) => (
            <li key={`${r.phone}-${i}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-xs text-ink">{r.name || "Unnamed"}</span>
                <span className="block truncate text-[10px] text-ink-faint">{recipientBucket(r)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] text-ink-faint">{maskPhone(r.phone)}</span>
                {r.alreadyContacted ? (
                  <Badge tone="neutral">contacted</Badge>
                ) : sendOncePerContact ? (
                  <Badge tone="good">new</Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {audienceSize > sample.length ? (
        <p className="text-[10px] text-ink-faint">
          Showing {sample.length} of {audienceSize}.
        </p>
      ) : null}
      <p className="text-[10px] text-ink-faint">
        Re-resolved live · as of {formatCampaignDateTime(preview.generatedAt)}
      </p>
    </div>
  );
}

/**
 * Right-side drawer: full campaign detail + effectiveness. Fetches the detail
 * bundle + live recipient preview on open; offers Edit and Send now.
 */
function CampaignDetailDrawer({
  campaign,
  onClose,
  onEdit
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onEdit: (c: Campaign) => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipientsPreview | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSending] = useTransition();

  const reload = (id: string) =>
    startLoad(async () => {
      const [d, r] = await Promise.all([
        getCampaignDetailAction(id),
        previewCampaignRecipientsAction(id)
      ]);
      if (d.ok) setDetail(d.data ?? null);
      if (r.ok) setRecipients(r.data ?? null);
    });

  useEffect(() => {
    if (!campaign) {
      setDetail(null);
      setRecipients(null);
      return;
    }
    reload(campaign.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  function send() {
    if (!campaign) return;
    startSending(async () => {
      const result = await sendCampaignAction(campaign.id);
      if (!result.ok) {
        toast(result.error ?? "Could not send the campaign.", "error");
        return;
      }
      toast(result.message ?? "Campaign sent.", "success");
      reload(campaign.id);
    });
  }

  if (!campaign) return null;
  const c = detail?.campaign ?? campaign;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Campaign detail"
        className="animate-in relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-tight text-ink">{c.name}</h2>
              <Badge tone={STATUS_TONE[c.status]} dot>
                {STATUS_LABELS[c.status]}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={CHANNEL_TONE[c.channelType]}>{CHANNEL_LABELS[c.channelType]}</Badge>
              <Badge tone="neutral">via {PROVIDER_LABELS[campaignProvider(c)]}</Badge>
              <Badge tone="neutral">
                {c.trigger === "automated" ? <Zap className="size-3" /> : <Send className="size-3" />}
                {TRIGGER_LABELS[c.trigger]}
                {c.trigger === "automated" && c.automatedOn ? ` · ${automatedOnLabel(c.automatedOn)}` : ""}
              </Badge>
              {c.schedule?.enabled ? (
                <Badge tone="brand">
                  <Repeat className="size-3" /> Every {c.schedule.everyDays}d
                </Badge>
              ) : null}
              {c.sendOncePerContact ? (
                <Badge tone="neutral">
                  <UserCheck className="size-3" /> Once per contact
                </Badge>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading && !detail ? (
            <p className="text-xs text-ink-muted">Loading campaign…</p>
          ) : detail ? (
            <>
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <BarChart3 className="size-3.5 text-brand-600" /> Effectiveness
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <MetricCell
                    label="Delivered"
                    value={detail.delivery.deliveryRate == null ? "—" : `${Math.round(detail.delivery.deliveryRate * 100)}%`}
                    hint={`${detail.delivery.sent} sent · ${detail.delivery.failed} failed`}
                  />
                  <MetricCell
                    label="Reached"
                    value={detail.reach.contacted}
                    hint={detail.reach.sendOncePerContact ? "unique contacts" : "last run"}
                  />
                  <MetricCell
                    label="Converted"
                    value={detail.conversion.rate == null ? "—" : `${Math.round(detail.conversion.rate * 100)}%`}
                    hint={`${detail.conversion.converted} of ${detail.conversion.leads} leads`}
                  />
                </div>
                {detail.delivery.skipped ? (
                  <p className="mt-1.5 text-[10px] text-ink-faint">
                    {detail.delivery.skipped} skipped last run (already contacted).
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-ink-faint">
                  {detail.delivery.lastRunAt
                    ? `Last run ${formatCampaignDateTime(detail.delivery.lastRunAt)}`
                    : "Not sent yet."}
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold text-ink">
                  Audience now — {detail.audience.size} {detail.audience.size === 1 ? "recipient" : "recipients"}
                </h3>
                <p className="text-[11px] text-ink-muted">
                  {detail.audience.leads} lead{detail.audience.leads !== 1 ? "s" : ""}
                  {detail.audience.patients ? ` · ${detail.audience.patients} patient${detail.audience.patients !== 1 ? "s" : ""}` : ""}
                </p>
                {detail.audience.byStage.length ? <BreakdownRow title="By stage" items={detail.audience.byStage} /> : null}
                {detail.audience.bySource.length ? <BreakdownRow title="By source" items={detail.audience.bySource} /> : null}
              </section>

              {campaignProvider(c) === "ultramsg" && c.body ? (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink">Message</h3>
                  <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-soft">{c.body}</p>
                </section>
              ) : campaignProvider(c) === "aisensy" && c.aisensyCampaign ? (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink">AISensy template</h3>
                  <p className="text-xs text-ink-soft">
                    {c.aisensyCampaign}
                    {c.templateParams?.length ? ` · params: ${c.templateParams.join(", ")}` : ""}
                  </p>
                </section>
              ) : null}

              {recipients ? (
                <section>
                  <h3 className="mb-2 text-xs font-semibold text-ink">Recipients</h3>
                  <RecipientPreview
                    preview={recipients}
                    loading={loading}
                    onRefresh={() => campaign && reload(campaign.id)}
                  />
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-ink-muted">Couldn&apos;t load campaign detail.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button variant="outline" onClick={() => onEdit(c)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button onClick={send} disabled={sending}>
            <Send className="size-3.5" /> {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-center">
      <p className="text-base font-semibold text-ink">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] leading-tight text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function BreakdownRow({ title, items }: { title: string; items: LabelCount[] }) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it.label}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] text-ink-soft"
          >
            {it.label} <span className="font-semibold text-ink">{it.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone?: "good" | "critical";
}) {
  return (
    <div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums text-ink",
          tone === "good" && "text-[var(--color-good)]",
          tone === "critical" && "text-[var(--color-critical)]"
        )}
      >
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      <p className="text-[10px] text-ink-muted">{label}</p>
    </div>
  );
}

function audienceSummary(a: CampaignAudience): string {
  const parts: string[] = [];
  const incl = AUDIENCE_INCLUDE_OPTIONS.find((o) => o.value === a.include)?.label ?? a.include;
  parts.push(incl);
  const counts: string[] = [];
  if (a.leadStages?.length) counts.push(`${a.leadStages.length} lead stage${a.leadStages.length > 1 ? "s" : ""}`);
  if (a.patientStages?.length) counts.push(`${a.patientStages.length} patient stage${a.patientStages.length > 1 ? "s" : ""}`);
  if (a.conditionCodes?.length) counts.push(`${a.conditionCodes.length} condition${a.conditionCodes.length > 1 ? "s" : ""}`);
  if (a.tags?.length) counts.push(`${a.tags.length} tag${a.tags.length > 1 ? "s" : ""}`);
  return counts.length ? `${parts[0]} · ${counts.join(", ")}` : parts[0];
}

// ============================================================================
// New campaign composer
// ============================================================================

function CampaignComposer({
  open,
  onClose,
  conditions,
  templates,
  leadSources,
  leadStages,
  editing
}: {
  open: boolean;
  onClose: () => void;
  conditions: ConditionCatalogEntry[];
  templates: CampaignTemplateOption[];
  leadSources: FilterOption[];
  leadStages: FilterOption[];
  /** When set, the composer edits this campaign (PATCH) instead of creating one. */
  editing?: Campaign | null;
}) {
  const { toast } = useToast();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<CampaignChannel>("transactional");
  const [provider, setProvider] = useState<CampaignProvider>("ultramsg");
  const [trigger, setTrigger] = useState<CampaignTrigger>("manual");
  const [automatedOn, setAutomatedOn] = useState(AUTOMATED_ON_OPTIONS[0].value);

  // delivery rules
  const [sendOnce, setSendOnce] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [everyDays, setEveryDays] = useState(7);

  // transactional
  const [body, setBody] = useState("");
  // marketing
  const [aisensyCampaign, setAisensyCampaign] = useState("");
  const [templateParams, setTemplateParams] = useState("");

  // audience
  const [audience, setAudience] = useState<CampaignAudience>({ include: "leads" });

  function reset() {
    setName("");
    setChannelType("transactional");
    setProvider("ultramsg");
    setTrigger("manual");
    setAutomatedOn(AUTOMATED_ON_OPTIONS[0].value);
    setSendOnce(false);
    setRepeat(false);
    setEveryDays(7);
    setBody("");
    setAisensyCampaign("");
    setTemplateParams("");
    setAudience({ include: "leads" });
    setError(null);
  }

  // When opened for editing, prefill every field from the campaign; when opened
  // for a new campaign, start from a clean slate.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setChannelType(editing.channelType);
      setProvider(campaignProvider(editing));
      setTrigger(editing.trigger);
      setAutomatedOn(editing.automatedOn ?? AUTOMATED_ON_OPTIONS[0].value);
      setSendOnce(Boolean(editing.sendOncePerContact));
      setRepeat(Boolean(editing.schedule?.enabled));
      setEveryDays(editing.schedule?.everyDays ?? 7);
      setBody(editing.body ?? "");
      setAisensyCampaign(editing.aisensyCampaign ?? "");
      setTemplateParams((editing.templateParams ?? []).join(", "));
      setAudience(editing.audience);
      setError(null);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function submit() {
    if (!name.trim()) return setError("Enter a campaign name.");
    if (provider === "ultramsg" && !body.trim())
      return setError("Enter the WhatsApp message body.");
    if (provider === "aisensy" && !aisensyCampaign.trim())
      return setError("Enter the AISensy template/campaign name.");
    setError(null);

    const params = templateParams
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const days = Math.max(1, Math.floor(everyDays) || 1);
    const input: CampaignInput = {
      name,
      channelType,
      provider,
      trigger,
      automatedOn: trigger === "automated" ? automatedOn : undefined,
      audience,
      body: provider === "ultramsg" ? body : undefined,
      aisensyCampaign: provider === "aisensy" ? aisensyCampaign : undefined,
      templateParams: provider === "aisensy" && params.length ? params : undefined,
      sendOncePerContact: sendOnce,
      schedule: repeat
        ? {
            everyDays: days,
            enabled: true,
            // First automated run after one interval; operator can Send now for an
            // immediate first send.
            nextRunAt: new Date(Date.now() + days * 86_400_000).toISOString()
          }
        : editing
          ? // Editing with repeat off — explicitly disable any existing schedule.
            { everyDays: days, enabled: false, nextRunAt: new Date(Date.now() + days * 86_400_000).toISOString() }
          : undefined
    };

    startSaving(async () => {
      const result = editing
        ? await updateCampaignAction(editing.id, input)
        : await createCampaignAction(input);
      if (!result.ok) {
        setError(result.error ?? `Could not ${editing ? "update" : "create"} the campaign.`);
        return;
      }
      reset();
      onClose();
      toast(result.message ?? "Campaign saved.", "success");
    });
  }

  const channelHint = PROVIDER_OPTIONS.find((p) => p.value === provider)?.hint;

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-campaign-title" className="max-w-2xl">
      <div className="border-b border-line p-5">
        <h2
          id="new-campaign-title"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink"
        >
          <Megaphone className="size-4 text-brand-600" /> {editing ? "Edit campaign" : "New campaign"}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Sends use the hospital&apos;s configured WhatsApp channels (Admin → Integrations).
        </p>
      </div>

      <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
        <Field label="Campaign name" htmlFor="nc-name">
          <Input
            id="nc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cataract review — back into care"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Type" htmlFor="nc-channel">
            <select
              id="nc-channel"
              value={channelType}
              onChange={(e) => setChannelType(e.target.value as CampaignChannel)}
              className={selectClass}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Send via" htmlFor="nc-provider">
            <select
              id="nc-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as CampaignProvider)}
              className={selectClass}
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trigger" htmlFor="nc-trigger">
            <select
              id="nc-trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as CampaignTrigger)}
              className={selectClass}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {channelHint ? <p className="-mt-2 text-[11px] text-ink-muted">{channelHint}</p> : null}

        {trigger === "automated" ? (
          <Field label="Run automatically" htmlFor="nc-auto">
            <select
              id="nc-auto"
              value={automatedOn}
              onChange={(e) => setAutomatedOn(e.target.value)}
              className={selectClass}
            >
              {AUTOMATED_ON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-muted">
              A matching lead is messaged automatically the moment it&apos;s added (from any source —
              form, import, Google Sheet or manual).
            </p>
          </Field>
        ) : null}

        <div className="space-y-3 rounded-lg border border-line bg-canvas p-3">
          <p className="text-xs font-medium text-ink-soft">Delivery rules</p>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={sendOnce}
              onChange={(e) => setSendOnce(e.target.checked)}
              className="mt-0.5 size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
            />
            <span className="text-xs text-ink">
              Contact each recipient only once
              <span className="mt-0.5 block text-[11px] text-ink-muted">
                Remembers who&apos;s already been messaged, so re-sends and repeats only reach{" "}
                <em>new</em> matching leads — never spams the same people again.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="mt-0.5 size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
            />
            <span className="text-xs text-ink">
              Repeat automatically
              <span className="mt-0.5 block text-[11px] text-ink-muted">
                Re-runs on a schedule, picking up leads added since the last run.
              </span>
            </span>
          </label>
          {repeat ? (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-ink-muted">Every</span>
              <Input
                type="number"
                min={1}
                value={everyDays}
                onChange={(e) => setEveryDays(Number(e.target.value))}
                className="h-8 w-20"
              />
              <span className="text-xs text-ink-muted">days</span>
            </div>
          ) : null}
        </div>

        {provider === "ultramsg" ? (
          <>
            {templates.length > 0 ? (
              <Field label="Start from a template (optional)" htmlFor="nc-template">
                <select
                  id="nc-template"
                  value=""
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) setBody(tpl.body);
                  }}
                  className={selectClass}
                >
                  <option value="">Choose a saved template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field
              label="Message body"
              htmlFor="nc-body"
              hint={
                <>
                  Free-text WhatsApp via UltraMsg. Use <code className="font-mono">{"{{name}}"}</code> to
                  merge the recipient&apos;s name.
                </>
              }
            >
            <textarea
              id="nc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Namaste {{name}}, your follow-up is due. Reply to book a slot."
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            />
            </Field>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="AISensy campaign" htmlFor="nc-aisensy">
              <Input
                id="nc-aisensy"
                value={aisensyCampaign}
                onChange={(e) => setAisensyCampaign(e.target.value)}
                placeholder="e.g. eye_camp_invite"
              />
            </Field>
            <Field
              label="Template params (optional)"
              htmlFor="nc-params"
              hint="Comma-separated values for the template's placeholders."
            >
              <Input
                id="nc-params"
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="Indiranagar, 12 Jul"
              />
            </Field>
          </div>
        )}

        <AudienceBuilder
          value={audience}
          onChange={setAudience}
          conditions={conditions}
          leadSources={leadSources}
          leadStages={leadStages}
        />

        <FormError message={error} />
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          <Plus className="size-3.5" /> {saving ? "Saving…" : editing ? "Save changes" : "Save draft"}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Audience segment builder + live preview
// ============================================================================

function AudienceBuilder({
  value,
  onChange,
  conditions,
  leadSources,
  leadStages
}: {
  value: CampaignAudience;
  onChange: (next: CampaignAudience) => void;
  conditions: ConditionCatalogEntry[];
  leadSources: FilterOption[];
  leadStages: FilterOption[];
}) {
  const showLeads = value.include === "leads" || value.include === "both";
  const showPatients = value.include === "patients" || value.include === "both";

  const [tagInput, setTagInput] = useState("");

  function toggle(key: "leadStages" | "leadSources" | "patientStages" | "conditionCodes", v: string) {
    const cur = value[key] ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [key]: next });
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const cur = value.tags ?? [];
    if (!cur.includes(t)) onChange({ ...value, tags: [...cur, t] });
    setTagInput("");
  }

  function removeTag(t: string) {
    onChange({ ...value, tags: (value.tags ?? []).filter((x) => x !== t) });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
      <SectionTitle
        icon={<Users className="size-4" />}
        title="Audience segment"
        subtitle="Who should receive this campaign"
      />

      <div className="mt-4 space-y-4">
        <Field label="Include" htmlFor="aud-include">
          <Segmented
            value={value.include}
            onChange={(v) => onChange({ ...value, include: v as AudienceInclude })}
            options={AUDIENCE_INCLUDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>

        {showLeads ? (
          <>
            <ChipGroup
              label="Lead stages"
              options={leadStages}
              selected={value.leadStages ?? []}
              onToggle={(v) => toggle("leadStages", v)}
            />
            <ChipGroup
              label="Lead sources"
              options={leadSources}
              selected={value.leadSources ?? []}
              onToggle={(v) => toggle("leadSources", v)}
            />
          </>
        ) : null}

        {showPatients ? (
          <>
            <ChipGroup
              label="Patient lifecycle stages"
              options={AUDIENCE_PATIENT_STAGES}
              selected={value.patientStages ?? []}
              onToggle={(v) => toggle("patientStages", v)}
            />
            <ConditionFilter
              conditions={conditions}
              selected={value.conditionCodes ?? []}
              onToggle={(v) => toggle("conditionCodes", v)}
            />
          </>
        ) : null}

        <Field label="Tags (optional)" htmlFor="aud-tags">
          <div className="flex gap-2">
            <Input
              id="aud-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Type a tag and press Enter"
            />
            <Button variant="outline" size="md" onClick={addTag}>
              Add
            </Button>
          </div>
          {value.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {value.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => removeTag(t)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-black/5 hover:bg-brand-100"
                >
                  {t}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          ) : null}
        </Field>

        <AudiencePreviewPanel audience={value} />
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition",
                active
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-surface text-ink-soft ring-line-strong hover:bg-surface-muted hover:text-ink"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConditionFilter({
  conditions,
  selected,
  onToggle
}: {
  conditions: ConditionCatalogEntry[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return conditions
      .filter(
        (c) =>
          !selected.includes(c.icd10Code) &&
          (c.label.toLowerCase().includes(q) || c.icd10Code.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [conditions, query, selected]);

  const byCode = useMemo(
    () => new Map(conditions.map((c) => [c.icd10Code, c.label])),
    [conditions]
  );

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">Conditions (ICD-10)</span>
      {conditions.length === 0 ? (
        <p className="text-[11px] text-ink-muted">Condition catalog unavailable.</p>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a diagnosis or ICD-10 code…"
          />
          {matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface py-1 shadow-lg">
              {matches.map((c) => (
                <li key={c.icd10Code}>
                  <button
                    type="button"
                    onClick={() => {
                      onToggle(c.icd10Code);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-surface-muted"
                  >
                    <span className="truncate">{c.label}</span>
                    <code className="shrink-0 font-mono text-[10px] text-ink-muted">{c.icd10Code}</code>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onToggle(code)}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-black/5 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300"
            >
              {byCode.get(code) ?? code}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AudiencePreviewPanel({ audience }: { audience: CampaignAudience }) {
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startPreview] = useTransition();
  // Invalidate a stale preview whenever the segment changes.
  const audienceKey = useMemo(() => JSON.stringify(audience), [audience]);
  const lastPreviewKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastPreviewKey.current !== null && lastPreviewKey.current !== audienceKey) {
      setPreview(null);
      setError(null);
    }
  }, [audienceKey]);

  function run() {
    setError(null);
    startPreview(async () => {
      const result = await previewAudienceAction(audience);
      lastPreviewKey.current = audienceKey;
      if (!result.ok || !result.data) {
        setPreview(null);
        setError(result.error ?? "Could not preview the audience.");
        return;
      }
      setPreview(result.data);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">Preview audience</span>
        <Button variant="outline" size="sm" onClick={run} disabled={pending}>
          <Users className="size-3.5" /> {pending ? "Counting…" : "Preview audience"}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-critical)]">
          <AlertTriangle className="size-3.5" /> {error}
        </p>
      ) : preview ? (
        <div className="mt-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <CheckCircle2 className="size-4 text-[var(--color-good)]" />
            {preview.size.toLocaleString("en-IN")} recipient{preview.size === 1 ? "" : "s"}
          </p>
          {preview.sample.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {preview.sample.slice(0, 5).map((s, i) => (
                <li
                  key={`${s.phone}-${i}`}
                  className="flex items-center justify-between gap-2 text-xs text-ink-soft"
                >
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <MessageCircle className="size-3 text-ink-faint" />
                    {s.name}
                    <Badge tone={s.kind === "patient" ? "good" : "brand"}>{s.kind}</Badge>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-muted">{s.phone}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">No matching recipients.</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-muted">
          Run a preview to see how many leads/patients match this segment.
        </p>
      )}
    </div>
  );
}
