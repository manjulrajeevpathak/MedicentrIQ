import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace";
import { getCampaigns } from "@/lib/campaigns";
import { getDashboard } from "@/lib/data";

export default async function CampaignsPage() {
  const [data, dashboard] = await Promise.all([getCampaigns(), getDashboard()]);
  return <CampaignsWorkspace data={data} canSend={dashboard.authContext.activeUser.permissions.includes("campaign:send")} />;
}
