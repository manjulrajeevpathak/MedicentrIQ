import { coreApi } from "./users-api";
import type { ApiResult } from "./users-types";
import type { BillingPatient, BillingSummary, Invoice, InvoiceStatus } from "./billing-types";

/**
 * Server-only fetch helpers for the Billing surface. Each reuses the
 * session-bearing `coreApi` wrapper and unwraps the `{data}` envelope.
 * Client-safe types live in ./billing-types; server actions in
 * src/app/(app)/billing/actions.ts.
 */

export type { ApiResult } from "./users-types";

export async function fetchBillingSummary(): Promise<ApiResult<BillingSummary>> {
  return coreApi<BillingSummary>("/billing/summary");
}

export async function fetchInvoices(
  filter?: { patientId?: string; status?: InvoiceStatus }
): Promise<ApiResult<Invoice[]>> {
  const params = new URLSearchParams();
  if (filter?.patientId) params.set("patientId", filter.patientId);
  if (filter?.status) params.set("status", filter.status);
  const qs = params.toString();
  return coreApi<Invoice[]>(`/invoices${qs ? `?${qs}` : ""}`);
}

export async function fetchPatientInvoices(
  id: string
): Promise<ApiResult<{ invoices: Invoice[]; summary: { billed: number; settled: number; outstanding: number } }>> {
  return coreApi(`/patients/${encodeURIComponent(id)}/invoices`);
}

export async function fetchBillingPatients(): Promise<ApiResult<BillingPatient[]>> {
  return coreApi<BillingPatient[]>("/patients");
}
