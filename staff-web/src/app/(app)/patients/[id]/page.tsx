import { Users } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { PatientsWorkspace } from "@/components/patients/patients-workspace";
import {
  fetchConditionCatalog,
  fetchPatientClinical,
  fetchPatientDetail,
  fetchPatientDirectory,
  fetchPatientDocuments,
  fetchPatientTimeline,
  fetchPatientVisits
} from "@/lib/patients-api";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [directoryResult, catalogResult, detailResult] = await Promise.all([
    fetchPatientDirectory(),
    fetchConditionCatalog(),
    fetchPatientDetail(id)
  ]);

  if (!directoryResult.ok && directoryResult.status === 401) {
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

  const directory = directoryResult.ok ? directoryResult.data : [];
  const conditionCatalog = catalogResult.ok ? catalogResult.data : [];

  if (!detailResult.ok) {
    return (
      <PatientsWorkspace
        directory={directory}
        conditionCatalog={conditionCatalog}
        selectedId={id}
        notFound
      />
    );
  }

  // Seed the rest of the Patient 360 bundle. The client refetches on mutations.
  const [clinicalResult, documentsResult, visitsResult, timelineResult] = await Promise.all([
    fetchPatientClinical(id),
    fetchPatientDocuments(id),
    fetchPatientVisits(id),
    fetchPatientTimeline(id)
  ]);

  return (
    <PatientsWorkspace
      directory={directory}
      conditionCatalog={conditionCatalog}
      selectedId={id}
      detail={detailResult.data}
      clinical={clinicalResult.ok ? clinicalResult.data : { conditions: [], allergies: [] }}
      documents={documentsResult.ok ? documentsResult.data : []}
      visits={visitsResult.ok ? visitsResult.data : []}
      timeline={timelineResult.ok ? timelineResult.data : []}
    />
  );
}
