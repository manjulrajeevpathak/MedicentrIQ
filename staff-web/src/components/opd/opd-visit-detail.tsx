"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Phone, Stethoscope } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ClinicalObservationsForm } from "@/components/opd/clinical-observations-form";
import { getDocumentUrlAction } from "@/app/(app)/opd/actions";
import {
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONE,
  formatDateTime,
  type Visit
} from "@/lib/opd-types";
import type { PatientDetail } from "@/lib/patients-types";

/**
 * The OPD visit's OWN page — everything about this encounter in one place
 * (the register links here; the full Patient 360 is a secondary link, not the
 * default destination).
 */
export function OpdVisitDetail({ visit, patient }: { visit: Visit; patient: PatientDetail | null }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  const clinical = visit.clinical;
  const meta = [
    patient?.age != null ? `${patient.age}y` : null,
    patient?.gender && patient.gender !== "unknown" ? patient.gender : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/opd"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> OPD register
        </Link>
        <Link
          href={`/patients/${visit.patientId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
        >
          Patient 360 <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* Visit header */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-ink">
                {visit.patientName ?? patient?.displayName ?? "Walk-in patient"}
              </h1>
              <Badge tone={VISIT_STATUS_TONE[visit.status] ?? "neutral"} dot>
                {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
              {meta ? <span>{meta}</span> : null}
              {patient?.primaryPhone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {patient.primaryPhone}
                </span>
              ) : null}
              <span>· Registered {formatDateTime(visit.registeredAt ?? visit.createdAt)}</span>
              {visit.doctorName || visit.department ? (
                <span>· {[visit.doctorName, visit.department].filter(Boolean).join(" — ")}</span>
              ) : null}
            </p>
          </div>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            {visit.status === "completed" ? (
              <>
                <FileText className="size-3.5" /> View / edit observations
              </>
            ) : (
              <>
                <Stethoscope className="size-3.5" /> Clinical observations
              </>
            )}
          </Button>
        </div>
      </Panel>

      {/* Vitals (when captured at registration) */}
      {visit.vitals && Object.values(visit.vitals).some((v) => v !== undefined && v !== "") ? (
        <Panel>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Vitals at registration</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            {Object.entries(visit.vitals)
              .filter(([, v]) => v !== undefined && v !== "")
              .map(([k, v]) => (
                <span key={k}>
                  <span className="text-ink-faint">{vitalsLabel(k)}:</span> {String(v)}
                </span>
              ))}
          </div>
        </Panel>
      ) : null}

      {/* Clinical observations */}
      <Panel>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Clinical observations</h2>
        {clinical || visit.chiefComplaint ? (
          <dl className="space-y-3">
            <ObservationRow label="Chief Complaints" value={clinical?.chiefComplaints ?? visit.chiefComplaint} />
            <ObservationRow label="Pre-existing Diseases" value={clinical?.preExistingDiseases} />
            <ObservationRow label="Diagnosis" value={clinical?.diagnosisText} />
            <ObservationRow label="Advise — Pharmacy" value={clinical?.advisePharmacy} />
            <ObservationRow label="Advise — Diagnostics" value={clinical?.adviseDiagnostics} />
            <ObservationRow label="Advise — Procedure / Admission" value={clinical?.adviseProcedureAdmission} />
            <ObservationRow
              label="Revisit Advised"
              value={
                clinical?.revisitAdvised
                  ? `Yes${clinical.revisitDate ? ` — ${clinical.revisitDate}` : ""}`
                  : clinical
                    ? "No"
                    : undefined
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">
            Not captured yet — fill the clinical observations to complete this visit.
          </p>
        )}
      </Panel>

      {/* Prescriptions */}
      <Panel>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Prescriptions {clinical?.prescriptionDocumentIds?.length ? `(${clinical.prescriptionDocumentIds.length})` : ""}
        </h2>
        {clinical?.prescriptionDocumentIds?.length ? (
          <ul className="space-y-1.5">
            {clinical.prescriptionDocumentIds.map((docId, index) => (
              <li key={docId}>
                <PrescriptionLink documentId={docId} label={`Prescription ${index + 1}`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No prescription uploaded for this visit.</p>
        )}
      </Panel>

      {formOpen ? (
        <ClinicalObservationsForm
          key={visit.id}
          visit={visit}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            // Server component re-renders with the updated visit.
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ObservationRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={value ? "mt-0.5 text-sm text-ink" : "mt-0.5 text-sm italic text-ink-faint"}>
        {value || "—"}
      </dd>
    </div>
  );
}

function PrescriptionLink({ documentId, label }: { documentId: string; label: string }) {
  const { toast } = useToast();
  const [opening, startOpening] = useTransition();
  return (
    <button
      type="button"
      disabled={opening}
      onClick={() =>
        startOpening(async () => {
          const result = await getDocumentUrlAction(documentId);
          if (!result.ok || !result.data?.url) {
            toast(result.error ?? "Could not open the prescription.", "error");
            return;
          }
          window.open(result.data.url, "_blank", "noopener");
        })
      }
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline disabled:opacity-60"
    >
      <FileText className="size-3.5" /> {label} {opening ? "…" : ""}
    </button>
  );
}

function vitalsLabel(key: string): string {
  const labels: Record<string, string> = {
    bp: "BP",
    pulseBpm: "Pulse",
    spo2: "SpO₂",
    tempC: "Temp °C",
    weightKg: "Weight kg",
    visualAcuityRight: "VA (R)",
    visualAcuityLeft: "VA (L)",
    iopRight: "IOP (R)",
    iopLeft: "IOP (L)"
  };
  return labels[key] ?? key;
}
