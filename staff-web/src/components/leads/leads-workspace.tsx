"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
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
  FORM_STATUS_TONE,
  FUNNEL_STAGE_ORDER,
  LEAD_FIELD_TYPES,
  LEAD_SOURCES,
  LEAD_STAGES,
  OPTION_FIELD_TYPES,
  formatLeadDate,
  leadSourceLabel,
  leadStageLabel,
  type Lead,
  type LeadFieldType,
  type LeadForm,
  type LeadFormField,
  type LeadFunnel
} from "@/lib/leads-types";
import {
  convertLeadAction,
  createFormAction,
  createLeadAction,
  importLeadsAction,
  setFormStatusAction,
  updateLeadAction
} from "@/app/(app)/leads/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Tab = "funnel" | "leads" | "import" | "forms";

type Props = {
  leads: Lead[];
  funnel: LeadFunnel;
  forms: LeadForm[];
  branches: Branch[];
  origin: string;
};

export function LeadsWorkspace({ leads, funnel, forms, branches, origin }: Props) {
  const [tab, setTab] = useState<Tab>("funnel");

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
              Camp, web-form and referral leads — convert them into patients.
            </p>
          </div>
        </div>
        <Segmented
          options={[
            { value: "funnel", label: "Funnel" },
            { value: "leads", label: "Leads", count: leads.length },
            { value: "import", label: "Import" },
            { value: "forms", label: "Forms", count: forms.length }
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "funnel" ? <FunnelTab funnel={funnel} total={leads.length} /> : null}
      {tab === "leads" ? <LeadsTab leads={leads} branches={branches} /> : null}
      {tab === "import" ? <ImportTab /> : null}
      {tab === "forms" ? <FormsTab forms={forms} branches={branches} origin={origin} /> : null}
    </div>
  );
}

// ============================================================================
// Funnel tab
// ============================================================================

function FunnelTab({ funnel, total }: { funnel: LeadFunnel; total: number }) {
  const stageCounts = FUNNEL_STAGE_ORDER.map((stage) => ({
    stage,
    count: funnel.byStage[stage] ?? 0
  }));
  const lost = funnel.byStage["lost"] ?? 0;
  const max = Math.max(1, ...stageCounts.map((s) => s.count), lost);
  const allZero = total === 0 && stageCounts.every((s) => s.count === 0) && lost === 0;

  const sources = Object.entries(funnel.bySource)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const sourceMax = Math.max(1, ...sources.map(([, n]) => n));

  if (allZero) {
    return (
      <Panel>
        <EmptyState
          icon={<Sprout className="size-5" />}
          title="No leads yet"
          description="As camps, web forms and referrals come in, your funnel will fill in here."
        />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <Panel>
        <SectionTitle icon={<Filter className="size-4" />} title="Lead funnel" subtitle="New → contacted → qualified → converted" />
        <div className="mt-4 space-y-3">
          {stageCounts.map(({ stage, count }) => (
            <div key={stage}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-ink-soft">{leadStageLabel(stage)}</span>
                <span className="font-semibold tabular-nums text-ink">{count}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-lg bg-fill">
                <div
                  className="flex h-full items-center rounded-lg bg-brand-500 transition-all duration-500"
                  style={{ width: `${Math.max(count > 0 ? 8 : 0, (count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {lost > 0 ? (
            <div className="border-t border-line pt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-ink-soft">Lost</span>
                <span className="font-semibold tabular-nums text-ink">{lost}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-lg bg-fill">
                <div
                  className="h-full rounded-lg bg-[var(--color-critical)] transition-all duration-500"
                  style={{ width: `${Math.max(8, (lost / max) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={<Sprout className="size-4" />} title="By source" subtitle="Where leads come from" />
        {sources.length === 0 ? (
          <p className="mt-4 text-xs text-ink-muted">No source data yet.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {sources.map(([source, n]) => (
              <li key={source}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-soft">{leadSourceLabel(source)}</span>
                  <span className="font-semibold tabular-nums text-ink">{n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fill">
                  <div
                    className="h-full rounded-full bg-brand-400 transition-all duration-500"
                    style={{ width: `${(n / sourceMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ============================================================================
// Leads list tab
// ============================================================================

function LeadsTab({ leads, branches }: { leads: Lead[]; branches: Branch[] }) {
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
              {LEAD_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={cn(selectClass, "h-9 w-auto")}>
              <option value="">All sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
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
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </ul>
        )}
      </Panel>

      <NewLeadModal open={composerOpen} onClose={() => setComposerOpen(false)} branches={branches} />
    </>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const router = useRouter();
  const { toast } = useToast();
  const [stage, setStage] = useState(lead.stage);
  const [pending, startTransition] = useTransition();
  const converted = lead.stage === "converted" || Boolean(lead.convertedPatientId);

  function changeStage(next: string) {
    setStage(next);
    startTransition(async () => {
      const result = await updateLeadAction(lead.id, { stage: next });
      if (!result.ok) {
        setStage(lead.stage);
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

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{lead.name}</span>
          <Badge tone="neutral">{leadSourceLabel(lead.source)}</Badge>
          {lead.matchedPatientId && !converted ? (
            <Badge tone="violet" dot>Matches a patient</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {[lead.phone, lead.email, lead.sourceDetail].filter(Boolean).join(" · ") || "No contact details"}
          {" · "}
          {formatLeadDate(lead.createdAt)}
        </p>
      </div>

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
              value={stage}
              onChange={(e) => changeStage(e.target.value)}
              disabled={pending}
              aria-label={`Stage for ${lead.name}`}
              className={cn(selectClass, "h-9 w-auto")}
            >
              {LEAD_STAGES.filter((s) => s.value !== "converted").map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
              {stage === "converted" ? <option value="converted">Converted</option> : null}
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
  branches
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<string>("camp");
  const [sourceDetail, setSourceDetail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setSource("camp");
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
        source,
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
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
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
    ["Name", "Phone", "Email", "Source", "Notes"],
    ["Ramesh Kumar", "+919812345678", "ramesh@example.com", "camp", "Met at eye camp"]
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Leads");
  XLSX.writeFile(wb, "healthcareos-leads-template.xlsx");
}

function ImportTab() {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [source, setSource] = useState<string>("import");
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
            placeholder={"name,phone,email\nRamesh Kumar,+919812345678,ramesh@example.com"}
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
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
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
