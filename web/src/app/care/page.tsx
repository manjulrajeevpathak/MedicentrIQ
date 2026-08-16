import { loadPatientLink } from "@care/lib/core-api";
import { PatientJourney } from "@care/components/patient-journey";

export default async function PatientLinkPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || "mls_demo_anita";
  const state = await loadPatientLink(token);

  return <PatientJourney token={token} initial={state} />;
}
