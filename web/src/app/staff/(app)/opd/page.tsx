import { ClipboardList } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { OpdWorkspace } from "@/components/opd/opd-workspace";
import { fetchIntakeDoctors, fetchVisits } from "@/lib/opd-api";
import { todayIsoDate } from "@/lib/opd-types";

export const dynamic = "force-dynamic";

export default async function OpdPage() {
  // The register lands on today's visits; the workspace refetches client-side
  // as the user widens the date range or filters by doctor.
  const today = todayIsoDate();
  const [visitsResult, doctorsResult] = await Promise.all([
    fetchVisits({ date: today }),
    fetchIntakeDoctors()
  ]);

  if (!visitsResult.ok) {
    if (visitsResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="Your session has expired"
            description="Sign in again to open the OPD register."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="Couldn't load the OPD register"
          description={visitsResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <OpdWorkspace
      today={today}
      visits={visitsResult.data}
      doctors={doctorsResult.ok ? doctorsResult.data : []}
    />
  );
}
