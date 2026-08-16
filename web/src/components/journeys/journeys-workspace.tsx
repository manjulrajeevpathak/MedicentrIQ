"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  MessageCircle,
  Plus,
  Route,
  Send,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import {
  JOURNEY_STATUSES,
  JOURNEY_STATUS_TONE,
  TEMPLATE_STATUS_TONE,
  formatJourneyDateTime,
  journeyStatusLabel,
  type JourneyStep,
  type JourneyTemplate,
  type PatientJourney,
  type PatientJourneyStatus
} from "@/lib/journeys-types";
import type { DirectoryPatient } from "@/lib/patients-types";
import {
  createTemplateAction,
  enrollPatientAction,
  sendJourneyMessageAction,
  setJourneyStatusAction
} from "@/app/staff/(app)/journeys/actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type Tab = "journeys" | "templates";

type Props = {
  templates: JourneyTemplate[];
  journeys: PatientJourney[];
  patients: DirectoryPatient[];
};

export function JourneysWorkspace({ templates, journeys, patients }: Props) {
  const [tab, setTab] = useState<Tab>("journeys");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Route className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Journeys</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Care-continuity protocols — enrol patients and keep them on track.
            </p>
          </div>
        </div>
        <Segmented
          options={[
            { value: "journeys", label: "Patient journeys", count: journeys.length },
            { value: "templates", label: "Templates", count: templates.length }
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "journeys" ? (
        <PatientJourneysTab journeys={journeys} templates={templates} patients={patients} />
      ) : null}
      {tab === "templates" ? <TemplatesTab templates={templates} /> : null}
    </div>
  );
}

// ============================================================================
// Patient journeys tab
// ============================================================================

function PatientJourneysTab({
  journeys,
  templates,
  patients
}: {
  journeys: PatientJourney[];
  templates: JourneyTemplate[];
  patients: DirectoryPatient[];
}) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [messageFor, setMessageFor] = useState<PatientJourney | null>(null);

  const templateName = (id: string) => templates.find((t) => t.id === id)?.name;

  return (
    <Panel padded={false}>
      <div className="flex items-center justify-between border-b border-line p-4">
        <SectionTitle
          icon={<Users className="size-4" />}
          title="Patient journeys"
          subtitle={`${journeys.length} enrolled`}
        />
        <Button size="sm" onClick={() => setEnrollOpen(true)}>
          <UserPlus className="size-3.5" /> Enroll patient
        </Button>
      </div>

      {journeys.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No patients enrolled"
          description="Enroll a patient into a journey template to begin tracking their care."
        />
      ) : (
        <ul className="divide-y divide-line">
          {journeys.map((journey) => (
            <JourneyRow
              key={journey.id}
              journey={journey}
              templateName={journey.templateName ?? templateName(journey.templateId)}
              onMessage={() => setMessageFor(journey)}
            />
          ))}
        </ul>
      )}

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        templates={templates}
        patients={patients}
      />
      <MessageModal journey={messageFor} onClose={() => setMessageFor(null)} />
    </Panel>
  );
}

function JourneyRow({
  journey,
  templateName,
  onMessage
}: {
  journey: PatientJourney;
  templateName?: string;
  onMessage: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const changeStatus = (status: PatientJourneyStatus) => {
    if (status === journey.status) return;
    startTransition(async () => {
      const result = await setJourneyStatusAction(journey.id, status);
      if (!result.ok) {
        toast(result.error ?? "Could not update the journey.", "error");
        return;
      }
      toast(result.message ?? "Journey updated.", "success");
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={journey.patientName ?? "Patient"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {journey.patientName ?? "Unknown patient"}
        </p>
        <p className="truncate text-[11px] text-ink-muted">{templateName ?? "Journey"}</p>
      </div>
      <Badge tone={JOURNEY_STATUS_TONE[journey.status] ?? "neutral"} dot>
        {journeyStatusLabel(journey.status)}
      </Badge>
      <select
        className={`${selectClass} h-8 w-auto text-xs`}
        value={journey.status}
        disabled={pending}
        onChange={(e) => changeStatus(e.target.value as PatientJourneyStatus)}
        aria-label="Change journey status"
      >
        {JOURNEY_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" onClick={onMessage}>
        <Send className="size-3.5" /> Send update
      </Button>
    </li>
  );
}

function EnrollModal({
  open,
  onClose,
  templates,
  patients
}: {
  open: boolean;
  onClose: () => void;
  templates: JourneyTemplate[];
  patients: DirectoryPatient[];
}) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saving, startSaving] = useTransition();

  const submit = () => {
    startSaving(async () => {
      const result = await enrollPatientAction({ patientId, templateId });
      if (!result.ok) {
        toast(result.error ?? "Could not enroll the patient.", "error");
        return;
      }
      toast(result.message ?? "Patient enrolled.", "success");
      setPatientId("");
      setTemplateId("");
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="enroll-title" className="max-w-sm">
      <div className="border-b border-line p-5">
        <h2 id="enroll-title" className="text-base font-semibold tracking-tight text-ink">
          Enroll patient
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Add a patient to a journey template.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Patient" htmlFor="enroll-patient">
          <select
            id="enroll-patient"
            className={selectClass}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Select a patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.primaryPhone ? ` · ${p.primaryPhone}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Journey template" htmlFor="enroll-template">
          <select
            id="enroll-template"
            className={selectClass}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        {patients.length === 0 ? (
          <p className="text-[11px] text-ink-muted">No patients yet — add patients first.</p>
        ) : null}
        {templates.length === 0 ? (
          <p className="text-[11px] text-ink-muted">No templates yet — create one first.</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={saving || !patientId || !templateId}>
          <UserPlus className="size-3.5" /> Enroll
        </Button>
      </div>
    </Modal>
  );
}

function MessageModal({
  journey,
  onClose
}: {
  journey: PatientJourney | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, startSending] = useTransition();

  const submit = () => {
    if (!journey) return;
    startSending(async () => {
      const result = await sendJourneyMessageAction(journey.id, body);
      if (!result.ok) {
        toast(result.error ?? "Could not send the message.", "error");
        return;
      }
      toast(result.message ?? "Update sent.", "success");
      setBody("");
      onClose();
    });
  };

  return (
    <Modal open={!!journey} onClose={onClose} labelledBy="message-title" className="max-w-sm">
      <div className="border-b border-line p-5">
        <h2 id="message-title" className="text-base font-semibold tracking-tight text-ink">
          Send update
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          WhatsApp {journey?.patientName ?? "the patient"} and log a journey event.
        </p>
      </div>
      <div className="p-5">
        <Field label="Message" htmlFor="message-body">
          <textarea
            id="message-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type the message you want to send…"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={sending || !body.trim()}>
          <MessageCircle className="size-3.5" /> Send
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Templates tab
// ============================================================================

function TemplatesTab({ templates }: { templates: JourneyTemplate[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel padded={false}>
        <div className="border-b border-line p-4">
          <SectionTitle
            icon={<Route className="size-4" />}
            title="Journey templates"
            subtitle={`${templates.length} template${templates.length === 1 ? "" : "s"}`}
          />
        </div>
        {templates.length === 0 ? (
          <EmptyState
            icon={<Route className="size-5" />}
            title="No templates yet"
            description="Create a journey template to start enrolling patients."
          />
        ) : (
          <ul className="divide-y divide-line">
            {templates.map((template) => (
              <li key={template.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{template.name}</p>
                  <Badge tone={TEMPLATE_STATUS_TONE[template.status] ?? "neutral"} dot>
                    {template.status}
                  </Badge>
                </div>
                {template.description ? (
                  <p className="mt-0.5 text-xs text-ink-soft">{template.description}</p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  {template.steps?.length ?? 0} step{(template.steps?.length ?? 0) === 1 ? "" : "s"}
                  {template.createdAt ? ` · added ${formatJourneyDateTime(template.createdAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CreateTemplateForm />
    </div>
  );
}

function CreateTemplateForm() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<JourneyStep[]>([{ label: "" }]);
  const [saving, startSaving] = useTransition();

  const setStepLabel = (index: number, label: string) =>
    setSteps((current) => current.map((s, i) => (i === index ? { ...s, label } : s)));
  const addStep = () => setSteps((current) => [...current, { label: "" }]);
  const removeStep = (index: number) =>
    setSteps((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));

  const submit = () => {
    startSaving(async () => {
      const result = await createTemplateAction({
        name,
        description: description || undefined,
        steps
      });
      if (!result.ok) {
        toast(result.error ?? "Could not create the template.", "error");
        return;
      }
      toast(result.message ?? "Template created.", "success");
      setName("");
      setDescription("");
      setSteps([{ label: "" }]);
    });
  };

  return (
    <Panel>
      <SectionTitle
        icon={<Plus className="size-4" />}
        title="New template"
        subtitle="Define the journey and its steps"
      />
      <div className="mt-4 space-y-4">
        <Field label="Name" htmlFor="template-name">
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cataract post-op"
          />
        </Field>
        <Field label="Description" htmlFor="template-description" hint="Optional">
          <Input
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this journey covers"
          />
        </Field>
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-soft">Steps</p>
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                {index + 1}
              </span>
              <Input
                value={step.label}
                onChange={(e) => setStepLabel(index, e.target.value)}
                placeholder="Step label"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeStep(index)}
                disabled={steps.length === 1}
                aria-label="Remove step"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="size-3.5" /> Add step
          </Button>
        </div>
        <Button
          className="w-full"
          onClick={submit}
          disabled={saving || !name.trim() || !steps.some((s) => s.label.trim())}
        >
          <CheckCircle2 className="size-3.5" /> Create template
        </Button>
      </div>
    </Panel>
  );
}
