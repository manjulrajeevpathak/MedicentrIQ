import { Route } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { JourneysWorkspace } from "@/components/journeys/journeys-workspace";
import { fetchJourneyTemplates, fetchPatientJourneys } from "@/lib/journeys-api";
import { fetchPatientDirectory } from "@/lib/patients-api";

export const dynamic = "force-dynamic";

export default async function JourneysPage() {
  const [templatesResult, journeysResult, patientsResult] = await Promise.all([
    fetchJourneyTemplates(),
    fetchPatientJourneys(),
    fetchPatientDirectory()
  ]);

  if (!templatesResult.ok) {
    if (templatesResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Route className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view journeys."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Route className="size-5" />}
          title="Couldn't load journeys"
          description={templatesResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <JourneysWorkspace
      templates={templatesResult.data}
      journeys={journeysResult.ok ? journeysResult.data : []}
      patients={patientsResult.ok ? patientsResult.data : []}
    />
  );
}
