"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  ListChecks,
  Phone,
  Plus,
  RefreshCw,
  Settings2,
  Sheet,
  Sprout,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/users-types";
import {
  CALLBACK_CHANNEL_TONE,
  FORM_STATUS_TONE,
  LEAD_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  callbackChannelLabel,
  configLabel,
  formatDueDate,
  formatLeadDate,
  isOverdue,
  relativeDue,
  slugifyConfigKey,
  type EnrichedCallback,
  type Lead,
  type LeadFieldType,
  type LeadForm,
  type LeadFormField,
  type LeadFunnel,
  type LeadFunnelStage,
  type LeadSheetConfig,
  type LeadSourceOption
} from "@/lib/leads-types";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import {
  convertLeadAction,
  createFormAction,
  createLeadAction,
  importLeadsAction,
  loadOpenCallbacksAction,
  moveLeadStageAction,
  saveLeadConfigAction,
  saveLeadSheetConfigAction,
  setFormStatusAction,
  syncLeadSheetAction,
  updateCallbackAction
} from "@/app/(app)/leads/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Tab = "board" | "leads" | "tasks" | "import" | "forms";

type Props = {
  leads: Lead[];
  funnel: LeadFunnel;
  forms: LeadForm[];
  branches: Branch[];
  sources: LeadSourceOption[];
  stages: LeadFunnelStage[];
  sheetConfig: LeadSheetConfig;
  isAdmin: boolean;
  origin: string;
};

export function LeadsWorkspace({
  leads,
  forms,
  branches,
  sources,
  stages,
  sheetConfig,
  isAdmin,
  origin
}: Props) {
  const [tab, setTab] = useState<Tab>("board");
  const [manageOpen, setManageOpen] = useState(false);
  // The lead whose 360 drawer is open (null = closed). Shared by Board, List and Tasks.
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Sprout className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Leads</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Camp, web-form and referral leads — move them through your funnel and convert.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { value: "board", label: "Board" },
              { value: "leads", label: "List", count: leads.length },
              { value: "tasks", label: "Tasks" },
              { value: "import", label: "Import" },
              { value: "forms", label: "Forms", count: forms.length }
            ]}
            value={tab}
            onChange={setTab}
          />
          {isAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings2 className="size-3.5" /> Manage funnel
            </Button>
          ) : null}
        </div>
      </div>

      {tab === "board" ? (
        <FunnelBoard
          leads={leads}
          stages={stages}
          sources={sources}
          branches={branches}
          onOpenLead={setDetailLeadId}
        />
      ) : null}
      {tab === "leads" ? (
        <LeadsTab
          leads={leads}
          branches={branches}
          sources={sources}
          stages={stages}
          onOpenLead={setDetailLeadId}
        />
      ) : null}
      {tab === "tasks" ? <TasksTab onOpenLead={setDetailLeadId} /> : null}
      {tab === "import" ? (
        <ImportTab sources={sources} sheetConfig={sheetConfig} isAdmin={isAdmin} />
      ) : null}
      {tab === "forms" ? <FormsTab forms={forms} branches={branches} origin={origin} /> : null}

      {isAdmin && manageOpen ? (
        <ManageFunnelModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          sources={sources}
          stages={stages}
        />
      ) : null}

      {detailLeadId ? (
        <LeadDetailDrawer
          leadId={detailLeadId}
          stages={stages}
          sources={sources}
          onClose={() => setDetailLeadId(null)}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// Funnel board (kanban — one column per configured stage, in order)
// ============================================================================

function FunnelBoard({
  leads,
  stages,
  sources,
  branches,
  onOpenLead
}: {
  leads: Lead[];
  stages: LeadFunnelStage[];
  sources: LeadSourceOption[];
  branches: Branch[];
  onOpenLead: (leadId: string) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  // Group leads by their configured stage. Leads whose stage isn't in the
  // configured list fall into a synthetic "Unsorted" column so nothing is lost.
  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of stages) map.set(stage.key, []);
    const orphans: Lead[] = [];
    for (const lead of leads) {
      const bucket = map.get(lead.stage);
      if (bucket) bucket.push(lead);
      else orphans.push(lead);
    }
    return { map, orphans };
  }, [leads, stages]);

  if (stages.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<Filter className="size-5" />}
          title="No funnel stages configured"
          description="Add at least one stage under Manage funnel to start building your board."
        />
      </Panel>
    );
  }

  const columns: { key: string; label: string; leads: Lead[] }[] = stages.map((s) => ({
    key: s.key,
    label: s.label,
    leads: byStage.map.get(s.key) ?? []
  }));
  if (byStage.orphans.length > 0) {
    columns.push({ key: "__unsorted", label: "Unsorted", leads: byStage.orphans });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          icon={<Filter className="size-4" />}
          title="Funnel board"
          subtitle={stages.map((s) => s.label).join(" → ")}
        />
        <Button size="sm" onClick={() => setComposerOpen(true)}>
          <UserPlus className="size-3.5" /> New lead
        </Button>
      </div>

      {leads.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Sprout className="size-5" />}
            title="No leads yet"
            description="As camps, web forms and referrals come in, they'll line up across your funnel here."
          />
        </Panel>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex w-[260px] shrink-0 flex-col rounded-xl border border-line bg-surface-muted/40"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <span className="truncate text-xs font-semibold text-ink-soft">{col.label}</span>
                <span className="rounded-full bg-fill-strong px-1.5 text-[10px] font-semibold tabular-nums text-ink-muted">
                  {col.leads.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {col.leads.length === 0 ? (
                  <p className="px-1 py-3 text-center text-[11px] text-ink-faint">No leads</p>
                ) : (
                  col.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stages={stages}
                      sources={sources}
                      onOpen={onOpenLead}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewLeadModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        branches={branches}
        sources={sources}
      />
    </>
  );
}

function LeadCard({
  lead,
  stages,
  sources,
  onOpen
}: {
  lead: Lead;
  stages: LeadFunnelStage[];
  sources: LeadSourceOption[];
  onOpen: (leadId: string) => void;
}) {
  const { toast } = useToast();
  const [stage, setStage] = useState(lead.stage);
  const [pending, startTransition] = useTransition();

  function move(next: string) {
    if (next === stage) return;
    const prev = stage;
    setStage(next);
    startTransition(async () => {
      const result = await moveLeadStageAction(lead.id, next);
      if (!result.ok) {
        setStage(prev);
        toast(result.error ?? "Could not move the lead.", "error");
        return;
      }
      toast(result.message ?? "Lead moved.", "success");
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-2.5 shadow-sm transition hover:border-line-strong">
      <button
        type="button"
        onClick={() => onOpen(lead.id)}
        className="block w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-xs font-semibold text-ink">{lead.name}</span>
          <Badge tone="neutral">{configLabel(sources, lead.source)}</Badge>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">{lead.phone || "No phone"}</p>
        {lead.assignedTo ? (
          <p className="mt-0.5 truncate text-[11px] text-ink-faint">Owner: {lead.assignedTo}</p>
        ) : null}
      </button>
      <div className="mt-2">
        <label className="sr-only" htmlFor={`move-${lead.id}`}>
          Move {lead.name} to a stage
        </label>
        <select
          id={`move-${lead.id}`}
          value={stages.some((s) => s.key === stage) ? stage : ""}
          onChange={(e) => move(e.target.value)}
          disabled={pending}
          className={cn(selectClass, "h-8 text-xs")}
        >
          {!stages.some((s) => s.key === stage) ? (
            <option value="">Move to…</option>
          ) : null}
          {stages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// Leads list tab
// ============================================================================

function LeadsTab({
  leads,
  branches,
  sources,
  stages,
  onOpenLead
}: {
  leads: Lead[];
  branches: Branch[];
  sources: LeadSourceOption[];
  stages: LeadFunnelStage[];
  onOpenLead: (leadId: string) => void;
}) {
  const [stageFilter, setStageFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [composerOpen, setComposerOpen] = useState(false);

  const filtered = useMemo(() => {
    return leads.filter(
      (l) =>
        (!stageFilter || l.stage === stageFilter) &&
        (!sourceFilter || l.source === sourceFilter)
    );
  }, [leads, stageFilter, sourceFilter]);

  return (
    <>
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SectionTitle
            icon={<Users className="size-4" />}
            title="Leads"
            subtitle={`${filtered.length} of ${leads.length}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={cn(selectClass, "h-9 w-auto")}>
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={cn(selectClass, "h-9 w-auto")}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => setComposerOpen(true)}>
              <UserPlus className="size-3.5" /> New lead
            </Button>
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No leads yet"
            description="Add your first lead, import a CSV, or publish a camp form to start capturing them."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Filter className="size-5" />} title="No matches" description="No leads match the current filters." />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                sources={sources}
                stages={stages}
                onOpen={onOpenLead}
              />
            ))}
          </ul>
        )}
      </Panel>

      <NewLeadModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        branches={branches}
        sources={sources}
      />
    </>
  );
}

function LeadRow({
  lead,
  sources,
  stages,
  onOpen
}: {
  lead: Lead;
  sources: LeadSourceOption[];
  stages: LeadFunnelStage[];
  onOpen: (leadId: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [stage, setStage] = useState(lead.stage);
  const [pending, startTransition] = useTransition();
  const converted = Boolean(lead.convertedPatientId);

  function changeStage(next: string) {
    const prev = stage;
    setStage(next);
    startTransition(async () => {
      const result = await moveLeadStageAction(lead.id, next);
      if (!result.ok) {
        setStage(prev);
        toast(result.error ?? "Could not update the stage.", "error");
        return;
      }
      toast("Stage updated.", "success");
    });
  }

  function convert() {
    startTransition(async () => {
      const result = await convertLeadAction(lead.id);
      if (!result.ok || !result.data) {
        toast(result.error ?? "Could not convert the lead.", "error");
        return;
      }
      toast(result.message ?? "Converted.", "success");
      router.push(`/patients/${result.data.id}`);
    });
  }

  const knownStage = stages.some((s) => s.key === stage);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={() => onOpen(lead.id)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{lead.name}</span>
          <Badge tone="neutral">{configLabel(sources, lead.source)}</Badge>
          {lead.matchedPatientId && !converted ? (
            <Badge tone="violet" dot>Matches a patient</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {[lead.phone, lead.email, lead.sourceDetail].filter(Boolean).join(" · ") || "No contact details"}
          {" · "}
          {formatLeadDate(lead.createdAt)}
        </p>
      </button>

      <div className="flex items-center gap-2">
        {converted && lead.convertedPatientId ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/patients/${lead.convertedPatientId}`)}
          >
            View patient <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <>
            <select
              value={knownStage ? stage : ""}
              onChange={(e) => changeStage(e.target.value)}
              disabled={pending}
              aria-label={`Stage for ${lead.name}`}
              className={cn(selectClass, "h-9 w-auto")}
            >
              {!knownStage ? <option value="">Move to…</option> : null}
              {stages.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={convert} disabled={pending}>
              <UserPlus className="size-3.5" /> Convert
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function NewLeadModal({
  open,
  onClose,
  branches,
  sources
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  sources: LeadSourceOption[];
}) {
  const { toast } = useToast();
  const defaultSource = sources[0]?.key ?? "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<string>(defaultSource);
  const [sourceDetail, setSourceDetail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setSource(defaultSource);
    setSourceDetail("");
    setBranchId("");
    setError(null);
  }

  function submit() {
    if (!name.trim()) return setError("Enter the lead's name.");
    if (!phone.trim()) return setError("Enter a phone number.");
    setError(null);
    startSaving(async () => {
      const result = await createLeadAction({
        name,
        phone,
        email: email || undefined,
        source: source || defaultSource || "other",
        sourceDetail: sourceDetail || undefined,
        branchId: branchId || undefined
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create the lead.");
        return;
      }
      reset();
      onClose();
      toast(result.message ?? "Lead added.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-lead-title" className="max-w-lg">
      <div className="border-b border-line p-5">
        <h2 id="new-lead-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <UserPlus className="size-4 text-brand-600" /> New lead
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Capture a lead from a camp, call or referral.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Full name" htmlFor="nl-name">
          <Input id="nl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="nl-phone">
            <Input id="nl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91…" />
          </Field>
          <Field label="Email (optional)" htmlFor="nl-email">
            <Input id="nl-email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="name@example.com" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source" htmlFor="nl-source">
            <select id="nl-source" value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Source detail (optional)" htmlFor="nl-detail">
            <Input id="nl-detail" value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} placeholder="e.g. Eye camp, Andheri" />
          </Field>
        </div>
        {branches.length > 0 ? (
          <Field label="Branch (optional)" htmlFor="nl-branch">
            <select id="nl-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          <UserPlus className="size-3.5" /> {saving ? "Adding…" : "Add lead"}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Tasks tab — open callbacks across every lead (due-soonest / most-overdue first)
// ============================================================================

function TasksTab({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const [callbacks, setCallbacks] = useState<EnrichedCallback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setCallbacks(null);
    setError(null);
    loadOpenCallbacksAction().then((result) => {
      if (!active) return;
      if (result.ok) setCallbacks(result.data);
      else setError(result.error ?? "Couldn't load tasks.");
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  const overdueCount = (callbacks ?? []).filter((c) => isOverdue(c.dueAt)).length;

  return (
    <Panel padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <SectionTitle
          icon={<ListChecks className="size-4" />}
          title="Tasks"
          subtitle={
            callbacks === null
              ? "Loading…"
              : `${callbacks.length} open callback${callbacks.length === 1 ? "" : "s"}${
                  overdueCount > 0 ? ` · ${overdueCount} overdue` : ""
                }`
          }
        />
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {error ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="Couldn't load tasks"
          description={error}
        />
      ) : callbacks === null ? (
        <p className="p-6 text-center text-sm text-ink-muted">Loading tasks…</p>
      ) : callbacks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="No open callbacks"
          description="Scheduled callbacks across all leads show up here, most-overdue first."
        />
      ) : (
        <ul className="divide-y divide-line">
          {callbacks.map((cb) => (
            <TaskRow key={cb.id} callback={cb} onOpenLead={onOpenLead} onChanged={refresh} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TaskRow({
  callback,
  onOpenLead,
  onChanged
}: {
  callback: EnrichedCallback;
  onOpenLead: (leadId: string) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const overdue = isOverdue(callback.dueAt);

  function markDone() {
    startTransition(async () => {
      const result = await updateCallbackAction(callback.id, "done");
      if (!result.ok) {
        toast(result.error ?? "Could not update the callback.", "error");
        return;
      }
      toast(result.message ?? "Callback marked done.", "success");
      onChanged();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={() => onOpenLead(callback.leadId)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {callback.leadName ?? "Lead"}
          </span>
          {callback.leadPhone ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Phone className="size-3" /> {callback.leadPhone}
            </span>
          ) : null}
          <Badge tone={CALLBACK_CHANNEL_TONE[callback.channel] ?? "neutral"}>
            {callbackChannelLabel(callback.channel)}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{callback.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          <span className={cn(overdue && "font-semibold text-[var(--color-critical)]")}>
            {formatDueDate(callback.dueAt)} · {relativeDue(callback.dueAt)}
          </span>
        </p>
      </button>

      <Button variant="outline" size="sm" onClick={markDone} disabled={pending}>
        <Check className="size-3.5" /> Mark done
      </Button>
    </li>
  );
}

// ============================================================================
// Manage funnel (configure sources + ordered stages) — admin only
// ============================================================================

let manageKeyCounter = 0;
type EditableEntry = { _id: number; key: string; label: string; keyTouched: boolean };

function toEditable(list: { key: string; label: string }[]): EditableEntry[] {
  return list.map((e) => ({ _id: ++manageKeyCounter, key: e.key, label: e.label, keyTouched: true }));
}

function ManageFunnelModal({
  open,
  onClose,
  sources,
  stages
}: {
  open: boolean;
  onClose: () => void;
  sources: LeadSourceOption[];
  stages: LeadFunnelStage[];
}) {
  const { toast } = useToast();
  const [stageList, setStageList] = useState<EditableEntry[]>(() => toEditable(stages));
  const [sourceList, setSourceList] = useState<EditableEntry[]>(() => toEditable(sources));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function addEntry(setList: typeof setStageList) {
    setList((prev) => [...prev, { _id: ++manageKeyCounter, key: "", label: "", keyTouched: false }]);
  }

  function updateEntry(setList: typeof setStageList, id: number, patch: Partial<EditableEntry>) {
    setList((prev) => prev.map((e) => (e._id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(setList: typeof setStageList, id: number) {
    setList((prev) => prev.filter((e) => e._id !== id));
  }

  function move(setList: typeof setStageList, id: number, dir: -1 | 1) {
    setList((prev) => {
      const idx = prev.findIndex((e) => e._id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function finalize(list: EditableEntry[]): { key: string; label: string }[] {
    return list
      .map((e) => {
        const label = e.label.trim();
        const key = (e.key.trim() || slugifyConfigKey(label)).trim();
        return { key, label };
      })
      .filter((e) => e.key && e.label);
  }

  function submit() {
    const finalStages = finalize(stageList);
    const finalSources = finalize(sourceList);
    if (finalStages.length === 0) return setError("Add at least one funnel stage.");
    if (finalSources.length === 0) return setError("Add at least one lead source.");
    const stageKeys = new Set<string>();
    for (const s of finalStages) {
      if (stageKeys.has(s.key)) return setError(`Duplicate stage key: ${s.key}`);
      stageKeys.add(s.key);
    }
    const sourceKeys = new Set<string>();
    for (const s of finalSources) {
      if (sourceKeys.has(s.key)) return setError(`Duplicate source key: ${s.key}`);
      sourceKeys.add(s.key);
    }
    setError(null);
    startSaving(async () => {
      const result = await saveLeadConfigAction({ stages: finalStages, sources: finalSources });
      if (!result.ok) {
        setError(result.error ?? "Could not save the funnel.");
        return;
      }
      onClose();
      toast(result.message ?? "Funnel updated.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="manage-funnel-title" className="max-w-2xl">
      <div className="border-b border-line p-5">
        <h2 id="manage-funnel-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Settings2 className="size-4 text-brand-600" /> Manage funnel
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Configure your lead funnel stages (in order) and the sources leads can come from.
        </p>
      </div>

      <div className="max-h-[64vh] space-y-6 overflow-y-auto p-5">
        <EntryEditor
          title="Funnel stages"
          subtitle="Shown left-to-right on the board. Reorder with the arrows."
          entries={stageList}
          ordered
          onAdd={() => addEntry(setStageList)}
          onUpdate={(id, patch) => updateEntry(setStageList, id, patch)}
          onRemove={(id) => removeEntry(setStageList, id)}
          onMove={(id, dir) => move(setStageList, id, dir)}
          addLabel="Add stage"
          labelPlaceholder="e.g. Qualified"
        />
        <EntryEditor
          title="Lead sources"
          subtitle="Where leads come from (camp, web form, referral…)."
          entries={sourceList}
          ordered={false}
          onAdd={() => addEntry(setSourceList)}
          onUpdate={(id, patch) => updateEntry(setSourceList, id, patch)}
          onRemove={(id) => removeEntry(setSourceList, id)}
          onMove={() => {}}
          addLabel="Add source"
          labelPlaceholder="e.g. Web form"
        />
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          <Check className="size-3.5" /> {saving ? "Saving…" : "Save funnel"}
        </Button>
      </div>
    </Modal>
  );
}

function EntryEditor({
  title,
  subtitle,
  entries,
  ordered,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  addLabel,
  labelPlaceholder
}: {
  title: string;
  subtitle: string;
  entries: EditableEntry[];
  ordered: boolean;
  onAdd: () => void;
  onUpdate: (id: number, patch: Partial<EditableEntry>) => void;
  onRemove: (id: number) => void;
  onMove: (id: number, dir: -1 | 1) => void;
  addLabel: string;
  labelPlaceholder: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-soft">{title}</p>
          <p className="text-[11px] text-ink-muted">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      </div>
      <ul className="space-y-2">
        {entries.map((e, i) => (
          <li key={e._id} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-muted p-2.5">
            {ordered ? (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => onMove(e._id, -1)}
                  disabled={i === 0}
                  className="flex size-5 items-center justify-center rounded text-ink-faint transition hover:text-ink disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(e._id, 1)}
                  disabled={i === entries.length - 1}
                  className="flex size-5 items-center justify-center rounded text-ink-faint transition hover:text-ink disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            ) : null}
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Label</label>
              <Input
                value={e.label}
                onChange={(ev) => {
                  const label = ev.target.value;
                  // Auto-derive the key from the label until the user edits the key.
                  const patch: Partial<EditableEntry> = { label };
                  if (!e.keyTouched) patch.key = slugifyConfigKey(label);
                  onUpdate(e._id, patch);
                }}
                placeholder={labelPlaceholder}
              />
            </div>
            <div className="w-40">
              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Key</label>
              <Input
                value={e.key}
                onChange={(ev) => onUpdate(e._id, { key: slugifyConfigKey(ev.target.value), keyTouched: true })}
                placeholder="auto"
                className="font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(e._id)}
              className="flex size-10 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
              aria-label="Remove"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Import tab
// ============================================================================

/** Minimal CSV parser: first row = headers; handles commas + double-quoted cells. */
function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = cells[i] ?? "";
    });
    return record;
  });
  return { headers, rows };
}

function guessColumn(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

type ParsedSheet = { headers: string[]; rows: Array<Record<string, string>> };

/** Build row objects from a sheet-style array-of-arrays (first row = headers). */
function rowsFromMatrix(matrix: unknown[][]): ParsedSheet {
  const nonEmpty = matrix.filter((r) => r.some((c) => String(c ?? "").trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((c) => String(c ?? "").trim());
  const rows = nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = String(cells[i] ?? "").trim();
    });
    return record;
  });
  return { headers, rows };
}

/** Read the first sheet of an .xlsx/.xls workbook into the same shape as parseCsv. */
function parseWorkbook(data: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(data, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  return rowsFromMatrix(matrix);
}

/** Generate + download the templatised leads workbook entirely client-side. */
function downloadLeadsTemplate() {
  const aoa = [
    ["Name", "Phone", "Source", "Notes"],
    ["Ramesh Kumar", "+919812345678", "camp", "Met at eye camp"]
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Leads");
  XLSX.writeFile(wb, "healthcareos-leads-template.xlsx");
}

type ImportMode = "file" | "sheet";

function ImportTab({
  sources,
  sheetConfig,
  isAdmin
}: {
  sources: LeadSourceOption[];
  sheetConfig: LeadSheetConfig;
  isAdmin: boolean;
}) {
  // A sub-toggle splits the Import area into the existing Excel/CSV paste import
  // and the (admin-only) Google Sheet connect. Both are about getting leads in.
  const [mode, setMode] = useState<ImportMode>("file");

  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        options={[
          { value: "file", label: "Excel / CSV" },
          { value: "sheet", label: "Google Sheet" }
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "file" ? (
        <FileImport sources={sources} />
      ) : (
        <GoogleSheetConnect sources={sources} config={sheetConfig} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function FileImport({ sources }: { sources: LeadSourceOption[] }) {
  const { toast } = useToast();
  const defaultSource = sources[0]?.key ?? "import";
  const [raw, setRaw] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [source, setSource] = useState<string>(defaultSource);
  const [nameCol, setNameCol] = useState("");
  const [phoneCol, setPhoneCol] = useState("");
  const [emailCol, setEmailCol] = useState("");
  const [sourceCol, setSourceCol] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [importing, startImport] = useTransition();

  // The CSV textarea drives `sheet` directly; an uploaded .xlsx sets `sheet`
  // (and clears the textarea, which is CSV-only).
  const parsed = useMemo<ParsedSheet>(() => sheet ?? { headers: [], rows: [] }, [sheet]);

  function mapColumns(headers: string[]) {
    if (headers.length > 0) {
      setNameCol(guessColumn(headers, ["name"]) || headers[0]);
      setPhoneCol(guessColumn(headers, ["phone", "mobile", "contact"]) || "");
      setEmailCol(guessColumn(headers, ["email", "mail"]) || "");
      setSourceCol(guessColumn(headers, ["source"]) || "");
    } else {
      setNameCol("");
      setPhoneCol("");
      setEmailCol("");
      setSourceCol("");
    }
  }

  function applyCsv(text: string) {
    setRaw(text);
    setResult(null);
    const next = parseCsv(text);
    setSheet(next.headers.length > 0 ? next : null);
    mapColumns(next.headers);
  }

  function onFile(file: File) {
    setResult(null);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const next = parseWorkbook(reader.result as ArrayBuffer);
          if (next.headers.length === 0) {
            toast("That spreadsheet had no readable rows.", "error");
            return;
          }
          setRaw("");
          setSheet(next);
          mapColumns(next.headers);
        } catch {
          toast("Could not read that Excel file.", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => applyCsv(String(reader.result ?? ""));
      reader.readAsText(file);
    }
  }

  function submit() {
    if (parsed.rows.length === 0) {
      toast("Paste CSV or upload a file first.", "error");
      return;
    }
    if (!nameCol || !phoneCol) {
      toast("Map at least the name and phone columns.", "error");
      return;
    }

    const mapping = { name: nameCol, phone: phoneCol, email: emailCol || undefined };

    // A Source column, when mapped, sets each row's source (falling back to the
    // selected source for blank cells). The import endpoint takes a single
    // source per call, so we group rows by their resolved source and import
    // each group, then sum the results.
    const groups = new Map<string, Array<Record<string, string>>>();
    for (const row of parsed.rows) {
      const rowSource = sourceCol ? (row[sourceCol] ?? "").trim() || source : source;
      const bucket = groups.get(rowSource) ?? [];
      bucket.push(row);
      groups.set(rowSource, bucket);
    }

    startImport(async () => {
      let created = 0;
      let skipped = 0;
      for (const [groupSource, rows] of groups) {
        const res = await importLeadsAction({ source: groupSource, rows, mapping });
        if (!res.ok || !res.data) {
          toast(res.error ?? "Could not import.", "error");
          return;
        }
        created += res.data.created;
        skipped += res.data.skipped;
      }
      setResult({ created, skipped });
      toast(`Imported ${created} lead${created === 1 ? "" : "s"}.`, "success");
    });
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          icon={<Upload className="size-4" />}
          title="Import leads"
          subtitle="Download the Excel template, fill it, and upload — or paste CSV."
        />
        <Button variant="outline" size="sm" onClick={downloadLeadsTemplate}>
          <Download className="size-3.5" /> Download Excel template
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">CSV data</p>
          <textarea
            value={raw}
            onChange={(e) => applyCsv(e.target.value)}
            rows={6}
            placeholder={"name,phone,source,notes\nRamesh Kumar,+919812345678,camp,Met at eye camp"}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
              className="text-xs text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
              <FileSpreadsheet className="size-3.5" /> .csv, .xlsx or .xls
            </span>
          </div>
        </div>

        {parsed.headers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <Field label="Source" htmlFor="imp-source">
                <select id="imp-source" value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
                  {sources.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Name column" htmlFor="imp-name">
                <select id="imp-name" value={nameCol} onChange={(e) => setNameCol(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>
              <Field label="Phone column" htmlFor="imp-phone">
                <select id="imp-phone" value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>
              <Field label="Email column" htmlFor="imp-email">
                <select id="imp-email" value={emailCol} onChange={(e) => setEmailCol(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>
              <Field label="Source column" htmlFor="imp-source-col">
                <select id="imp-source-col" value={sourceCol} onChange={(e) => setSourceCol(e.target.value)} className={selectClass}>
                  <option value="">— (use selected)</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5">
              <p className="text-xs text-ink-soft">
                <span className="font-semibold text-ink">{parsed.rows.length}</span> row
                {parsed.rows.length === 1 ? "" : "s"} ready to import
              </p>
              <Button onClick={submit} disabled={importing}>
                <Upload className="size-3.5" /> {importing ? "Importing…" : "Import leads"}
              </Button>
            </div>
          </>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good-soft)] px-3.5 py-2.5 text-xs text-ink-soft">
            <Check className="mr-1 inline size-3.5 text-[var(--color-good)]" />
            Imported <span className="font-semibold text-ink">{result.created}</span>, skipped{" "}
            <span className="font-semibold text-ink">{result.skipped}</span>.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// ============================================================================
// Google Sheet connect (CRM Phase 3) — admin only
// ============================================================================

function GoogleSheetConnect({
  sources,
  config,
  isAdmin
}: {
  sources: LeadSourceOption[];
  config: LeadSheetConfig;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(config.enabled);
  const [csvUrl, setCsvUrl] = useState(config.csvUrl ?? "");
  const [nameCol, setNameCol] = useState(config.mapping.name ?? "");
  const [phoneCol, setPhoneCol] = useState(config.mapping.phone ?? "");
  const [emailCol, setEmailCol] = useState(config.mapping.email ?? "");
  const [sourceKey, setSourceKey] = useState(config.sourceKey ?? sources[0]?.key ?? "");
  // Locally-tracked "last synced"/result so a Sync now reflects immediately
  // (the server-rendered config also refreshes via revalidatePath).
  const [lastSyncedAt, setLastSyncedAt] = useState(config.lastSyncedAt);
  const [lastResult, setLastResult] = useState(config.lastResult);
  const [saving, startSaving] = useTransition();
  const [syncing, startSync] = useTransition();

  if (!isAdmin) {
    return (
      <Panel>
        <EmptyState
          icon={<Sheet className="size-5" />}
          title="Google Sheet sync"
          description="Connecting a Google Sheet is an admin-only setting. Ask an admin to set it up."
        />
      </Panel>
    );
  }

  function save() {
    if (csvUrl.trim() && !phoneCol.trim()) {
      toast("Map the Phone column — it's required to import rows.", "error");
      return;
    }
    startSaving(async () => {
      const result = await saveLeadSheetConfigAction({
        enabled,
        csvUrl: csvUrl.trim(),
        mapping: { name: nameCol, phone: phoneCol, email: emailCol },
        sourceKey
      });
      if (!result.ok) {
        toast(result.error ?? "Could not save the connection.", "error");
        return;
      }
      toast(result.message ?? "Saved.", "success");
    });
  }

  function sync() {
    if (!csvUrl.trim()) {
      toast("Paste the published CSV URL and Save first.", "error");
      return;
    }
    startSync(async () => {
      const result = await syncLeadSheetAction();
      if (!result.ok || !result.data) {
        toast(result.error ?? "Could not sync the sheet.", "error");
        return;
      }
      const at = new Date().toISOString();
      setLastSyncedAt(at);
      setLastResult({ ...result.data, at });
      toast(result.message ?? "Synced.", "success");
    });
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          icon={<Sheet className="size-4" />}
          title="Connect a Google Sheet"
          subtitle="Sync rows from a published Google Sheet straight into your leads."
        />
        <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
          />
          Enabled
          <Badge tone={enabled ? "good" : "neutral"} dot>
            {enabled ? "On" : "Off"}
          </Badge>
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
        <p className="mb-1 font-semibold text-ink">How to publish your sheet as CSV</p>
        <p>
          In Google Sheets, open <span className="font-medium text-ink">File → Share → Publish to web</span>.
          Under <span className="font-medium text-ink">Link</span>, choose the specific sheet (tab) you want,
          then change the format dropdown from <span className="font-medium text-ink">Web page</span> to{" "}
          <span className="font-medium text-ink">Comma-separated values (.csv)</span>. Click{" "}
          <span className="font-medium text-ink">Publish</span>, copy the URL it gives you, and paste it below.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <Field
          label="Published CSV URL"
          htmlFor="gs-url"
          hint="Should look like https://docs.google.com/spreadsheets/d/e/…/pub?gid=0&single=true&output=csv"
        >
          <Input
            id="gs-url"
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"
            inputMode="url"
            className="font-mono text-xs"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Column mapping</p>
          <p className="mb-2 text-[11px] text-ink-muted">
            Type the exact CSV header names from your sheet&apos;s first row. Phone is required; rows without a
            phone are skipped.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name column" htmlFor="gs-name">
              <Input id="gs-name" value={nameCol} onChange={(e) => setNameCol(e.target.value)} placeholder="e.g. Full Name" />
            </Field>
            <Field label="Phone column" htmlFor="gs-phone">
              <Input id="gs-phone" value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)} placeholder="e.g. Mobile" />
            </Field>
            <Field label="Email column (optional)" htmlFor="gs-email">
              <Input id="gs-email" value={emailCol} onChange={(e) => setEmailCol(e.target.value)} placeholder="e.g. Email" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Source" htmlFor="gs-source" hint="Imported leads are tagged with this source.">
            <select id="gs-source" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} className={selectClass}>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving}>
            <Check className="size-3.5" /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} /> {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>

        {lastSyncedAt ? (
          <div className="rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-xs text-ink-soft">
            <p>
              Last synced <span className="font-medium text-ink">{formatDueDate(lastSyncedAt)}</span>
            </p>
            {lastResult ? (
              lastResult.error ? (
                <p className="mt-1 font-medium text-[var(--color-critical)]">{lastResult.error}</p>
              ) : (
                <p className="mt-1">
                  Imported <span className="font-semibold text-ink">{lastResult.imported}</span> new
                  {" · "}skipped <span className="font-semibold text-ink">{lastResult.skipped}</span>
                  {" · "}{lastResult.total} row{lastResult.total === 1 ? "" : "s"} read
                </p>
              )
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-ink-muted">Not synced yet. Save the connection, then Sync now.</p>
        )}
      </div>
    </Panel>
  );
}

// ============================================================================
// Forms tab
// ============================================================================

function FormsTab({
  forms,
  branches,
  origin
}: {
  forms: LeadForm[];
  branches: Branch[];
  origin: string;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <>
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SectionTitle
            icon={<FileText className="size-4" />}
            title="Camp & web forms"
            subtitle={`${forms.length} ${forms.length === 1 ? "form" : "forms"}`}
          />
          <Button size="sm" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-3.5" /> New form
          </Button>
        </div>

        {forms.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No forms yet"
            description="Build a public form to share with camps and capture leads automatically."
          />
        ) : (
          <ul className="divide-y divide-line">
            {forms.map((form) => (
              <FormRow key={form.id} form={form} origin={origin} />
            ))}
          </ul>
        )}
      </Panel>

      <FormBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} branches={branches} />
    </>
  );
}

function FormRow({ form, origin }: { form: LeadForm; origin: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(form.status);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const publicUrl = `${origin}/f/${form.slug}`;
  const active = status === "active";

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Could not copy. Copy it manually.", "error");
    }
  }

  function toggle() {
    const next = active ? "inactive" : "active";
    setStatus(next);
    startTransition(async () => {
      const result = await setFormStatusAction(form.id, next);
      if (!result.ok) {
        setStatus(form.status);
        toast(result.error ?? "Could not update the form.", "error");
        return;
      }
      toast(result.message ?? "Updated.", "success");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{form.title}</span>
          <Badge tone={FORM_STATUS_TONE[status] ?? "neutral"} dot className="capitalize">
            {String(status)}
          </Badge>
          <Badge tone="neutral">{form.submissions} submission{form.submissions === 1 ? "" : "s"}</Badge>
        </div>
        <button
          type="button"
          onClick={copy}
          className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-ink-muted transition hover:text-brand-700"
          title="Copy public link"
        >
          <span className="truncate font-mono">{publicUrl}</span>
          {copied ? <Check className="size-3.5 text-[var(--color-good)]" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
        {active ? "Deactivate" : "Activate"}
      </Button>
    </li>
  );
}

let fieldCounter = 0;

type BuilderField = LeadFormField & { _id: number; optionsText: string };

function slugifyKey(label: string, fallback: number): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `field_${fallback}`;
}

function FormBuilderModal({
  open,
  onClose,
  branches
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState("");
  const [fields, setFields] = useState<BuilderField[]>(() => [
    { _id: ++fieldCounter, key: "name", label: "Full name", type: "text", required: true, optionsText: "" },
    { _id: ++fieldCounter, key: "phone", label: "Phone", type: "phone", required: true, optionsText: "" }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setBranchId("");
    setFields([
      { _id: ++fieldCounter, key: "name", label: "Full name", type: "text", required: true, optionsText: "" },
      { _id: ++fieldCounter, key: "phone", label: "Phone", type: "phone", required: true, optionsText: "" }
    ]);
    setError(null);
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { _id: ++fieldCounter, key: "", label: "", type: "text", required: false, optionsText: "" }
    ]);
  }

  function updateField(id: number, patch: Partial<BuilderField>) {
    setFields((prev) => prev.map((f) => (f._id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: number) {
    setFields((prev) => prev.filter((f) => f._id !== id));
  }

  function submit() {
    if (!title.trim()) return setError("Enter a form title.");
    const cleaned = fields.filter((f) => f.label.trim());
    if (cleaned.length === 0) return setError("Add at least one field with a label.");

    const built: LeadFormField[] = cleaned.map((f, i) => {
      const options = OPTION_FIELD_TYPES.includes(f.type)
        ? f.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;
      return {
        key: f.key.trim() || slugifyKey(f.label, i + 1),
        label: f.label.trim(),
        type: f.type,
        required: f.required || undefined,
        ...(options && options.length > 0 ? { options } : {})
      };
    });

    if (built.some((f) => OPTION_FIELD_TYPES.includes(f.type) && (!f.options || f.options.length === 0))) {
      return setError("Dropdown and checkbox fields need at least one option (comma-separated).");
    }

    setError(null);
    startSaving(async () => {
      const result = await createFormAction({
        title,
        description: description || undefined,
        fields: built,
        branchId: branchId || undefined
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create the form.");
        return;
      }
      reset();
      onClose();
      toast(result.message ?? "Form created.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="form-builder-title" className="max-w-2xl">
      <div className="border-b border-line p-5">
        <h2 id="form-builder-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <FileText className="size-4 text-brand-600" /> New form
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Build a public form to share with camps and capture leads.</p>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
        <Field label="Title" htmlFor="fb-title">
          <Input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Free Eye Camp Registration" />
        </Field>
        <Field label="Description (optional)" htmlFor="fb-desc">
          <Input id="fb-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown above the form" />
        </Field>
        {branches.length > 0 ? (
          <Field label="Branch (optional)" htmlFor="fb-branch">
            <select id="fb-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName}</option>
              ))}
            </select>
          </Field>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink-soft">Fields</p>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="size-3.5" /> Add field
            </Button>
          </div>
          <ul className="space-y-2">
            {fields.map((f) => (
              <li key={f._id} className="rounded-xl border border-line bg-surface-muted p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Label</label>
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(f._id, { label: e.target.value })}
                      placeholder="e.g. Age"
                    />
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">Type</label>
                    <select
                      value={f.type}
                      onChange={(e) => updateField(f._id, { type: e.target.value as LeadFieldType })}
                      className={selectClass}
                    >
                      {LEAD_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex h-10 items-center gap-1.5 text-xs font-medium text-ink-soft">
                    <input
                      type="checkbox"
                      checked={Boolean(f.required)}
                      onChange={(e) => updateField(f._id, { required: e.target.checked })}
                      className="size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(f._id)}
                    className="flex size-10 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)]"
                    aria-label="Remove field"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {OPTION_FIELD_TYPES.includes(f.type) ? (
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-medium text-ink-soft">
                      {f.type === "multiselect" ? "Choices (comma-separated — patients can pick several)" : "Options (comma-separated)"}
                    </label>
                    <Input
                      value={f.optionsText}
                      onChange={(e) => updateField(f._id, { optionsText: e.target.value })}
                      placeholder="e.g. Cataract, Glaucoma, Retina"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          <FileText className="size-3.5" /> {saving ? "Creating…" : "Create form"}
        </Button>
      </div>
    </Modal>
  );
}
