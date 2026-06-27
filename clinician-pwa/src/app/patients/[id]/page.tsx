import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { StageChip } from "@/components/badge";
import { ClinicalHistory } from "@/components/clinical-history";
import { DocumentsPanel } from "@/components/documents-panel";
import { DispositionForm } from "@/components/disposition-form";
import {
  getAppointments,
  getClinical,
  getDocuments,
  getPatient,
  latestAppointment
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [patient, clinical, documents, appointments] = await Promise.all([
    getPatient(id),
    getClinical(id),
    getDocuments(id),
    getAppointments(id)
  ]);

  if (!patient) notFound();

  const appointment = latestAppointment(appointments);
  const meta = [patient.age != null ? `${patient.age}y` : null, patient.gender || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <TopBar backHref="/" />
      <main className="mx-auto max-w-[430px] px-4 pb-20 pt-4">
        <section className="surface-card mb-4 flex items-center gap-3 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-ink">
                {patient.displayName || "Unnamed patient"}
              </h1>
              <StageChip stage={patient.lifecycleStage} />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{meta || "No demographics on file"}</p>
            {patient.primaryPhone ? (
              <p className="text-xs text-ink-muted">{patient.primaryPhone}</p>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <ClinicalHistory patientId={id} clinical={clinical} />
          <DocumentsPanel patientId={id} documents={documents} />
          <DispositionForm patientId={id} appointment={appointment} />
        </div>
      </main>
    </>
  );
}
