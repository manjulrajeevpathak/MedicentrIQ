"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  CreditCard,
  IndianRupee,
  Plus,
  Receipt,
  Trash2,
  Wallet
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/format";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  PAYMENT_METHODS,
  formatBillingDate,
  formatBillingDateTime,
  invoiceOutstanding,
  paymentMethodLabel,
  type BillingPatient,
  type BillingSummary,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod
} from "@/lib/billing-types";
import { createInvoiceAction, recordPaymentAction } from "@/app/(app)/billing/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type StatusFilter = "all" | InvoiceStatus;

type Props = {
  summary: BillingSummary;
  invoices: Invoice[];
  patients: BillingPatient[];
};

export function BillingWorkspace({ summary, invoices, patients }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);

  // Resolve patient names locally so rows show a name even when core-api
  // returns only patientId on the invoice.
  const patientName = useMemo(() => {
    const map = new Map(patients.map((p) => [p.id, p.displayName]));
    return (invoice: Invoice) => invoice.patientName ?? map.get(invoice.patientId) ?? "Unknown patient";
  }, [patients]);

  const counts = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        acc.all += 1;
        acc[inv.status] += 1;
        return acc;
      },
      { all: 0, unpaid: 0, partial: 0, paid: 0 } as Record<StatusFilter, number>
    );
  }, [invoices]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? invoices : invoices.filter((inv) => inv.status === statusFilter)),
    [invoices, statusFilter]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Receipt className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Billing</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Invoices and payments — billed vs settled across your patients.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setComposerOpen(true)}>
          <Plus className="size-3.5" /> New invoice
        </Button>
      </div>

      <StatGrid cols={4}>
        <StatTile label="Billed" value={formatInr(summary.billed)} icon={<IndianRupee className="size-4" />} tone="brand" />
        <StatTile label="Settled" value={formatInr(summary.settled)} icon={<Wallet className="size-4" />} tone="good" />
        <StatTile label="Outstanding" value={formatInr(summary.outstanding)} icon={<Receipt className="size-4" />} tone="high" />
        <StatTile label="Unpaid invoices" value={summary.unpaidCount} icon={<CreditCard className="size-4" />} tone="neutral" />
      </StatGrid>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SectionTitle
            icon={<Receipt className="size-4" />}
            title="Invoices"
            subtitle={`${filtered.length} of ${invoices.length}`}
          />
          <Segmented
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "unpaid", label: "Unpaid", count: counts.unpaid },
              { value: "partial", label: "Partial", count: counts.partial },
              { value: "paid", label: "Paid", count: counts.paid }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No invoices yet"
            description="Create your first invoice for a patient to start tracking billing and payments."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No matching invoices"
            description="No invoices match the current status filter."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} patientName={patientName(invoice)} />
            ))}
          </ul>
        )}
      </Panel>

      <NewInvoiceModal open={composerOpen} onClose={() => setComposerOpen(false)} patients={patients} />
    </div>
  );
}

// ============================================================================
// Invoice row (expandable: line items + payment history + record payment)
// ============================================================================

function InvoiceRow({ invoice, patientName }: { invoice: Invoice; patientName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const outstanding = invoiceOutstanding(invoice);

  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn("size-4 shrink-0 text-ink-faint transition-transform", expanded && "rotate-180")}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">{patientName}</span>
              <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot>
                {INVOICE_STATUS_LABELS[invoice.status]}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {formatInr(invoice.total)} total · {formatInr(invoice.amountSettled)} settled ·{" "}
              <span className="font-medium text-ink-soft">{formatInr(outstanding)} outstanding</span>
              {" · "}
              {formatBillingDate(invoice.createdAt)}
            </p>
          </div>
        </button>
        {invoice.status !== "paid" ? (
          <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
            <Wallet className="size-3.5" /> Record payment
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="grid grid-cols-1 gap-4 border-t border-line bg-surface-muted px-4 py-3.5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Line items</p>
            <ul className="space-y-1">
              {invoice.items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-ink-soft">{item.description}</span>
                  <span className="shrink-0 tabular-nums text-ink">{formatInr(item.amount)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1 text-xs font-semibold">
                <span className="text-ink-soft">Total</span>
                <span className="tabular-nums text-ink">{formatInr(invoice.total)}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Payments</p>
            {invoice.payments.length === 0 ? (
              <p className="text-xs text-ink-muted">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {invoice.payments.map((p, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-ink-soft">
                      {paymentMethodLabel(p.method)}
                      {p.note ? <span className="text-ink-muted"> · {p.note}</span> : null}
                      <span className="text-ink-muted"> · {formatBillingDateTime(p.at)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--color-good)]">{formatInr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <RecordPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        invoice={invoice}
        patientName={patientName}
      />
    </li>
  );
}

// ============================================================================
// New invoice modal
// ============================================================================

let lineCounter = 0;
type LineRow = { _id: number; description: string; amount: string };

function makeLine(): LineRow {
  return { _id: ++lineCounter, description: "", amount: "" };
}

function NewInvoiceModal({
  open,
  onClose,
  patients
}: {
  open: boolean;
  onClose: () => void;
  patients: BillingPatient[];
}) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState("");
  const [lines, setLines] = useState<LineRow[]>(() => [makeLine()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.amount) > 0 ? Math.round(Number(l.amount)) : 0), 0),
    [lines]
  );

  function reset() {
    setPatientId("");
    setLines([makeLine()]);
    setError(null);
  }

  function addLine() {
    setLines((prev) => [...prev, makeLine()]);
  }

  function updateLine(id: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l._id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l._id !== id)));
  }

  function submit() {
    if (!patientId) return setError("Choose a patient.");
    const items = lines
      .map((l) => ({ description: l.description.trim(), amount: Math.round(Number(l.amount)) }))
      .filter((l) => l.description && Number.isFinite(l.amount) && l.amount > 0);
    if (items.length === 0) return setError("Add at least one line item with a description and amount.");

    setError(null);
    startSaving(async () => {
      const result = await createInvoiceAction({ patientId, items });
      if (!result.ok) {
        setError(result.error ?? "Could not create the invoice.");
        return;
      }
      reset();
      onClose();
      toast(result.message ?? "Invoice created.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-invoice-title" className="max-w-xl">
      <div className="border-b border-line p-5">
        <h2 id="new-invoice-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Receipt className="size-4 text-brand-600" /> New invoice
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Bill a patient — add line items, the total is computed for you.</p>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
        <Field label="Patient" htmlFor="ni-patient">
          {patients.length === 0 ? (
            <p className="text-xs text-ink-muted">No patients available to bill yet.</p>
          ) : (
            <select id="ni-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={selectClass}>
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                  {p.primaryPhone ? ` · ${p.primaryPhone}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink-soft">Line items</p>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="size-3.5" /> Add item
            </Button>
          </div>
          <ul className="space-y-2">
            {lines.map((line) => (
              <li key={line._id} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-ink-soft">Description</label>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line._id, { description: e.target.value })}
                    placeholder="e.g. Consultation"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-[11px] font-medium text-ink-soft">Amount (₹)</label>
                  <Input
                    value={line.amount}
                    onChange={(e) => updateLine(line._id, { amount: e.target.value.replace(/[^0-9]/g, "") })}
                    inputMode="numeric"
                    placeholder="0"
                    className="tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line._id)}
                  disabled={lines.length === 1}
                  className="flex size-10 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-[var(--color-critical)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
                  aria-label="Remove line item"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3.5 py-2.5">
          <span className="text-xs font-medium text-ink-soft">Total</span>
          <span className="text-base font-semibold tabular-nums text-ink">{formatInr(total)}</span>
        </div>

        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          <Receipt className="size-3.5" /> {saving ? "Creating…" : "Create invoice"}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Record payment modal
// ============================================================================

function RecordPaymentModal({
  open,
  onClose,
  invoice,
  patientName
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  patientName: string;
}) {
  const { toast } = useToast();
  const outstanding = invoiceOutstanding(invoice);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function reset() {
    setAmount("");
    setMethod("cash");
    setNote("");
    setError(null);
  }

  function submit() {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a payment amount.");
    setError(null);
    startSaving(async () => {
      const result = await recordPaymentAction(invoice.id, { amount: value, method, note: note || undefined });
      if (!result.ok) {
        // Surface the core-api 400 overpay message verbatim.
        setError(result.error ?? "Could not record the payment.");
        return;
      }
      reset();
      onClose();
      toast(result.message ?? "Payment recorded.", "success");
    });
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="record-payment-title" className="max-w-md">
      <div className="border-b border-line p-5">
        <h2 id="record-payment-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <Wallet className="size-4 text-brand-600" /> Record payment
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          {patientName} · {formatInr(outstanding)} outstanding of {formatInr(invoice.total)}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" htmlFor="rp-amount">
            <Input
              id="rp-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field label="Method" htmlFor="rp-method">
            <select id="rp-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={selectClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
        </div>
        {outstanding > 0 ? (
          <button
            type="button"
            onClick={() => setAmount(String(outstanding))}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Pay full outstanding ({formatInr(outstanding)})
          </button>
        ) : null}
        <Field label="Note (optional)" htmlFor="rp-note">
          <Input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Receipt #1234" />
        </Field>
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          <Wallet className="size-3.5" /> {saving ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </Modal>
  );
}
