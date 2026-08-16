"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  UserX,
  X
} from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import {
  addOptOutAction,
  previewAssistantAction,
  removeOptOutAction,
  saveAssistantAction
} from "@/app/staff/(app)/assistant/actions";
import type {
  AssistantConfig,
  AssistantMedicalTopic,
  AssistantTopic,
  AssistantTopicMode
} from "@/lib/assistant-types";
import type { OptOut } from "@/lib/whatsapp-cloud-types";
import { cn } from "@/lib/utils";

const textareaCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200 resize-y";

const MODES: { value: AssistantTopicMode; label: string }[] = [
  { value: "answer", label: "Answer" },
  { value: "handoff", label: "Hand off" },
  { value: "off", label: "Off" }
];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function AssistantWorkspace({ assistant, optOuts }: { assistant: AssistantConfig; optOuts: OptOut[] }) {
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(assistant.enabled);
  const [whatsappOn, setWhatsappOn] = useState(assistant.channels?.whatsapp ?? true);
  const [instructions, setInstructions] = useState(assistant.instructions ?? "");
  const [handoffMessage, setHandoffMessage] = useState(assistant.handoffMessage ?? "");
  const [hoursNote, setHoursNote] = useState(assistant.hoursNote ?? "");
  const [keywords, setKeywords] = useState<string[]>(assistant.handoffKeywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [topics, setTopics] = useState<AssistantTopic[]>(assistant.topics ?? []);
  const [answerable, setAnswerable] = useState<AssistantMedicalTopic[]>(assistant.medical?.answerable ?? []);
  const [handoffTopics, setHandoffTopics] = useState<string[]>(assistant.medical?.handoffTopics ?? []);
  const [handoffTopicInput, setHandoffTopicInput] = useState("");
  const [saving, startSave] = useTransition();

  const [testMsg, setTestMsg] = useState("");
  const [testResult, setTestResult] = useState<{ reply: string; handoff: boolean } | null>(null);
  const [testing, startTest] = useTransition();

  function addKeyword() {
    const k = keywordInput.trim();
    if (k && !keywords.includes(k)) setKeywords((c) => [...c, k]);
    setKeywordInput("");
  }
  function addHandoffTopic() {
    const t = handoffTopicInput.trim();
    if (t && !handoffTopics.includes(t)) setHandoffTopics((c) => [...c, t]);
    setHandoffTopicInput("");
  }
  function updateTopic(id: string, patch: Partial<AssistantTopic>) {
    setTopics((c) => c.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function saveAll() {
    startSave(async () => {
      const result = await saveAssistantAction({
        enabled,
        channels: { whatsapp: whatsappOn, voice: false },
        instructions,
        handoffMessage,
        hoursNote,
        handoffKeywords: keywords,
        topics: topics.filter((t) => t.label.trim()),
        medical: { answerable, handoffTopics }
      });
      if (!result.ok) {
        toast(result.error ?? "Could not save the policy.", "error");
        return;
      }
      if (result.data) {
        setTopics(result.data.topics ?? topics);
        setAnswerable(result.data.medical?.answerable ?? answerable);
        setHandoffTopics(result.data.medical?.handoffTopics ?? handoffTopics);
      }
      toast("Assistant policy saved.", "success");
    });
  }

  function runTest() {
    if (!testMsg.trim()) return;
    startTest(async () => {
      const r = await previewAssistantAction(testMsg);
      if (!r.ok) {
        toast(r.error ?? "Could not run the test.", "error");
        return;
      }
      setTestResult(r.data ?? null);
    });
  }

  const appointmentsOn = topics.some((t) => t.key === "appointments" && t.mode === "answer");

  return (
    <div className="space-y-5">
      {/* Header + sticky save */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Bot className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Assistant</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-ink-muted">
              One policy governs what the bot answers, hands off, and can do — across WhatsApp today and voice next.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={enabled ? "good" : "neutral"} dot>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </div>

      {!assistant.available ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-high)]/30 bg-[var(--color-high-soft)] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-high)]" />
          <p className="text-xs text-[var(--color-high)]">
            AI runtime not configured on the platform yet; messages will go to your Inbox. Settings save and take effect the moment it&rsquo;s available.
          </p>
        </div>
      ) : null}

      {/* 1 — Status & channels */}
      <Panel>
        <SectionTitle icon={<Bot className="size-4" />} title="Status & channels" subtitle="Turn the bot on and choose where the policy is live" />
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200" />
            <span className="text-xs text-ink">
              Assistant enabled
              <span className="mt-0.5 block text-[11px] text-ink-muted">When off, every message goes straight to the Unified Inbox.</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWhatsappOn((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                whatsappOn ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line-strong text-ink-soft hover:bg-surface-muted"
              )}
            >
              <MessageCircle className="size-3.5" /> WhatsApp {whatsappOn ? "· on" : "· off"}
            </button>
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-medium text-ink-faint">
              <Phone className="size-3.5" /> Voice · Soon
            </span>
          </div>
          <Field label="Persona / tone" htmlFor="asst-instructions" hint="How the bot should sound. Governance below controls what it answers — this is just voice & style.">
            <textarea id="asst-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Warm, concise front-desk assistant. Answer in the patient's language. Always offer to help book a visit." className={textareaCls} />
          </Field>
        </div>
      </Panel>

      {/* 2 — What the bot handles */}
      <Panel>
        <SectionTitle
          icon={<Sparkles className="size-4" />}
          title="What the bot handles"
          subtitle="For each topic: Answer (bot), Hand off (human) or Off. Add the answer text the bot draws from."
          action={
            <Button size="sm" variant="secondary" onClick={() => setTopics((c) => [...c, { id: `custom-${Date.now()}`, key: "custom", label: "", mode: "answer", content: "" }])}>
              <Plus className="size-3.5" /> Add topic
            </Button>
          }
        />
        <div className="mt-4 space-y-2.5">
          {topics.length === 0 ? (
            <EmptyState icon={<Sparkles className="size-5" />} title="No topics yet" description="Add topics like Location, Doctors, Pricing — set each to Answer/Hand off/Off." />
          ) : (
            topics.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input
                    value={t.label}
                    onChange={(e) => updateTopic(t.id, { label: e.target.value })}
                    placeholder="Topic — e.g. Location & directions"
                    className="max-w-xs"
                  />
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
                      {MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => updateTopic(t.id, { mode: m.value })}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium transition",
                            t.mode === m.value
                              ? m.value === "handoff"
                                ? "bg-[var(--color-high-soft)] text-[var(--color-high)]"
                                : m.value === "off"
                                  ? "bg-fill text-ink-soft"
                                  : "bg-brand-50 text-brand-700"
                              : "text-ink-faint hover:bg-surface-muted"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setTopics((c) => c.filter((x) => x.id !== t.id))} title="Remove topic" className="rounded-lg p-1 text-ink-faint hover:bg-surface-muted">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                {t.mode === "answer" ? (
                  <>
                    <textarea
                      value={t.content ?? ""}
                      onChange={(e) => updateTopic(t.id, { content: e.target.value })}
                      rows={2}
                      placeholder="What the bot should say / draw from for this topic…"
                      className={`${textareaCls} mt-2`}
                    />
                    {(t.usesLiveData?.length ?? 0) > 0 ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-muted">
                        <CalendarClock className="size-3" /> Uses live {t.usesLiveData!.join(", ")}
                        {t.key === "appointments" && t.mode === "answer" ? " — the bot checks real slots and books" : ""}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))
          )}
          {appointmentsOn ? (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-700">
              <CalendarClock className="size-3.5" /> Appointments is on — the bot offers real available slots and books patients directly.
            </p>
          ) : null}
        </div>
      </Panel>

      {/* 3 — Medical queries */}
      <Panel>
        <SectionTitle icon={<Stethoscope className="size-4" />} title="Medical queries" subtitle="What clinical topics the bot may explain — everything else is handed off" />
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
            <Stethoscope className="mt-0.5 size-4 shrink-0 text-ink-soft" />
            <p className="text-[11px] text-ink-soft">
              The bot <b>never diagnoses or prescribes</b>. It may share general educational info only on the topics you allow below. Anything about a person&rsquo;s own symptoms, or any topic not listed, is handed off to your team.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-ink-soft">Bot may explain (general info)</p>
              <Button size="sm" variant="ghost" onClick={() => setAnswerable((c) => [...c, { label: "", content: "" }])}>
                <Plus className="size-3.5" /> Add topic
              </Button>
            </div>
            {answerable.length === 0 ? (
              <p className="text-[11px] text-ink-muted">None — all clinical questions are handed off.</p>
            ) : (
              <div className="space-y-2">
                {answerable.map((m, i) => (
                  <div key={m.id ?? `new-${i}`} className="rounded-lg border border-line bg-canvas p-3">
                    <div className="flex items-center gap-2">
                      <Input value={m.label} onChange={(e) => setAnswerable((c) => c.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. Cataract" />
                      <button type="button" onClick={() => setAnswerable((c) => c.filter((_, j) => j !== i))} title="Remove" className="rounded-lg p-1 text-ink-faint hover:bg-surface-muted">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={m.content}
                      onChange={(e) => setAnswerable((c) => c.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                      rows={2}
                      placeholder="General info the bot may share — e.g. common cataract symptoms: cloudy/blurred vision, glare, faded colours, night-driving trouble."
                      className={`${textareaCls} mt-2`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Always hand off (clinical)" htmlFor="asst-handoff-topics" hint="Clinical areas the bot must never answer — e.g. Retina, Glaucoma, LASIK.">
            <div className="flex gap-2">
              <Input
                id="asst-handoff-topics"
                value={handoffTopicInput}
                onChange={(e) => setHandoffTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHandoffTopic();
                  }
                }}
                placeholder="Type a topic and press Enter — e.g. Glaucoma"
              />
              <Button variant="outline" size="md" onClick={addHandoffTopic}>Add</Button>
            </div>
            {handoffTopics.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {handoffTopics.map((t) => (
                  <button key={t} type="button" onClick={() => setHandoffTopics((c) => c.filter((x) => x !== t))} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-high-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-high)] hover:opacity-80" title="Remove">
                    {t} <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
        </div>
      </Panel>

      {/* 4 — Handoff & escalation */}
      <Panel>
        <SectionTitle icon={<UserX className="size-4" />} title="Handoff & escalation" subtitle="What happens when the bot passes a chat to your team" />
        <div className="mt-4 space-y-4">
          <Field label="Handoff message" htmlFor="asst-handoff" hint="Sent to the patient when the bot hands the conversation to staff.">
            <Input id="asst-handoff" value={handoffMessage} onChange={(e) => setHandoffMessage(e.target.value)} placeholder="Connecting you to our team — someone will reply shortly." />
          </Field>
          <Field label="Business-hours note (optional)" htmlFor="asst-hours" hint="Appended when handing off — sets expectations on reply time.">
            <Input id="asst-hours" value={hoursNote} onChange={(e) => setHoursNote(e.target.value)} placeholder="Our team replies 9am–7pm, Mon–Sat." />
          </Field>
          <Field label="Handoff keywords" htmlFor="asst-keywords" hint="If a message contains any of these, the bot hands off immediately.">
            <div className="flex gap-2">
              <Input
                id="asst-keywords"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Type a keyword and press Enter — e.g. emergency"
              />
              <Button variant="outline" size="md" onClick={addKeyword}>Add</Button>
            </div>
            {keywords.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <button key={k} type="button" onClick={() => setKeywords((c) => c.filter((x) => x !== k))} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-black/5 hover:bg-brand-100" title="Remove">
                    {k} <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
        </div>
      </Panel>

      {/* 5 — Test the bot */}
      <Panel>
        <SectionTitle icon={<Send className="size-4" />} title="Test the bot" subtitle="Try a patient message against the saved policy. Bookings here are simulated — nothing is created." />
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runTest();
                }
              }}
              placeholder="e.g. What are your timings? / Book me with Dr… tomorrow / Do I have cataract?"
            />
            <Button onClick={runTest} disabled={testing || !testMsg.trim()}>
              {testing ? "Testing…" : "Send"}
            </Button>
          </div>
          {testResult ? (
            <div className="rounded-lg border border-line bg-canvas p-3">
              <div className="mb-1 flex items-center gap-2">
                <Bot className="size-3.5 text-brand-600" />
                <span className="text-[11px] font-medium text-ink-soft">Bot reply</span>
                {testResult.handoff ? <Badge tone="high">Would hand off</Badge> : <Badge tone="good">Answered</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{testResult.reply}</p>
            </div>
          ) : (
            <p className="text-[11px] text-ink-muted">Tip: save your policy first — the test runs against the saved version.</p>
          )}
        </div>
      </Panel>

      <OptOutsPanel optOuts={optOuts} />
    </div>
  );
}

// ============================================================================
// Opt-outs
// ============================================================================

function OptOutsPanel({ optOuts }: { optOuts: OptOut[] }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [adding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();

  function add() {
    startAdd(async () => {
      const result = await addOptOutAction({ phone, reason });
      if (!result.ok) {
        toast(result.error ?? "Could not add the opt-out.", "error");
        return;
      }
      setPhone("");
      setReason("");
      toast(result.message ?? "Number opted out.", "success");
    });
  }

  function remove(id: string) {
    setRemovingId(id);
    startRemove(async () => {
      const result = await removeOptOutAction(id);
      setRemovingId(null);
      if (!result.ok) {
        toast(result.error ?? "Could not remove the opt-out.", "error");
        return;
      }
      toast(result.message ?? "Opt-out removed.", "success");
    });
  }

  return (
    <Panel>
      <SectionTitle icon={<UserX className="size-4" />} title="Opt-outs" subtitle="Numbers that asked to stop — campaigns and the assistant skip them" />
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Field label="Phone (with country code)" htmlFor="optout-phone">
              <Input id="optout-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9198xxxxxxxx" />
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Reason (optional)" htmlFor="optout-reason">
              <Input id="optout-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. asked at front desk" />
            </Field>
          </div>
          <Button onClick={add} disabled={adding}>
            <Plus className="size-3.5" /> {adding ? "Adding…" : "Add opt-out"}
          </Button>
        </div>

        {optOuts.length === 0 ? (
          <EmptyState icon={<UserX className="size-5" />} title="No opt-outs" description='Patients who reply "STOP" on WhatsApp appear here automatically; you can also add numbers manually.' />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {optOuts.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink">{o.phone}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {o.reason || "—"}
                    {o.note ? ` · ${o.note}` : ""} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(o.id)} disabled={removing && removingId === o.id} title="Remove opt-out">
                  <Trash2 className="size-3.5" />
                  {removing && removingId === o.id ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
