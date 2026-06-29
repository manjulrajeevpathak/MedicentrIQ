import { Megaphone } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace";
import { fetchCampaigns, fetchConditionCatalog } from "@/lib/campaigns-api";
import { fetchTemplates } from "@/lib/comms-api";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaignsResult, conditionsResult, templates] = await Promise.all([
    fetchCampaigns(),
    fetchConditionCatalog(),
    fetchTemplates()
  ]);

  // Reusable free-text templates from the Templates library, offered as a campaign body.
  const templateOptions = templates
    .filter((t) => t.status === "active" && t.kind === "text" && !!t.body)
    .map((t) => ({ id: t.id, name: t.name, body: t.body as string }));

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
      templates={templateOptions}
    />
  );
}
