"use client";

import { useState } from "react";
import {
  CheckCheck,
  CircleSlash,
  FileText,
  Gauge,
  Languages,
  MailCheck,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Reply,
  Send,
  ShieldCheck
} from "lucide-react";
import type { Campaign, CampaignsData, WaTemplate } from "@/lib/campaigns";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile, StatGrid } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { Donut } from "@/components/ui/charts";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";

type Tab = "campaigns" | "templates";

const statusTone: Record<Campaign["status"], "good" | "brand" | "high" | "neutral" | "low"> = {
  running: "good",
  scheduled: "brand",
  completed: "neutral",
  paused: "high",
  draft: "low"
};

export function CampaignsWorkspace({ data, canSend }: { data: CampaignsData; canSend: boolean }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(data.campaigns);
  const [composerOpen, setComposerOpen] = useState(false);

  const optTotal = data.optIn.optedIn + data.optIn.optedOut + data.optIn.pending;
  const optInRate = Math.round((data.optIn.optedIn / optTotal) * 100);

  const setStatus = (id: string, status: Campaign["status"]) =>
    setCampaigns((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));

  const createCampaign = (draft: Pick<Campaign, "name" | "template" | "audience" | "language" | "throttlePerMin">) => {
    setCampaigns((cs) => [
      {
        ...draft,
        id: `cmp-${Math.round(optTotal % 997) + cs.length + 400}`,
        status: "scheduled",
        schedule: "Today 6:00 PM",
        audienceSize: 80 + cs.length * 11,
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        optOut: 0
      },
      ...cs
    ]);
    toast(`Campaign “${draft.name}” scheduled.`, "success");
  };

  return (
    <div className="space-y-5">
      {/* KPIs + opt-in */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <StatGrid cols={4} className="content-start">
          <StatTile label="Opt-in rate" value={`${optInRate}%`} icon={<ShieldCheck className="size-4" />} tone="good" />
          <StatTile label="Delivery rate" value={`${data.delivery.deliveryRate}%`} icon={<CheckCheck className="size-4" />} tone="brand" />
          <StatTile label="Read rate" value={`${data.delivery.readRate}%`} icon={<MailCheck className="size-4" />} tone="brand" />
          <StatTile label="Reply rate" value={`${data.delivery.replyRate}%`} icon={<Reply className="size-4" />} tone="brand" />
          <StatTile label="Opted in" value={formatNumber(data.optIn.optedIn)} icon={<MessageCircle className="size-4" />} tone="good" />
          <StatTile label="Opted out" value={formatNumber(data.optIn.optedOut)} icon={<CircleSlash className="size-4" />} tone="risk" />
          <StatTile label="Templates live" value={String(data.templates.filter((t) => t.status === "approved").length)} icon={<FileText className="size-4" />} tone="neutral" />
          <StatTile label="Active campaigns" value={String(data.campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length)} icon={<Megaphone className="size-4" />} tone="brand" />
        </StatGrid>
        <Panel>
          <SectionTitle icon={<ShieldCheck className="size-4" />} title="Consent" subtitle="Opt-in governance" />
          <Donut
            className="mt-4"
            size={130}
            segments={[
              { label: "Opted in", value: data.optIn.optedIn, color: "var(--color-good)" },
              { label: "Pending", value: data.optIn.pending, color: "var(--color-high)" },
              { label: "Opted out", value: data.optIn.optedOut, color: "var(--color-critical)" }
            ]}
            centerLabel={`${optInRate}%`}
            centerSub="opt-in"
          />
        </Panel>
      </div>

      <div className="flex items-center justify-between">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "campaigns", label: "Campaigns", count: campaigns.length },
            { value: "templates", label: "Templates", count: data.templates.length }
          ]}
        />
        <Button size="sm" onClick={() => (canSend ? setComposerOpen(true) : toast("Campaign send permission required", "error"))}>
          <Send className="size-3.5" /> New campaign
        </Button>
      </div>

      {tab === "campaigns" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              canSend={canSend}
              onAction={(msg, ok) => toast(msg, ok ? "success" : "error")}
              onStatusChange={(status) => setStatus(campaign.id, status)}
            />
          ))}
          {campaigns.length === 0 ? (
            <Panel className="lg:col-span-2">
              <EmptyState icon={<Megaphone className="size-5" />} title="No campaigns yet" description="Create a WhatsApp broadcast to close care gaps at scale." />
            </Panel>
          ) : null}
        </div>
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-line">
            {data.templates.map((template) => (
              <TemplateRow key={template.id} template={template} />
            ))}
          </ul>
        </Panel>
      )}

      <CampaignComposer open={composerOpen} onClose={() => setComposerOpen(false)} templates={data.templates} onCreate={createCampaign} />
    </div>
  );
}

function CampaignCard({
  campaign,
  canSend,
  onAction,
  onStatusChange
}: {
  campaign: Campaign;
  canSend: boolean;
  onAction: (msg: string, ok: boolean) => void;
  onStatusChange: (status: Campaign["status"]) => void;
}) {
  const pct = (n: number) => (campaign.audienceSize ? Math.round((n / campaign.audienceSize) * 100) : 0);

  const primary = (() => {
    if (campaign.status === "running") return { label: "Pause", icon: <Pause className="size-3.5" />, msg: "Campaign paused", next: "paused" as const };
    if (campaign.status === "scheduled") return { label: "Launch now", icon: <Play className="size-3.5" />, msg: "Campaign launched", next: "running" as const };
    if (campaign.status === "paused") return { label: "Resume", icon: <Play className="size-3.5" />, msg: "Campaign resumed", next: "running" as const };
    if (campaign.status === "draft") return { label: "Submit", icon: <Send className="size-3.5" />, msg: "Awaiting template approval", ok: false, next: null };
    return null;
  })();

  return (
    <Panel padded={false}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink">{campaign.name}</h3>
            <Badge tone={statusTone[campaign.status]} dot className="capitalize">{campaign.status}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{campaign.audience}</p>
        </div>
        {primary ? (
          <Button
            size="sm"
            variant={campaign.status === "running" ? "outline" : "primary"}
            onClick={() => {
              if (!canSend) return onAction("Campaign send permission required", false);
              onAction(primary.msg, primary.ok !== false);
              if (primary.next) onStatusChange(primary.next);
            }}
          >
            {primary.icon} {primary.label}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1"><FileText className="size-3" /> {campaign.template}</span>
        <span className="inline-flex items-center gap-1"><Languages className="size-3" /> {campaign.language}</span>
        <span className="inline-flex items-center gap-1"><Gauge className="size-3" /> {campaign.throttlePerMin}/min</span>
        <span>· {campaign.schedule}</span>
      </div>

      {/* delivery funnel */}
      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-fill">
          <div className="bg-brand-500" style={{ width: `${pct(campaign.delivered)}%` }} />
          <div className="bg-brand-300" style={{ width: `${Math.max(0, pct(campaign.read) - pct(campaign.replied))}%` }} />
          <div className="bg-[var(--color-good)]" style={{ width: `${pct(campaign.replied)}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat n={campaign.sent} label="Sent" of={campaign.audienceSize} />
          <Stat n={campaign.delivered} label="Delivered" of={campaign.audienceSize} />
          <Stat n={campaign.read} label="Read" of={campaign.audienceSize} />
          <Stat n={campaign.replied} label="Replied" of={campaign.audienceSize} tone="good" />
        </div>
      </div>
    </Panel>
  );
}

function Stat({ n, label, of, tone }: { n: number; label: string; of: number; tone?: "good" }) {
  const pct = of ? Math.round((n / of) * 100) : 0;
  return (
    <div>
      <p className={cn("text-sm font-semibold tabular-nums", tone === "good" ? "text-[var(--color-good)]" : "text-ink")}>{formatNumber(n)}</p>
      <p className="text-[10px] text-ink-muted">{label} · {pct}%</p>
    </div>
  );
}

function TemplateRow({ template }: { template: WaTemplate }) {
  const categoryTone = { utility: "brand", marketing: "neutral", authentication: "neutral" } as const;
  const statusTone = { approved: "good", pending: "high", rejected: "critical" } as const;
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><MessageCircle className="size-3.5" /></span>
          <code className="font-mono text-sm font-semibold text-ink">{template.name}</code>
          <Badge tone={categoryTone[template.category]} className="capitalize">{template.category}</Badge>
          <Badge tone={statusTone[template.status]} dot className="capitalize">{template.status}</Badge>
        </div>
        <span className="text-[11px] text-ink-faint">{template.useCount.toLocaleString("en-IN")} sends · {template.lastUsed}</span>
      </div>
      <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-soft">{template.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Languages className="size-3 text-ink-faint" />
        {template.languages.map((language) => (
          <Badge key={language} tone="neutral">{language}</Badge>
        ))}
      </div>
    </li>
  );
}

function CampaignComposer({
  open,
  onClose,
  templates,
  onCreate
}: {
  open: boolean;
  onClose: () => void;
  templates: WaTemplate[];
  onCreate: (draft: Pick<Campaign, "name" | "template" | "audience" | "language" | "throttlePerMin">) => void;
}) {
  const approved = templates.filter((t) => t.status === "approved");
  const audiences = [
    "Post-op patients with no booked review",
    "Diabetes review due, report missing",
    "Advised procedure, estimate viewed, not booked",
    "No-show last 30 days, reachable"
  ];
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(approved[0]?.name ?? "");
  const [audience, setAudience] = useState(audiences[0]);
  const [language, setLanguage] = useState("Hindi");
  const [throttle, setThrottle] = useState(30);

  const selectedTemplate = approved.find((t) => t.name === template);
  const languages = selectedTemplate?.languages ?? ["English"];

  const submit = () => {
    onCreate({ name: name.trim() || audience, template, audience, language, throttlePerMin: throttle });
    onClose();
    setName("");
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="composer-title" className="max-w-lg">
      <div className="border-b border-line p-5">
        <h2 id="composer-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Megaphone className="size-4 text-brand-600" /> New WhatsApp campaign
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Governed broadcast — approved templates only, opt-out respected.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Campaign name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cataract review — back into care"
            className="h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
        <Field label="Audience segment">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100">
            {audiences.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Template">
            <select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                const t = approved.find((x) => x.name === e.target.value);
                if (t && !t.languages.includes(language)) setLanguage(t.languages[0]);
              }}
              className="h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            >
              {approved.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100">
              {languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Throttle · ${throttle}/min`}>
          <input type="range" min={10} max={60} step={5} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} className="w-full accent-brand-600" />
        </Field>
        {selectedTemplate ? (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-soft">{selectedTemplate.body}</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit}>
          <Send className="size-3.5" /> Schedule campaign
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
