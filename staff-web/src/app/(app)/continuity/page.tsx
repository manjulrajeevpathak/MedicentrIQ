import { Activity } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ContinuityWorkspace } from "@/components/continuity/continuity-workspace";
import { fetchFollowUps } from "@/lib/continuity-api";
import { fetchPatientDirectory } from "@/lib/patients-api";

export const dynamic = "force-dynamic";

export default async function ContinuityPage() {
  const [followUpsResult, patientsResult] = await Promise.all([
    fetchFollowUps(),
    fetchPatientDirectory()
  ]);

  if (!followUpsResult.ok) {
    if (followUpsResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Activity className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view follow-ups."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Activity className="size-5" />}
          title="Couldn't load follow-ups"
          description={followUpsResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <ContinuityWorkspace
      followUps={followUpsResult.data}
      patients={patientsResult.ok ? patientsResult.data : []}
    />
  );
}
