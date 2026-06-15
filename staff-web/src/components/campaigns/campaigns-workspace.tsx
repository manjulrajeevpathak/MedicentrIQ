"use client";

import { useState, useMemo } from "react";
import {
  Check,
  CheckCheck,
  CircleSlash,
  FileText,
  Gauge,
  Languages,
  Loader2,
  MailCheck,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Reply,
  Send,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import type { Campaign, CampaignsData, WaTemplate } from "@/lib/campaigns";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile, StatGrid } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { Donut } from "@/components/ui/charts";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";

type Tab = "campaigns" | "templates";

const statusTone: Record<Campaign["status"], "good" | "brand" | "high" | "neutral" | "low"> = {
  running: "good",
  scheduled: "brand",
  completed: "neutral",
  paused: "high",
  draft: "low"
};

const LANGUAGES = ["Hindi", "English", "Marathi", "Tamil", "Telugu", "Bengali", "Kannada", "Malayalam"];
const VALID_CHANNELS = ["Campaign", "Referral", "Walk-in", "Call", "WhatsApp", "Web", "Other"] as const;

// Extract {{variable}} names from a template body
function extractVars(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// Merge {{vars}} with a recipient object
function merge(body: string, recipient: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => recipient[key] ?? `{{${key}}}`);
}

export function CampaignsWorkspace({ data, canSend }: { data: CampaignsData; canSend: boolean }) {
  const { toast } = useToast();
  const { data: appData } = useApp();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(data.campaigns);
  const [allTemplates, setAllTemplates] = useState<WaTemplate[]>(data.templates);

  // Campaign composer state
  const [composerOpen, setComposerOpen] = useState(false);
  // Template builder state
  const [builderOpen, setBuilderOpen] = useState(false);

  const optTotal = data.optIn.optedIn + data.optIn.optedOut + data.optIn.pending;
  const optInRate = Math.round((data.optIn.optedIn / optTotal) * 100);

  const setStatus = (id: string, status: Campaign["status"]) =>
    setCampaigns((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));

  const handleTemplateCreate = (template: WaTemplate) => {
    setAllTemplates((ts) => [template, ...ts]);
    toast(`Template "${template.name}" created.`, "success");
    setBuilderOpen(false);
  };

  const handleCampaignCreate = (newCampaign: Campaign) => {
    setCampaigns((cs) => [newCampaign, ...cs]);
    toast(`Campaign "${newCampaign.name}" completed.`, "success");
    setComposerOpen(false);
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
          <StatTile label="Templates live" value={String(allTemplates.filter((t) => t.status === "approved").length)} icon={<FileText className="size-4" />} tone="neutral" />
          <StatTile label="Active campaigns" value={String(campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length)} icon={<Megaphone className="size-4" />} tone="brand" />
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
            { value: "templates", label: "Templates", count: allTemplates.length }
          ]}
        />
        {tab === "campaigns" ? (
          <Button size="sm" onClick={() => (canSend ? setComposerOpen(true) : toast("Campaign send permission required", "error"))}>
            <Send className="size-3.5" /> New campaign
          </Button>
        ) : (
          <Button size="sm" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-3.5" /> New template
          </Button>
        )}
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
            {allTemplates.map((template) => (
              <TemplateRow key={template.id} template={template} />
            ))}
          </ul>
        </Panel>
      )}

      <TemplateBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} onCreate={handleTemplateCreate} />
      <CampaignComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        templates={allTemplates}
        directory={appData.directory}
        onCreate={handleCampaignCreate}
      />
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

      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-fill">
          <div className="bg-brand-500" style={{ width: `${pct(campaign.delivered)}%` }} />
          <div className="bg-brand-300" style={{ width: `${Math.max(0, pct(campaign.read) - pct(campaign.replied))}%` }} />
          <div className="bg-[var(--color-good)]" style={{ width: `${pct(campaign.replied)}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <DeliveryStat n={campaign.sent} label="Sent" of={campaign.audienceSize} />
          <DeliveryStat n={campaign.delivered} label="Delivered" of={campaign.audienceSize} />
          <DeliveryStat n={campaign.read} label="Read" of={campaign.audienceSize} />
          <DeliveryStat n={campaign.replied} label="Replied" of={campaign.audienceSize} tone="good" />
        </div>
      </div>
    </Panel>
  );
}

function DeliveryStat({ n, label, of, tone }: { n: number; label: string; of: number; tone?: "good" }) {
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
  const vars = extractVars(template.body);
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
        {vars.length > 0 && vars.map((v) => (
          <Badge key={v} tone="brand">{"{{" + v + "}}"}</Badge>
        ))}
      </div>
    </li>
  );
}

// ─── Template Builder Modal ────────────────────────────────────────────────────

function TemplateBuilderModal({
  open,
  onClose,
  onCreate
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (template: WaTemplate) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WaTemplate["category"]>("utility");
  const [language, setLanguage] = useState("Hindi");
  const [body, setBody] = useState("");

  const vars = extractVars(body);
  const slugName = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const reset = () => { setName(""); setCategory("utility"); setLanguage("Hindi"); setBody(""); };

  const submit = () => {
    if (!slugName || !body.trim()) return;
    onCreate({
      id: `wt-custom-${Date.now().toString(36)}`,
      name: slugName,
      category,
      status: "approved",
      languages: [language],
      body: body.trim(),
      useCount: 0,
      lastUsed: "—"
    });
    reset();
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} labelledBy="template-builder-title" className="max-w-lg">
      <div className="border-b border-line p-5">
        <h2 id="template-builder-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Sparkles className="size-4 text-brand-600" /> New message template
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Use <code className="text-ink">{"{{name}}"}</code>, <code className="text-ink">{"{{phone}}"}</code> etc. as patient variable placeholders.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Template name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Post-op day 2 check"
            className={inputCls}
          />
          {slugName && name !== slugName && (
            <p className="mt-1 text-[11px] text-ink-muted">Slug: <code className="text-ink">{slugName}</code></p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as WaTemplate["category"])} className={inputCls}>
              <option value="utility">Utility</option>
              <option value="marketing">Marketing</option>
              <option value="authentication">Authentication</option>
            </select>
          </Field>
          <Field label="Language">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Message body">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={"Namaste {{name}}, your appointment with {{doctor}} is on {{date}}."}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </Field>
        {vars.length > 0 && (
          <div className="rounded-xl bg-brand-50 p-3">
            <p className="text-[11px] font-semibold text-brand-700">Detected variables</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {vars.map((v) => <code key={v} className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-100">{"{{" + v + "}}"}</code>)}
            </div>
            <p className="mt-1.5 text-[11px] text-brand-600">
              <strong>name</strong> and <strong>phone</strong> are filled from patient records automatically.
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button onClick={submit} disabled={!slugName || !body.trim()}>
          <Sparkles className="size-3.5" /> Create template
        </Button>
      </div>
    </Modal>
  );
}

// ─── 4-Step Campaign Composer ──────────────────────────────────────────────────

type SendResult = { name: string; phone: string; ok: boolean; error?: string };

type ComposerStep = 1 | 2 | 3 | 4;

function CampaignComposer({
  open,
  onClose,
  templates,
  directory,
  onCreate
}: {
  open: boolean;
  onClose: () => void;
  templates: WaTemplate[];
  directory: ReturnType<typeof useApp>["data"]["directory"];
  onCreate: (campaign: Campaign) => void;
}) {
  const approved = templates.filter((t) => t.status === "approved");
  const [step, setStep] = useState<ComposerStep>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(approved[0] ?? null);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [campaignName, setCampaignName] = useState("");

  const patientsWithPhone = useMemo(
    () => directory.filter((p) => p.phone && p.phone.trim().length > 5),
    [directory]
  );

  const filteredPatients = useMemo(() => {
    let pts = patientsWithPhone;
    if (filterChannel !== "all") pts = pts.filter((p) => p.source === filterChannel || p.tags.includes(filterChannel));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pts = pts.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q));
    }
    return pts;
  }, [patientsWithPhone, filterChannel, searchQuery]);

  const selectedPatients = useMemo(
    () => directory.filter((p) => selectedPatientIds.has(p.id)),
    [directory, selectedPatientIds]
  );

  const togglePatient = (id: string) => {
    setSelectedPatientIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPatientIds.size === filteredPatients.length) {
      setSelectedPatientIds(new Set());
    } else {
      setSelectedPatientIds(new Set(filteredPatients.map((p) => p.id)));
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedTemplate(approved[0] ?? null);
    setSelectedPatientIds(new Set());
    setFilterChannel("all");
    setSearchQuery("");
    setSending(false);
    setResults([]);
    setCampaignName("");
  };

  const handleSend = async () => {
    if (!selectedTemplate || selectedPatients.length === 0) return;
    setSending(true);
    setStep(4);
    try {
      const res = await fetch("/api/whatsapp/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateBody: selectedTemplate.body,
          recipients: selectedPatients.map((p) => ({ name: p.name, phone: p.phone })),
          delayMs: 600
        })
      });
      const data: { results: SendResult[] } = await res.json();
      setResults(data.results ?? []);
      const sent = (data.results ?? []).filter((r) => r.ok).length;
      onCreate({
        id: `cmp-${Date.now().toString(36)}`,
        name: campaignName.trim() || `${selectedTemplate.name} · ${selectedPatients.length} patients`,
        template: selectedTemplate.name,
        audience: `${selectedPatients.length} selected patients`,
        audienceSize: selectedPatients.length,
        status: "completed",
        language: selectedTemplate.languages[0] ?? "Hindi",
        throttlePerMin: 6,
        schedule: "Just now",
        sent,
        delivered: sent,
        read: 0,
        replied: 0,
        optOut: 0
      });
    } finally {
      setSending(false);
    }
  };

  const stepLabels = ["Template", "Patients", "Preview", "Send"];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} labelledBy="campaign-composer-title" className="max-w-2xl">
      <div className="border-b border-line p-5">
        <h2 id="campaign-composer-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Send className="size-4 text-brand-600" /> New WhatsApp campaign
        </h2>
        {/* Step indicator */}
        <div className="mt-3 flex items-center gap-0">
          {stepLabels.map((label, i) => {
            const num = (i + 1) as ComposerStep;
            const done = step > num;
            const active = step === num;
            return (
              <div key={label} className="flex items-center">
                <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", active ? "text-brand-700" : done ? "text-[var(--color-good)]" : "text-ink-faint")}>
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px]", active ? "bg-brand-600 text-white" : done ? "bg-[var(--color-good)] text-white" : "bg-fill text-ink-muted")}>
                    {done ? <Check className="size-3" /> : num}
                  </span>
                  {label}
                </div>
                {i < stepLabels.length - 1 && <span className="mx-2 h-px w-6 bg-line" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[320px] p-5">
        {/* Step 1 — Pick template */}
        {step === 1 && (
          <div className="space-y-3">
            <Field label="Campaign name (optional)">
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Post-op cataract follow-up" className={inputCls} />
            </Field>
            <p className="text-xs font-medium text-ink-soft">Select a template</p>
            <ul className="space-y-2">
              {approved.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedTemplate(t)}
                    className={cn("w-full rounded-xl border p-3 text-left transition-colors", selectedTemplate?.id === t.id ? "border-brand-400 bg-brand-50" : "border-line bg-surface-muted hover:border-brand-200")}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("flex size-5 items-center justify-center rounded-full border", selectedTemplate?.id === t.id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-transparent")}>
                        <Check className="size-3" />
                      </span>
                      <code className="text-sm font-semibold text-ink">{t.name}</code>
                      <div className="ml-auto flex gap-1">
                        {t.languages.map((l) => <Badge key={l} tone="neutral">{l}</Badge>)}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-soft">{t.body}</p>
                  </button>
                </li>
              ))}
              {approved.length === 0 && <p className="text-sm text-ink-muted">No approved templates yet. Create one in the Templates tab first.</p>}
            </ul>
          </div>
        )}

        {/* Step 2 — Select patients */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
                <Users className="size-3.5 text-ink-faint" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                />
              </div>
              <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="h-9 rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300">
                <option value="all">All channels</option>
                {VALID_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{filteredPatients.length} patients with a phone · {selectedPatientIds.size} selected</span>
              <button onClick={toggleAll} className="font-medium text-brand-700 hover:underline">
                {selectedPatientIds.size === filteredPatients.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <ul className="max-h-64 overflow-y-auto divide-y divide-line rounded-xl border border-line">
              {filteredPatients.map((p) => (
                <li key={p.id}>
                  <button onClick={() => togglePatient(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted">
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", selectedPatientIds.has(p.id) ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface")}>
                      {selectedPatientIds.has(p.id) ? <Check className="size-3" /> : null}
                    </span>
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-[11px] text-ink-muted">{p.phone} {p.source ? `· ${p.source}` : ""}</p>
                    </div>
                    {p.condition !== "Intake pending" && <span className="text-[11px] text-ink-faint">{p.condition}</span>}
                  </button>
                </li>
              ))}
              {filteredPatients.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">No patients match this filter.</li>
              )}
            </ul>
          </div>
        )}

        {/* Step 3 — Preview */}
        {step === 3 && selectedTemplate && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-muted p-3 text-xs">
              <p className="font-semibold text-ink-muted">Template body</p>
              <p className="mt-1 text-ink-soft">{selectedTemplate.body}</p>
            </div>
            <p className="text-xs font-medium text-ink-soft">Preview — first 3 recipients</p>
            <ul className="space-y-2">
              {selectedPatients.slice(0, 3).map((p) => (
                <li key={p.id} className="rounded-xl border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold text-ink-muted">{p.name} · {p.phone}</p>
                  <p className="mt-1.5 text-sm text-ink">{merge(selectedTemplate.body, { name: p.name, phone: p.phone })}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-muted">
              {selectedPatients.length} patients selected · sending with ~600ms gap per message.
            </p>
          </div>
        )}

        {/* Step 4 — Send / Results */}
        {step === 4 && (
          <div className="space-y-4">
            {sending ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="size-8 animate-spin text-brand-500" />
                <p className="text-sm text-ink-muted">Sending to {selectedPatients.length} patients…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1 rounded-xl bg-[var(--color-good-soft,#f0fdf4)] p-3 text-center">
                    <p className="text-2xl font-bold text-[var(--color-good)]">{results.filter((r) => r.ok).length}</p>
                    <p className="text-xs text-ink-muted">Sent</p>
                  </div>
                  <div className="flex-1 rounded-xl bg-red-50 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{results.filter((r) => !r.ok).length}</p>
                    <p className="text-xs text-ink-muted">Failed</p>
                  </div>
                </div>
                {results.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-line rounded-xl border border-line">
                    {results.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 px-3 py-2">
                        <span className={cn("flex size-5 items-center justify-center rounded-full", r.ok ? "bg-[var(--color-good)] text-white" : "bg-red-100 text-red-600")}>
                          {r.ok ? <Check className="size-3" /> : <span className="text-[10px] font-bold">!</span>}
                        </span>
                        <span className="flex-1 text-sm text-ink">{r.name}</span>
                        <span className="text-[11px] text-ink-faint">{r.phone}</span>
                        {r.error && <span className="text-[11px] text-red-500">{r.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between gap-2 border-t border-line p-4">
        {step > 1 && step < 4 ? (
          <Button variant="outline" onClick={() => setStep((s) => (s - 1) as ComposerStep)}>Back</Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          {step < 4 && (
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!selectedTemplate}>
              Next: Select patients
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={selectedPatientIds.size === 0}>
              Next: Preview ({selectedPatientIds.size})
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleSend}>
              <Send className="size-3.5" /> Send to {selectedPatients.length} patients
            </Button>
          )}
          {step === 4 && !sending && (
            <Button onClick={() => { reset(); onClose(); }}>Done</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

const inputCls = "h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
