"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  Home,
  MessageSquare,
  Phone,
  Search,
  ShieldQuestion,
  Sparkles,
  Stethoscope,
  UserPlus,
  Users
} from "lucide-react";
import type { DirectoryPatient, HouseholdContext, PermissionKey, PatientSummary, QueuePriority, TimelineItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, type NewPatientInput } from "@/lib/store";
import { submitStaffAction } from "@/lib/core-api";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/common/action-button";

export function PatientsWorkspace({ selectedId: routeId }: { selectedId?: string }) {
  const { data, addPatient } = useApp();
  const { toast } = useToast();
  const router = useRouter();
  const { activeUser } = data.authContext;
  const canView = activeUser.permissions.includes("patient360:view" as PermissionKey);
  const canCreate = activeUser.permissions.includes("patients:create" as PermissionKey);

  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const handleCreatePatient = async (input: NewPatientInput) => {
    const result = await submitStaffAction(
      { id: activeUser.id },
      { type: "create_patient", name: input.name, age: input.age, gender: input.gender, phone: input.phone, language: input.language, condition: input.condition }
    );
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    const id = addPatient(input);
    toast("Patient added.", "success");
    setComposerOpen(false);
    router.push(`/patients/${id}`);
  };
  const selectedId = routeId ?? data.directory[0]?.id ?? "";
  const hasSelection = Boolean(routeId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.directory;
    return data.directory.filter(
      (p) => p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q) || p.phone.includes(q) || p.condition.toLowerCase().includes(q)
    );
  }, [data.directory, query]);

  const selected = data.directory.find((p) => p.id === selectedId) ?? data.directory[0];
  const profile = selected ? data.patientProfiles[selected.id] : undefined;

  if (!canView) {
    return (
      <Panel>
        <EmptyState icon={<ShieldQuestion className="size-5" />} title="Patient 360 restricted" description="Your role does not include the patient360:view permission. Ask an admin to grant access." />
      </Panel>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* Directory */}
      <Panel padded={false} className={cn("flex max-h-[calc(100dvh-7.5rem)] flex-col", hasSelection && "hidden lg:flex")}>
        <div className="border-b border-line p-4">
          <SectionTitle
            icon={<Users className="size-4" />}
            title="Patient directory"
            subtitle={`${data.directory.length} records · this branch`}
            action={
              <Button size="sm" onClick={() => setComposerOpen(true)} disabled={!canCreate} title={!canCreate ? "patients:create permission required." : undefined}>
                <UserPlus className="size-3.5" /> Add patient
              </Button>
            }
          />
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
            <Search className="size-4 text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, UHID, phone, condition…"
              aria-label="Search patients"
              className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {filtered.map((patient) => (
            <li key={patient.id}>
              <Link
                href={`/patients/${patient.id}`}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  patient.id === selected?.id ? "bg-brand-50" : "hover:bg-surface-muted"
                )}
              >
                <Avatar name={patient.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{patient.name}</span>
                    <PriorityBadge priority={patient.risk} />
                  </div>
                  <p className="truncate text-xs text-ink-muted">
                    {patient.condition} · {patient.uhid}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-faint">{patient.lastSeen}</span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? <EmptyState icon={<Search className="size-5" />} title="No matches" description={`Nothing for “${query}”.`} /> : null}
        </ul>
      </Panel>

      {/* Patient 360 */}
      {selected && profile ? (
        <div className={cn("space-y-5", !hasSelection && "hidden lg:block")}>
          <button onClick={() => router.push("/patients")} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden">
            <ArrowLeft className="size-4" /> Directory
          </button>
          <PatientHeader patient={selected} profile={profile} userId={activeUser.id} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <IdentityPanel userId={activeUser.id} candidates={data.matchCandidates} />
            {profile.household ? <HouseholdPanel household={profile.household} /> : <ProfilePanel patient={selected} />}
          </div>
          <TimelinePanel timeline={profile.timeline} />
        </div>
      ) : (
        <Panel>
          <EmptyState icon={<Users className="size-5" />} title="Select a patient" />
        </Panel>
      )}
    </div>
    <AddPatientModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreate={handleCreatePatient} branchName={data.authContext.branch.name} />
    </>
  );
}

function PatientHeader({ patient, profile, userId }: { patient: DirectoryPatient; profile: PatientSummary; userId: string }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={patient.name} size="lg" className="size-14 text-lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{patient.name}</h2>
              <PriorityBadge priority={patient.risk} />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              {patient.age}y · {patient.gender} · {patient.condition}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><Fingerprint className="size-3.5 text-ink-faint" /> {patient.uhid}</span>
              <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-ink-faint" /> {patient.phone}</span>
              <span className="inline-flex items-center gap-1.5"><Stethoscope className="size-3.5 text-ink-faint" /> {patient.doctor}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton action={{ type: "start_follow_up", id: patient.id, patientName: patient.name }} userId={userId} icon={<Activity className="size-3.5" />}>
            Start journey
          </ActionButton>
          <ActionButton action={{ type: "add_inbox_note", id: patient.id }} userId={userId} variant="primary" icon={<MessageSquare className="size-3.5" />}>
            Message
          </ActionButton>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-brand-50 p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-3" /> Next best action
        </p>
        <p className="mt-1 text-sm text-ink">{profile.nextBestAction}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {profile.openItems.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-1.5 rounded-full bg-[var(--color-high)]" /> {item}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {patient.tags.map((tag) => (
          <Badge key={tag} tone="neutral">{tag}</Badge>
        ))}
      </div>
    </Panel>
  );
}

function IdentityPanel({ userId, candidates }: { userId: string; candidates: { id: string; name: string; phone: string; uhid: string; branch: string; confidence: number; signals: string[] }[] }) {
  return (
    <Panel padded={false}>
      <div className="p-5 pb-3">
        <SectionTitle icon={<Fingerprint className="size-4" />} title="Identity matching" subtitle="Shared household number · 3 candidates" />
      </div>
      <ul className="divide-y divide-line">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={candidate.name} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-ink">{candidate.name}</p>
                  <p className="text-[11px] text-ink-muted">{candidate.uhid} · {candidate.branch}</p>
                </div>
              </div>
              <Badge tone={candidate.confidence >= 75 ? "good" : candidate.confidence >= 50 ? "high" : "low"}>
                {candidate.confidence}% match
              </Badge>
            </div>
            <Meter value={candidate.confidence} className="mt-2" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.signals.map((signal) => (
                <span key={signal} className="rounded-md bg-fill px-1.5 py-0.5 text-[10px] text-ink-muted">{signal}</span>
              ))}
            </div>
            <div className="mt-2.5">
              <ActionButton action={{ type: "resolve_identity_match", id: candidate.id }} userId={userId} size="sm" icon={<CheckCircle2 className="size-3.5" />}>
                Resolve to this patient
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HouseholdPanel({ household }: { household: HouseholdContext }) {
  return (
    <Panel>
      <SectionTitle icon={<Home className="size-4" />} title="Household & caregivers" subtitle={household.name} />
      <div className="mt-3 rounded-xl bg-surface-muted p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Primary phone</span>
          <span className="font-medium text-ink">{household.primaryPhone}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-ink-muted">Preferred language</span>
          <span className="font-medium text-ink">{household.preferredLanguage}</span>
        </div>
      </div>

      <p className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Members</p>
      <ul className="space-y-1.5">
        {household.members.map((member) => (
          <li key={member.patientId} className="flex items-center gap-2.5">
            <Avatar name={member.displayName} size="xs" />
            <span className="text-sm text-ink">{member.displayName}</span>
            <span className="text-[11px] text-ink-muted">· {member.relationship}</span>
            {member.primaryContact ? <Badge tone="brand" className="ml-auto">Primary</Badge> : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Caregivers</p>
      {household.caregivers.map((caregiver) => (
        <div key={caregiver.id} className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">{caregiver.displayName} <span className="text-[11px] font-normal text-ink-muted">· {caregiver.relationship}</span></span>
            <Badge tone={caregiver.consentStatus === "granted" ? "good" : caregiver.consentStatus === "revoked" ? "critical" : "low"}>
              Consent {caregiver.consentStatus}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {caregiver.permissions.map((permission) => (
              <span key={permission} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">{permission.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      ))}

      {household.riskNotes.length ? (
        <div className="mt-3 rounded-xl bg-[var(--color-high-soft)] p-3">
          <p className="text-[11px] font-semibold text-[var(--color-high)]">Risk notes</p>
          <ul className="mt-1 space-y-0.5">
            {household.riskNotes.map((note) => (
              <li key={note} className="text-xs text-ink-soft">• {note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function ProfilePanel({ patient }: { patient: DirectoryPatient }) {
  return (
    <Panel>
      <SectionTitle icon={<Stethoscope className="size-4" />} title="Clinical snapshot" />
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {[
          ["Condition", patient.condition],
          ["Doctor", patient.doctor],
          ["Branch", patient.branch],
          ["UHID", patient.uhid],
          ["Last seen", patient.lastSeen],
          ["Risk", patient.risk]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-muted p-3">
            <dt className="text-[11px] text-ink-muted">{label}</dt>
            <dd className="mt-0.5 font-medium capitalize text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function TimelinePanel({ timeline }: { timeline: TimelineItem[] }) {
  const kindColor: Record<string, string> = {
    clinical: "bg-brand-500",
    ai: "bg-brand-400",
    message: "bg-slate-400",
    task: "bg-slate-400",
    system: "bg-slate-300"
  };
  const kindIcon: Record<string, typeof Sparkles> = {
    ai: Sparkles,
    message: MessageSquare,
    clinical: Stethoscope,
    task: CheckCircle2,
    system: Activity
  };
  return (
    <Panel>
      <SectionTitle icon={<Activity className="size-4" />} title="Patient 360 timeline" subtitle="Shared memory across teams" />
      <ol className="mt-4 space-y-0">
        {timeline.map((event, index) => {
          const Icon = kindIcon[event.kind ?? "system"] ?? Activity;
          return (
            <li key={`${event.title}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
              {index < timeline.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" /> : null}
              <span className={cn("z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-white", kindColor[event.kind ?? "system"] ?? "bg-slate-400")}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{event.title}</p>
                  <span className="text-[11px] text-ink-faint">{event.at}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{event.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

const fieldInputClass =
  "h-10 w-full rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100";

function AddPatientModal({
  open,
  onClose,
  onCreate,
  branchName
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewPatientInput) => Promise<void>;
  branchName: string;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Female");
  const [phone, setPhone] = useState("+91 ");
  const [condition, setCondition] = useState("");
  const [doctor, setDoctor] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [risk, setRisk] = useState<QueuePriority>("low");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setAge("");
    setGender("Female");
    setPhone("+91 ");
    setCondition("");
    setDoctor("");
    setLanguage("Hindi");
    setRisk("low");
    setError("");
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Patient name is required.");
      return;
    }
    const parsedAge = Number(age);
    if (age && (Number.isNaN(parsedAge) || parsedAge < 0 || parsedAge > 130)) {
      setError("Enter a valid age between 0 and 130.");
      return;
    }
    setError("");
    setSaving(true);
    await onCreate({
      name: trimmedName,
      age: age ? parsedAge : 0,
      gender,
      phone: phone.trim(),
      condition: condition.trim(),
      doctor: doctor.trim(),
      language,
      risk
    });
    setSaving(false);
    reset();
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="add-patient-title" className="max-w-lg">
      <div className="border-b border-line p-5">
        <h2 id="add-patient-title" className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          <UserPlus className="size-4 text-brand-600" /> Add patient
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Creates a record in {branchName} and opens Patient 360.</p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Sharma" className={fieldInputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="e.g. 54" className={fieldInputClass} />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={fieldInputClass}>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </Field>
        </div>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91…" className={fieldInputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Condition">
            <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Cataract" className={fieldInputClass} />
          </Field>
          <Field label="Treating doctor">
            <input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="e.g. Dr. Rao" className={fieldInputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred language">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={fieldInputClass}>
              {["Hindi", "English", "Marathi", "Tamil", "Telugu", "Bengali", "Kannada"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Risk">
            <select value={risk} onChange={(e) => setRisk(e.target.value as QueuePriority)} className={fieldInputClass}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
        </div>
        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-line p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          <UserPlus className="size-3.5" /> {saving ? "Adding…" : "Add patient"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
