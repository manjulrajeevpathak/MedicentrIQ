import { CalendarClock } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AccessWorkspace } from "@/components/access/access-workspace";
import {
  fetchAppointments,
  fetchDoctors,
  fetchMe,
  fetchPatients
} from "@/lib/scheduling-api";
import { todayIsoDate } from "@/lib/scheduling-types";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const today = todayIsoDate();

  const [doctorsResult, patientsResult, me] = await Promise.all([
    fetchDoctors(),
    fetchPatients(),
    fetchMe()
  ]);

  if (!doctorsResult.ok && doctorsResult.status === 401) {
    return (
      <Panel>
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="Your session has expired"
          description="Sign in again to manage appointments."
        />
      </Panel>
    );
  }

  const doctors = doctorsResult.ok ? doctorsResult.data : [];
  const patients = patientsResult.ok ? patientsResult.data : [];
  const branches = me.branches;
  const canManageDoctors = me.permissions.includes("doctors:manage");

  // Seed the day's appointments for the first active doctor (the default
  // selection on the client). The client refetches when the selection changes.
  const firstDoctor = doctors.find((d) => d.status === "active") ?? doctors[0];
  const initialAppointmentsResult = firstDoctor
    ? await fetchAppointments({ doctorId: firstDoctor.id, date: today })
    : null;
  const initialAppointments = initialAppointmentsResult?.ok ? initialAppointmentsResult.data : [];

  return (
    <AccessWorkspace
      doctors={doctors}
      patients={patients}
      branches={branches}
      today={today}
      initialDoctorId={firstDoctor?.id ?? ""}
      initialAppointments={initialAppointments}
      canManageDoctors={canManageDoctors}
    />
  );
}
