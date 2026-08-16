import { Sprout } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { OpdVisitDetail } from "@/components/opd/opd-visit-detail";
import { fetchVisit } from "@/lib/opd-api";
import { fetchPatientDetail } from "@/lib/patients-api";

export const dynamic = "force-dynamic";

/** An OPD visit's own page — the register links here, not to All Patients. */
export default async function OpdVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const result = await fetchVisit(visitId);

  if (!result.ok) {
    return (
      <Panel>
        <EmptyState
          icon={<Sprout className="size-5" />}
          title={result.status === 404 ? "Visit not found" : "Couldn't load the visit"}
          description={result.error ?? "It may have been removed, or the server is unavailable."}
        />
      </Panel>
    );
  }

  const patientResult = await fetchPatientDetail(result.data.patientId);
  return <OpdVisitDetail visit={result.data} patient={patientResult.ok ? patientResult.data : null} />;
}
