import { Receipt } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { fetchBillingPatients, fetchBillingSummary, fetchInvoices } from "@/lib/billing-api";
import type { BillingSummary } from "@/lib/billing-types";

export const dynamic = "force-dynamic";

const EMPTY_SUMMARY: BillingSummary = { billed: 0, settled: 0, outstanding: 0, unpaidCount: 0 };

export default async function BillingPage() {
  const [summaryResult, invoicesResult, patientsResult] = await Promise.all([
    fetchBillingSummary(),
    fetchInvoices(),
    fetchBillingPatients()
  ]);

  // The invoices feed is the primary signal; gate the whole screen on it.
  if (!invoicesResult.ok) {
    if (invoicesResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view billing."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Receipt className="size-5" />}
          title="Couldn't load billing"
          description={invoicesResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <BillingWorkspace
      summary={summaryResult.ok ? summaryResult.data : EMPTY_SUMMARY}
      invoices={invoicesResult.data}
      patients={patientsResult.ok ? patientsResult.data : []}
    />
  );
}
