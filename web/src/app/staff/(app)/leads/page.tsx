import { headers } from "next/headers";
import { Sprout } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";
import { fetchBranches, fetchIsTenantAdmin } from "@/lib/users-api";
import {
  fetchForms,
  fetchLeadConfig,
  fetchLeadFunnel,
  fetchLeadSheetConfig,
  fetchLeads
} from "@/lib/leads-api";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [
    leadsResult,
    funnelResult,
    formsResult,
    branches,
    leadConfig,
    sheetConfig,
    isAdmin,
    headerList
  ] = await Promise.all([
    fetchLeads(),
    fetchLeadFunnel(),
    fetchForms(),
    fetchBranches(),
    fetchLeadConfig(),
    fetchLeadSheetConfig(),
    fetchIsTenantAdmin(),
    headers()
  ]);

  if (!leadsResult.ok) {
    if (leadsResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Sprout className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view leads."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Sprout className="size-5" />}
          title="Couldn't load leads"
          description={leadsResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  // Build the public form origin from the incoming request (works behind proxies).
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3200";
  const origin = `${proto}://${host}`;

  return (
    <LeadsWorkspace
      leads={leadsResult.data}
      funnel={funnelResult.ok ? funnelResult.data : { byStage: {}, bySource: {} }}
      forms={formsResult.ok ? formsResult.data : []}
      branches={branches}
      sources={leadConfig.sources}
      stages={leadConfig.stages}
      sheetConfig={sheetConfig}
      isAdmin={isAdmin}
      origin={origin}
    />
  );
}
