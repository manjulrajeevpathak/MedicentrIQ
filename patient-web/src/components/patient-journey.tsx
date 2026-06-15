"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  FileUp,
  HandHeart,
  HeartPulse,
  ListChecks,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Stethoscope
} from "lucide-react";
import type { ChecklistItem, ConsentState, DocumentRequest, PatientLinkState, SubmitActionPayload } from "@/lib/types";
import { submitPatientAction } from "@/lib/core-api";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";

type Toast = { id: number; tone: "success" | "error"; message: string };
let toastSeq = 0;

export function PatientJourney({ token, initial }: { token: string; initial: PatientLinkState }) {
  const [appointmentStatus, setAppointmentStatus] = useState(initial.appointment.status);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial.checklist);
  const [documents, setDocuments] = useState<DocumentRequest[]>(initial.documents);
  const [followUpStatus, setFollowUpStatus] = useState(initial.followUp.status);
  const [consent, setConsent] = useState<ConsentState>(initial.consent);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    toastSeq += 1;
    const id = toastSeq;
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3200);
  }, []);

  const submit = useCallback(
    async (payload: SubmitActionPayload, successMessage: string) => {
      const result = await submitPatientAction(token, payload);
      toast(result.ok ? successMessage : result.message, result.ok ? "success" : "error");
      return result.ok;
    },
    [token, toast]
  );

  const allowed = useMemo(() => new Set(initial.secureLink.allowedActions), [initial.secureLink.allowedActions]);

  const steps = useMemo(() => {
    const requiredDone = checklist.filter((item) => item.required).every((item) => item.completed);
    return [
      { label: "Confirm", done: appointmentStatus === "confirmed" },
      { label: "Prepare", done: requiredDone },
      { label: "Documents", done: documents.some((doc) => doc.status === "uploaded") },
      { label: "Recovery", done: followUpStatus !== "pending" }
    ];
  }, [appointmentStatus, checklist, documents, followUpStatus]);

  if (initial.linkStatus !== "active") {
    return <InactiveLink state={initial} />;
  }

  const firstName = initial.patient.displayName.split(/\s+/)[0];

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
        {/* Caregiver banner */}
        {initial.caregiver.actingForPatient ? (
          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5">
            <HandHeart className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="text-sm leading-snug text-ink-soft">
              <span className="font-semibold text-ink">{initial.caregiver.displayName}</span>, you are managing this visit for{" "}
              <span className="font-semibold text-ink">{initial.patient.displayName}</span> as her {initial.caregiver.relationship} — consent{" "}
              {initial.caregiver.consentStatus}.
            </p>
          </div>
        ) : null}

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {initial.greeting.vernacular}, {initial.caregiver.actingForPatient ? initial.caregiver.displayName.split(/\s+/)[0] : firstName}.
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {firstName}&rsquo;s next steps after surgery — three small things, two minutes.
          </p>
        </div>

        {/* Progress */}
        <ol className="flex items-center gap-1.5">
          {steps.map((step, index) => (
            <li key={step.label} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                  step.done ? "bg-[var(--color-good)] text-white" : "bg-fill text-ink-muted"
                )}
              >
                {step.done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={cn("text-[10px]", step.done ? "font-semibold text-ink" : "text-ink-muted")}>{step.label}</span>
            </li>
          ))}
        </ol>

        {/* Appointment hero */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-line bg-surface-muted px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <Calendar className="size-3.5" /> Review appointment
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-tight text-ink">{initial.appointment.displayDate}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-ink-soft">
                  <Clock className="size-4 text-ink-faint" /> {initial.appointment.displayTime}
                </p>
              </div>
              <StatusChip status={appointmentStatus} />
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
              <p className="flex items-center gap-2">
                <Stethoscope className="size-4 shrink-0 text-ink-faint" /> {initial.appointment.doctorName} · {initial.appointment.department}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-ink-faint" /> {initial.appointment.location}
              </p>
            </div>

            {appointmentStatus === "pending_confirmation" ? (
              <>
                <p className="mt-3 rounded-xl bg-[var(--color-high-soft)] px-3 py-2 text-xs text-ink-soft">{initial.appointment.statusCopy}</p>
                {rescheduling ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={rescheduleReason}
                      onChange={(event) => setRescheduleReason(event.target.value)}
                      rows={2}
                      placeholder="Tell us what time works better…"
                      className="w-full resize-none rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                    <div className="flex gap-2">
                      <BigButton
                        onClick={async () => {
                          const ok = await submit(
                            { type: "request_reschedule", appointmentId: initial.appointment.id, reason: rescheduleReason || "Caregiver requested a different slot." },
                            "Request sent — the care team will call with options."
                          );
                          if (ok) {
                            setAppointmentStatus("reschedule_requested");
                            setRescheduling(false);
                          }
                        }}
                      >
                        Send request
                      </BigButton>
                      <BigButton variant="outline" onClick={() => setRescheduling(false)}>
                        Cancel
                      </BigButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-2">
                    {allowed.has("confirm_appointment") ? (
                      <BigButton
                        onClick={async () => {
                          const ok = await submit(
                            { type: "confirm_appointment", appointmentId: initial.appointment.id },
                            "Appointment confirmed. See you Saturday!"
                          );
                          if (ok) setAppointmentStatus("confirmed");
                        }}
                      >
                        <CheckCircle2 className="size-4" /> Confirm this slot
                      </BigButton>
                    ) : null}
                    {allowed.has("reschedule_request") ? (
                      <BigButton variant="outline" onClick={() => setRescheduling(true)}>
                        Request a different time
                      </BigButton>
                    ) : null}
                  </div>
                )}
              </>
            ) : appointmentStatus === "confirmed" ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-good)]">
                <CheckCircle2 className="size-4 shrink-0" /> Confirmed — keep the checklist below ready.
              </p>
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-high-soft)] px-3 py-2.5 text-sm text-ink-soft">
                <AlarmClock className="size-4 shrink-0 text-[var(--color-high)]" /> The care team has your request and will call with the next available slot.
              </p>
            )}
          </div>
        </section>

        {/* Recovery check (follow-up) */}
        <section className="surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <HeartPulse className="size-4 text-[var(--color-critical)]" /> {initial.followUp.title}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--color-high)]">{initial.followUp.dueLabel}</p>
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{initial.followUp.instructions}</p>

          {followUpStatus === "pending" && allowed.has("confirm_follow_up") ? (
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <BigButton
                onClick={async () => {
                  const ok = await submit(
                    { type: "confirm_follow_up", followUpId: initial.followUp.id, status: "confirmed" },
                    "Glad to hear it — recovery noted."
                  );
                  if (ok) setFollowUpStatus("confirmed");
                }}
              >
                All good
              </BigButton>
              <BigButton
                variant="danger"
                onClick={async () => {
                  const ok = await submit(
                    { type: "confirm_follow_up", followUpId: initial.followUp.id, status: "needs_callback" },
                    "Our nurse will call you within 15 minutes."
                  );
                  if (ok) setFollowUpStatus("needs_callback");
                }}
              >
                I need a call
              </BigButton>
            </div>
          ) : followUpStatus === "confirmed" ? (
            <p className="mt-3.5 flex items-center gap-2 rounded-xl bg-[var(--color-good-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-good)]">
              <CheckCircle2 className="size-4 shrink-0" /> Recovery noted — thank you.
            </p>
          ) : (
            <p className="mt-3.5 flex items-center gap-2 rounded-xl bg-[var(--color-critical-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-critical)]">
              <Phone className="size-4 shrink-0" /> A nurse will call {initial.patient.maskedPhone} shortly.
            </p>
          )}

          <ul className="mt-3.5 space-y-1.5 border-t border-line pt-3">
            {initial.followUp.nextSteps.map((step) => (
              <li key={step} className="flex gap-2 text-xs text-ink-muted">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-faint" />
                {step}
              </li>
            ))}
          </ul>
        </section>

        {/* Checklist */}
        <section className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ListChecks className="size-4 text-brand-600" /> Before the visit
          </p>
          <ul className="mt-3 space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  className="flex w-full items-start gap-3 text-left"
                  onClick={async () => {
                    const next = !item.completed;
                    setChecklist((current) => current.map((c) => (c.id === item.id ? { ...c, completed: next } : c)));
                    const ok = await submit({ type: "update_checklist", itemId: item.id, completed: next }, next ? "Checked off." : "Unchecked.");
                    if (!ok) setChecklist((current) => current.map((c) => (c.id === item.id ? { ...c, completed: !next } : c)));
                  }}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition",
                      item.completed ? "border-[var(--color-good)] bg-[var(--color-good)] text-white" : "border-line-strong bg-surface"
                    )}
                  >
                    {item.completed ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", item.completed ? "text-ink-muted line-through" : "text-ink")}>
                      {item.title}
                      {item.required ? <span className="ml-1.5 text-[10px] font-semibold uppercase text-[var(--color-high)]">required</span> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{item.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Documents */}
        <section className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <FileUp className="size-4 text-brand-600" /> Add documents
          </p>
          <ul className="mt-3 space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{doc.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{doc.note}</p>
                </div>
                {doc.status === "uploaded" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-good-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-good)]">
                    <Check className="size-3" /> Added
                  </span>
                ) : (
                  <BigButton
                    size="sm"
                    variant="outline"
                    disabled={!allowed.has("upload_document_metadata") || !consent.documentSharing}
                    onClick={async () => {
                      const ok = await submit(
                        {
                          type: "mark_document_uploaded",
                          documentId: doc.id,
                          appointmentId: initial.appointment.id,
                          documentType: doc.id,
                          fileName: `${doc.id}.jpg`,
                          mimeType: "image/jpeg",
                          sizeBytes: 480000
                        },
                        "Document noted — bring the original along too."
                      );
                      if (ok) setDocuments((current) => current.map((d) => (d.id === doc.id ? { ...d, status: "uploaded" } : d)));
                    }}
                  >
                    Add
                  </BigButton>
                )}
              </li>
            ))}
          </ul>
          {!consent.documentSharing ? (
            <p className="mt-2 text-xs text-ink-muted">Turn on document sharing below to add files.</p>
          ) : null}
        </section>

        {/* Preferences */}
        <section className="surface-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ShieldCheck className="size-4 text-brand-600" /> Messages & privacy
          </p>
          <div className="mt-3 space-y-3">
            <ConsentRow
              icon={<MessageCircle className="size-4" />}
              label="WhatsApp updates"
              note="Reminders and reports on WhatsApp"
              checked={consent.whatsApp}
              disabled={!allowed.has("update_consent")}
              onChange={async (enabled) => {
                setConsent((c) => ({ ...c, whatsApp: enabled }));
                const ok = await submit({ type: "update_consent", channel: "whatsapp", enabled }, enabled ? "WhatsApp updates on." : "WhatsApp updates off.");
                if (!ok) setConsent((c) => ({ ...c, whatsApp: !enabled }));
              }}
            />
            <ConsentRow
              icon={<Phone className="size-4" />}
              label="Phone calls"
              note="Calls from the care team when needed"
              checked={consent.calls}
              disabled={!allowed.has("update_consent")}
              onChange={async (enabled) => {
                setConsent((c) => ({ ...c, calls: enabled }));
                const ok = await submit({ type: "update_consent", channel: "calls", enabled }, enabled ? "Calls on." : "Calls off.");
                if (!ok) setConsent((c) => ({ ...c, calls: !enabled }));
              }}
            />
            <ConsentRow
              icon={<FileUp className="size-4" />}
              label="Document sharing"
              note="Allow sharing reports with the clinic"
              checked={consent.documentSharing}
              disabled={!allowed.has("update_consent")}
              onChange={async (enabled) => {
                setConsent((c) => ({ ...c, documentSharing: enabled }));
                const ok = await submit({ type: "update_consent", channel: "documents", enabled }, enabled ? "Document sharing on." : "Document sharing off.");
                if (!ok) setConsent((c) => ({ ...c, documentSharing: !enabled }));
              }}
            />
          </div>
          {allowed.has("opt_out") && !consent.optedOut ? (
            <button
              className="mt-3.5 text-xs font-medium text-ink-muted underline-offset-2 hover:underline"
              onClick={async () => {
                const ok = await submit({ type: "opt_out" }, "You will only receive essential care messages now.");
                if (ok) setConsent((c) => ({ ...c, optedOut: true, whatsApp: false }));
              }}
            >
              Stop all non-care messages
            </button>
          ) : consent.optedOut ? (
            <p className="mt-3.5 text-xs text-ink-muted">You receive essential care messages only.</p>
          ) : null}
        </section>

        {/* Link details */}
        <LinkDetails state={initial} />
      </main>

      {/* Help footer */}
      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">Need help right now?</p>
            <p className="text-[11px] text-ink-muted">Care team · {initial.provider.supportPhone}</p>
          </div>
          <a
            href={`tel:${initial.provider.supportPhone.replace(/\s/g, "")}`}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Phone className="size-4" /> Call
          </a>
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

/* ----------------------------- building blocks --------------------------- */

function BigButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "danger";
  size?: "md" | "sm";
  disabled?: boolean;
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
        "inline-flex flex-1 items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-12 px-4 text-sm" : "h-9 px-3 text-xs",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "outline" && "border border-line-strong bg-surface text-ink-soft hover:bg-surface-muted",
        variant === "danger" && "bg-[var(--color-critical)] text-white shadow-sm hover:brightness-95"
      )}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}

function StatusChip({ status }: { status: PatientLinkState["appointment"]["status"] }) {
  const config = {
    pending_confirmation: { label: "Awaiting confirmation", className: "bg-[var(--color-high-soft)] text-[var(--color-high)]" },
    confirmed: { label: "Confirmed", className: "bg-[var(--color-good-soft)] text-[var(--color-good)]" },
    reschedule_requested: { label: "Reschedule requested", className: "bg-brand-50 text-brand-700" },
    expired: { label: "Expired", className: "bg-[var(--color-critical-soft)] text-[var(--color-critical)]" }
  }[status];
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", config.className)}>{config.label}</span>;
}

function ConsentRow({
  icon,
  label,
  note,
  checked,
  disabled,
  onChange
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{note}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-brand-600" : "bg-fill-strong"
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
}

function LinkDetails({ state }: { state: PatientLinkState }) {
  const [open, setOpen] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState("");

  useEffect(() => {
    const expires = new Date(state.secureLink.expiresAt);
    if (!Number.isNaN(expires.getTime())) {
      const days = Math.max(0, Math.round((expires.getTime() - Date.now()) / 86_400_000));
      setExpiryLabel(days <= 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`);
    }
  }, [state.secureLink.expiresAt]);

  return (
    <section className="surface-card overflow-hidden">
      <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <Lock className="size-4 text-ink-faint" /> About this secure link
        </span>
        <ChevronDown className={cn("size-4 text-ink-faint transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-ink-muted">
          <p>
            {state.secureLink.securityLabel} · link {state.secureLink.tokenPreview}
            {expiryLabel ? <> · expires {expiryLabel}</> : null}
          </p>
          <p>
            Shared with {state.caregiver.displayName} for {state.patient.displayName} ({state.patient.ageLabel}, prefers{" "}
            {state.patient.preferredLanguage}). Phone on record {state.patient.maskedPhone}.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {state.secureLink.allowedActions.map((action) => (
              <span key={action} className="rounded-md bg-fill px-1.5 py-0.5 font-mono text-[10px]">
                {action.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
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
      <a
        href={`tel:${state.provider.supportPhone.replace(/\s/g, "")}`}
        className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
      >
        <Phone className="size-4" /> Call {state.provider.supportPhone}
      </a>
      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-ink-faint">
        <ShieldCheck className="size-3.5" /> {state.provider.name} · secured by HealthcareOS
      </p>
    </div>
  );
}
