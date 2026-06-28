import { ClipboardPlus } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { OpdWorkspace } from "@/components/opd/opd-workspace";
import { fetchConditionCatalog, fetchIntakeDoctors, fetchVisits } from "@/lib/opd-api";
import { todayIsoDate } from "@/lib/opd-types";

export const dynamic = "force-dynamic";

export default async function OpdPage() {
  const today = todayIsoDate();
  const [visitsResult, doctorsResult, catalogResult] = await Promise.all([
    fetchVisits({ date: today }),
    fetchIntakeDoctors(),
    fetchConditionCatalog()
  ]);

  if (!visitsResult.ok) {
    if (visitsResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<ClipboardPlus className="size-5" />}
            title="Your session has expired"
            description="Sign in again to run OPD intake."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<ClipboardPlus className="size-5" />}
          title="Couldn't load the OPD queue"
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
      conditionCatalog={catalogResult.ok ? catalogResult.data : []}
    />
  );
}
