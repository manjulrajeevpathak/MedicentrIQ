import { TopBar } from "@clinician/components/top-bar";
import { PatientSearch } from "@clinician/components/patient-search";
import { listPatients } from "@clinician/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const patients = await listPatients();

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[430px] px-4 pb-16 pt-4">
        <h1 className="mb-3 text-lg font-semibold text-ink">Patients</h1>
        <PatientSearch patients={patients} />
      </main>
    </>
  );
}
