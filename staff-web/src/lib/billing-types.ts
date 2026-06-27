/**
 * Client-safe types + label/tone constants for the Billing surface. No
 * server-only imports (next/headers) so client components can import these
 * freely. Mirrors core-api's invoice + payment contracts (served under the
 * `{data}` envelope with a Bearer session). Amounts are INR integers — rupees,
 * not paise — formatted with `formatInr` from ./format.
 */

export type InvoiceStatus = "unpaid" | "partial" | "paid";

export type InvoiceItem = {
  description: string;
  amount: number;
};

export type PaymentMethod = "cash" | "card" | "upi" | "other";

export type InvoicePayment = {
  amount: number;
  method?: string;
  at: string;
  note?: string;
};

export type Invoice = {
  id: string;
  patientId: string;
  patientName?: string;
  total: number;
  amountSettled: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  createdAt: string;
};

export type BillingSummary = {
  billed: number;
  settled: number;
  outstanding: number;
  unpaidCount: number;
};

/** Lightweight patient row for the invoice patient picker + name resolution. */
export type BillingPatient = {
  id: string;
  displayName: string;
  primaryPhone?: string;
};

// ---- Presentation ----------------------------------------------------------

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid"
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, "high" | "medium" | "good"> = {
  unpaid: "high",
  partial: "medium",
  paid: "good"
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" }
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  other: "Other"
};

export function paymentMethodLabel(method?: string): string {
  if (!method) return "Payment";
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Outstanding for a single invoice (never negative). */
export function invoiceOutstanding(invoice: Invoice): number {
  return Math.max(0, invoice.total - invoice.amountSettled);
}

export function formatBillingDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatBillingDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
