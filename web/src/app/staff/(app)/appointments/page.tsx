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

  // Seed ALL appointments (across doctors and dates). The view panel is
  // independent of the booking form, so staff see every booking without having
  // to guess a date; the booking form still defaults to the first active doctor.
  const firstDoctor = doctors.find((d) => d.status === "active") ?? doctors[0];
  const initialAppointmentsResult = await fetchAppointments({});
  const initialAppointments = initialAppointmentsResult.ok ? initialAppointmentsResult.data : [];

  return (
    <AccessWorkspace
      doctors={doctors}
      patients={patients}
      branches={branches}
      today={today}
      initialDoctorId={firstDoctor?.id ?? ""}
      initialAppointments={initialAppointments}
    />
  );
}
