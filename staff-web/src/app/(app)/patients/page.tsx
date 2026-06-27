import { Users } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { PatientsWorkspace } from "@/components/patients/patients-workspace";
import { fetchConditionCatalog, fetchPatientDirectory } from "@/lib/patients-api";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const [directoryResult, catalogResult] = await Promise.all([
    fetchPatientDirectory(),
    fetchConditionCatalog()
  ]);

  if (!directoryResult.ok) {
    if (directoryResult.status === 401) {
      return (
        <Panel>
          <EmptyState
            icon={<Users className="size-5" />}
            title="Your session has expired"
            description="Sign in again to view patients."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Users className="size-5" />}
          title="Couldn't load patients"
          description={directoryResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return (
    <PatientsWorkspace
      directory={directoryResult.data}
      conditionCatalog={catalogResult.ok ? catalogResult.data : []}
    />
  );
}
