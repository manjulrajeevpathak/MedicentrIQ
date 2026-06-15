import { PatientsWorkspace } from "@/components/patients/patients-workspace";

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientsWorkspace selectedId={id} />;
}
