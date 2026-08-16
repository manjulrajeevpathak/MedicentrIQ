"use server";

import { revalidatePath } from "next/cache";
import { coreApi } from "@/lib/users-api";
import type { Invoice, InvoiceItem } from "@/lib/billing-types";

/**
 * Billing server actions. Each reads the session bearer (via `coreApi`), calls
 * core-api with the `{data}`/`{error.message}` envelope, then revalidates the
 * /billing route so the server-rendered view reflects changes. Invoice totals
 * and payment status are computed server-side; over-payments return a 400 whose
 * message we surface to the caller.
 */

export type ActionState<T = unknown> = {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ---- Create invoice --------------------------------------------------------

export async function createInvoiceAction(input: {
  patientId: string;
  appointmentId?: string;
  items: InvoiceItem[];
}): Promise<ActionState<Invoice>> {
  if (!input.patientId) return { ok: false, error: "Choose a patient." };

  const items = input.items
    .map((item) => ({ description: item.description.trim(), amount: Math.round(Number(item.amount)) }))
    .filter((item) => item.description && Number.isFinite(item.amount) && item.amount > 0);

  if (items.length === 0) return { ok: false, error: "Add at least one line item with an amount." };

  const result = await coreApi<Invoice>("/invoices", {
    method: "POST",
    body: {
      patientId: input.patientId,
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
      items
    }
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not create the invoice." };
  revalidatePath("/billing");
  return { ok: true, data: result.data, message: "Invoice created." };
}

// ---- Record payment --------------------------------------------------------

export async function recordPaymentAction(
  invoiceId: string,
  input: { amount: number; method?: string; note?: string }
): Promise<ActionState<Invoice>> {
  if (!invoiceId) return { ok: false, error: "Missing invoice." };

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a payment amount." };

  const result = await coreApi<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: "POST",
    body: {
      amount,
      ...(input.method ? { method: input.method } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {})
    }
  });
  // Surface the 400 overpay message (e.g. "Payment exceeds the outstanding balance").
  if (!result.ok) return { ok: false, error: result.error ?? "Could not record the payment." };
  revalidatePath("/billing");
  return { ok: true, data: result.data, message: "Payment recorded." };
}
