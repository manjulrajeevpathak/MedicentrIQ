import { Stethoscope } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { DoctorsWorkspace } from "@/components/doctors/doctors-workspace";
import { fetchDoctors, fetchMe } from "@/lib/scheduling-api";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const [doctorsResult, me] = await Promise.all([fetchDoctors(), fetchMe()]);

  if (!doctorsResult.ok && doctorsResult.status === 401) {
    return (
      <Panel>
        <EmptyState
          icon={<Stethoscope className="size-5" />}
          title="Your session has expired"
          description="Sign in again to manage doctors."
        />
      </Panel>
    );
  }

  const canManageDoctors = me.permissions.includes("doctors:manage");
  if (!canManageDoctors) {
    return (
      <Panel>
        <EmptyState
          icon={<Stethoscope className="size-5" />}
          title="No access to doctor management"
          description="You don't have permission to manage doctors for this tenant."
        />
      </Panel>
    );
  }

  const doctors = doctorsResult.ok ? doctorsResult.data : [];
  const branches = me.branches;

  return <DoctorsWorkspace doctors={doctors} branches={branches} />;
}
