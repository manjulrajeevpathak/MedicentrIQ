import { Megaphone } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace";
import { fetchCampaigns, fetchConditionCatalog } from "@/lib/campaigns-api";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaignsResult, conditionsResult] = await Promise.all([
    fetchCampaigns(),
    fetchConditionCatalog()
  ]);

  if (!campaignsResult.ok) {
    if (campaignsResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view campaigns."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="Couldn't load campaigns"
          description={campaignsResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <CampaignsWorkspace
      campaigns={campaignsResult.data}
      conditions={conditionsResult.ok ? conditionsResult.data : []}
    />
  );
}
