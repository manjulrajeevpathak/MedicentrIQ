import { JourneysLibrary } from "@/components/journeys/journeys-library";
import { getJourneyPacks } from "@/lib/journeys";
import { getDashboard } from "@/lib/data";

export default async function JourneysPage() {
  const [packs, dashboard] = await Promise.all([getJourneyPacks(), getDashboard()]);
  return <JourneysLibrary packs={packs} canManage={dashboard.authContext.activeUser.permissions.includes("journey:manage")} />;
}
