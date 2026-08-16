"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileText,
  FileUp,
  Lock,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Stethoscope
} from "lucide-react";
import type { AppointmentSlot, PatientLinkState, UploadedReport } from "@care/lib/types";
import {
  confirmAppointment,
  fetchAppointmentSlots,
  formatDate,
  formatTime,
  rescheduleAppointment,
  uploadReport
} from "@care/lib/core-api";
import { cn } from "@care/lib/utils";
import { LogoMark } from "./logo";

type Toast = { id: number; tone: "success" | "error"; message: string };
let toastSeq = 0;

export function PatientJourney({ token, initial }: { token: string; initial: PatientLinkState }) {
  const [appointment, setAppointment] = useState(initial.appointment);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const allowed = initial.secureLink.allowedActions;
  const canConfirm = allowed.includes("confirm_appointment");
  const canReschedule = allowed.includes("reschedule_request");
  const canUpload = allowed.includes("upload_document_metadata");

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    toastSeq += 1;
    const id = toastSeq;
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3600);
  }, []);

  if (initial.linkStatus !== "active") {
    return <InactiveLink state={initial} />;
  }

  const firstName = initial.patient.displayName.split(/\s+/)[0];
  const awaitingConfirmation = appointment.status === "scheduled" || appointment.status === "rescheduled";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-28 pt-5">
      {/* Trust header */}
      <header className="flex items-center gap-3">
        <LogoMark size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">{initial.provider.name}</p>
          <p className="truncate text-xs text-ink-muted">{initial.provider.branch}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-good-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-good)]">
          <Lock className="size-3" /> Secure
        </span>
      </header>

      <main className="stagger mt-5 flex-1 space-y-4">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {initial.greeting.vernacular}, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Review your appointment below and confirm when you&rsquo;re ready.</p>
        </div>

        {/* Appointment card */}
        <AppointmentCard
          appointment={appointment}
          successNote={successNote}
          canConfirm={canConfirm}
          canReschedule={canReschedule}
          awaitingConfirmation={awaitingConfirmation}
          onConfirm={async () => {
            const result = await confirmAppointment(token, appointment.id);
            if (result.ok) {
              setAppointment((a) => ({ ...a, status: "confirmed" }));
              setSuccessNote("Your appointment is confirmed. See you then!");
              toast("Appointment confirmed.");
            } else {
              toast(result.message, "error");
            }
            return result.ok;
          }}
          loadSlots={(date) => fetchAppointmentSlots(token, appointment.id, date)}
          onPickSlot={async (slot) => {
            const result = await rescheduleAppointment(token, appointment.id, slot.start);
            if (result.ok) {
              setAppointment((a) => ({
                ...a,
                status: "rescheduled",
                scheduledAt: slot.start,
                displayDate: formatDate(slot.start),
                displayTime: formatTime(slot.start)
              }));
              setSuccessNote(`Your appointment is rescheduled to ${formatDate(slot.start)} at ${formatTime(slot.start)}.`);
              toast("Appointment rescheduled.");
            } else {
              toast(result.message, "error");
            }
            return result.ok;
          }}
        />

        {/* Reports card */}
        <ReportsCard
          reports={reports}
          canUpload={canUpload}
          onUpload={async (fileName) => {
            const report: UploadedReport = { fileName, documentType: "lab_report" };
            const result = await uploadReport(token, appointment.id, report);
            if (result.ok) {
              setReports((current) => [...current, report]);
              toast("Report uploaded.");
            } else {
              toast(result.message, "error");
            }
          }}
        />
      </main>

      {/* Help footer */}
      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">Need help right now?</p>
            <p className="text-[11px] text-ink-muted">
              {initial.provider.supportPhone ? `Care team · ${initial.provider.supportPhone}` : "Contact your care team"}
            </p>
          </div>
          {initial.provider.supportPhone ? (
            <a
              href={`tel:${initial.provider.supportPhone.replace(/\s/g, "")}`}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              <Phone className="size-4" /> Call
            </a>
          ) : null}
        </div>
      </footer>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-in pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border bg-surface p-3 text-sm shadow-pop",
              t.tone === "success" ? "border-[var(--color-good)]/30" : "border-[var(--color-critical)]/30"
            )}
            role="status"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-[var(--color-good)]" />
            ) : (
              <CircleAlert className="size-4 shrink-0 text-[var(--color-critical)]" />
            )}
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ appointment ------------------------------ */

function AppointmentCard({
  appointment,
  successNote,
  canConfirm,
  canReschedule,
  awaitingConfirmation,
  onConfirm,
  loadSlots,
  onPickSlot
}: {
  appointment: PatientLinkState["appointment"];
  successNote: string | null;
  canConfirm: boolean;
  canReschedule: boolean;
  awaitingConfirmation: boolean;
  onConfirm: () => Promise<boolean>;
  loadSlots: (date: string) => Promise<AppointmentSlot[]>;
  onPickSlot: (slot: AppointmentSlot) => Promise<boolean>;
}) {
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(appointment.scheduledAt.slice(0, 10));
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const openPicker = useCallback(async () => {
    setPicking(true);
    setLoadingSlots(true);
    const next = await loadSlots(date);
    setSlots(next);
    setLoadingSlots(false);
  }, [date, loadSlots]);

  const onDateChange = useCallback(
    async (value: string) => {
      setDate(value);
      setLoadingSlots(true);
      const next = await loadSlots(value);
      setSlots(next);
      setLoadingSlots(false);
    },
    [loadSlots]
  );

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-line bg-surface-muted px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          <Calendar className="size-3.5" /> Your appointment
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">{appointment.displayDate}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-base text-ink-soft">
              <Clock className="size-4 text-ink-faint" /> {appointment.displayTime}
            </p>
          </div>
          <StatusChip status={appointment.status} />
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
          <p className="flex items-center gap-2">
            <Stethoscope className="size-4 shrink-0 text-ink-faint" /> {appointment.doctorName} · {appointment.department}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-faint" />
            <span>
              {appointment.branchName}
              {appointment.address ? <span className="block text-xs text-ink-muted">{appointment.address}</span> : null}
            </span>
          </p>
          {appointment.mapUrl ? (
            <a
              href={appointment.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Navigation className="size-4" /> Directions
            </a>
          ) : null}
        </div>

        {successNote ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-good)]">
            <CheckCircle2 className="size-4 shrink-0" /> {successNote}
          </p>
        ) : appointment.status === "confirmed" ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-good)]">
            <CheckCircle2 className="size-4 shrink-0" /> Confirmed — see you then.
          </p>
        ) : null}

        {/* Actions */}
        {awaitingConfirmation && !successNote ? (
          <div className="mt-4 flex flex-col gap-2">
            {canConfirm ? (
              <BigButton onClick={onConfirm}>
                <CheckCircle2 className="size-4" /> Confirm this slot
              </BigButton>
            ) : null}
            {canReschedule && !picking ? (
              <BigButton variant="outline" onClick={openPicker}>
                Choose another time
              </BigButton>
            ) : null}
          </div>
        ) : null}

        {/* Slot picker */}
        {picking && !successNote ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Pick a date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => onDateChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            {loadingSlots ? (
              <p className="py-2 text-center text-sm text-ink-muted">Loading open times…</p>
            ) : slots.length === 0 ? (
              <p className="py-2 text-center text-sm text-ink-muted">No open times that day — try another date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <SlotButton key={slot.start} slot={slot} onPick={() => onPickSlot(slot)} />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SlotButton({ slot, onPick }: { slot: AppointmentSlot; onPick: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onPick();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "…" : formatTime(slot.start)}
    </button>
  );
}

/* -------------------------------- reports -------------------------------- */

function ReportsCard({
  reports,
  canUpload,
  onUpload
}: {
  reports: UploadedReport[];
  canUpload: boolean;
  onUpload: (fileName: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="surface-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <FileUp className="size-4 text-brand-600" /> Diagnostic reports
      </p>
      <p className="mt-1 text-xs text-ink-muted">Upload lab results or scans so your doctor can review them ahead of the visit.</p>

      {reports.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {reports.map((report, index) => (
            <li
              key={`${report.fileName}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <FileText className="size-4 shrink-0 text-ink-faint" />
                <span className="truncate">{report.fileName}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-good-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-good)]">
                <CheckCircle2 className="size-3" /> Uploaded
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await onUpload(file.name);
          } finally {
            setBusy(false);
          }
        }}
      />
      <BigButton
        className="mt-3"
        variant="outline"
        disabled={!canUpload || busy}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="size-4" /> {busy ? "Uploading…" : "Upload a diagnostic report"}
      </BigButton>
      {!canUpload ? <p className="mt-2 text-xs text-ink-muted">Report uploads are not enabled on this link.</p> : null}
    </section>
  );
}

/* ----------------------------- building blocks --------------------------- */

function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<unknown>;
  variant?: "primary" | "outline";
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={disabled || busy}
      onClick={async () => {
        if (!onClick) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "outline" && "border border-line-strong bg-surface text-ink-soft hover:bg-surface-muted",
        className
      )}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}

function StatusChip({ status }: { status: PatientLinkState["appointment"]["status"] }) {
  const config = {
    scheduled: { label: "Awaiting confirmation", className: "bg-[var(--color-high-soft)] text-[var(--color-high)]" },
    confirmed: { label: "Confirmed", className: "bg-[var(--color-good-soft)] text-[var(--color-good)]" },
    rescheduled: { label: "Rescheduled", className: "bg-brand-50 text-brand-700" }
  }[status];
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", config.className)}>{config.label}</span>;
}

function InactiveLink({ state }: { state: PatientLinkState }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <LogoMark size={44} />
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {state.linkStatus === "expired" ? "This link has expired" : "This link is no longer active"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        For your safety, care links stop working after some time. Please call the care team and they will send a fresh
        link right away.
      </p>
      {state.provider.supportPhone ? (
        <a
          href={`tel:${state.provider.supportPhone.replace(/\s/g, "")}`}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          <Phone className="size-4" /> Call {state.provider.supportPhone}
        </a>
      ) : null}
      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-ink-faint">
        <ShieldCheck className="size-3.5" /> {state.provider.name} · secured by HealthFlow
      </p>
    </div>
  );
}
