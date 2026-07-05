"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, BookOpen, Bot, Plus, Trash2, UserX, X } from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, FormError } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import {
  addOptOutAction,
  removeOptOutAction,
  saveAssistantAction
} from "@/app/(app)/assistant/actions";
import type { AssistantConfig, AssistantKnowledgeEntry } from "@/lib/assistant-types";
import type { OptOut } from "@/lib/whatsapp-cloud-types";

const textareaCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200 resize-y";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function AssistantWorkspace({
  assistant,
  optOuts
}: {
  assistant: AssistantConfig;
  optOuts: OptOut[];
}) {
  const { toast } = useToast();

  // ---- Behaviour section ----------------------------------------------------
  const [enabled, setEnabled] = useState(assistant.enabled);
  const [instructions, setInstructions] = useState(assistant.instructions ?? "");
  const [handoffMessage, setHandoffMessage] = useState(assistant.handoffMessage ?? "");
  const [keywords, setKeywords] = useState<string[]>(assistant.handoffKeywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [savingBehaviour, startSaveBehaviour] = useTransition();

  // ---- Knowledge section ----------------------------------------------------
  const [knowledge, setKnowledge] = useState<AssistantKnowledgeEntry[]>(assistant.knowledge ?? []);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [savingKnowledge, startSaveKnowledge] = useTransition();

  function addKeyword() {
    const k = keywordInput.trim();
    if (!k) return;
    if (!keywords.includes(k)) setKeywords((cur) => [...cur, k]);
    setKeywordInput("");
  }

  function saveBehaviour() {
    startSaveBehaviour(async () => {
      const result = await saveAssistantAction({
        enabled,
        instructions,
        handoffMessage,
        handoffKeywords: keywords
      });
      if (!result.ok) {
        toast(result.error ?? "Could not save the assistant settings.", "error");
        return;
      }
      toast(result.message ?? "Assistant settings saved.", "success");
    });
  }

  function saveKnowledge() {
    if (knowledge.some((k) => !k.title.trim() || !k.content.trim())) {
      setKnowledgeError("Every knowledge entry needs a title and content.");
      return;
    }
    setKnowledgeError(null);
    startSaveKnowledge(async () => {
      const result = await saveAssistantAction({ knowledge });
      if (!result.ok) {
        setKnowledgeError(result.error ?? "Could not save the knowledge base.");
        return;
      }
      // Adopt any server-assigned ids for new entries.
      if (result.data?.knowledge) setKnowledge(result.data.knowledge);
      toast(result.message ?? "Knowledge base saved.", "success");
    });
  }

  function updateEntry(index: number, patch: Partial<AssistantKnowledgeEntry>) {
    setKnowledge((cur) => cur.map((k, i) => (i === index ? { ...k, ...patch } : k)));
  }

  function removeEntry(index: number) {
    setKnowledge((cur) => cur.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Bot className="size-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Assistant</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-ink-muted">
              Answers patient WhatsApp messages automatically using your instructions + knowledge;
              anything it can&rsquo;t handle lands in your Inbox.
            </p>
          </div>
        </div>
        <Badge tone={enabled ? "good" : "neutral"} dot>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {!assistant.available ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-high)]/30 bg-[var(--color-high-soft)] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-high)]" />
          <p className="text-xs text-[var(--color-high)]">
            AI runtime not configured on the platform yet; messages will go to your Inbox. Your
            settings below are saved and take effect the moment the runtime is available.
          </p>
        </div>
      ) : null}

      {/* Behaviour */}
      <Panel>
        <SectionTitle
          icon={<Bot className="size-4" />}
          title="Behaviour"
          subtitle="Persona, instructions and when to hand off to a human"
        />
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
            />
            <span className="text-xs text-ink">
              Answer patient WhatsApp messages automatically
              <span className="mt-0.5 block text-[11px] text-ink-muted">
                When off, every incoming message goes straight to the Unified Inbox.
              </span>
            </span>
          </label>

          <Field
            label="Instructions"
            htmlFor="asst-instructions"
            hint="Persona and behaviour — e.g. tone, languages to answer in, what never to promise."
          >
            <textarea
              id="asst-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="You are the front-desk assistant for Medicentr Eye Hospital. Be warm and concise. Answer in the patient's language. Never give medical advice — offer to book a consult instead."
              className={textareaCls}
            />
          </Field>

          <Field
            label="Handoff message"
            htmlFor="asst-handoff"
            hint="Sent to the patient when the assistant hands the conversation to your staff."
          >
            <Input
              id="asst-handoff"
              value={handoffMessage}
              onChange={(e) => setHandoffMessage(e.target.value)}
              placeholder="Connecting you to our team — someone will reply shortly."
            />
          </Field>

          <Field
            label="Handoff keywords"
            htmlFor="asst-keywords"
            hint="If a patient message contains any of these, the assistant hands off immediately."
          >
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
              <Button variant="outline" size="md" onClick={addKeyword}>
                Add
              </Button>
            </div>
            {keywords.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKeywords((cur) => cur.filter((x) => x !== k))}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-black/5 hover:bg-brand-100"
                    title="Remove keyword"
                  >
                    {k}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <div>
            <Button onClick={saveBehaviour} disabled={savingBehaviour}>
              {savingBehaviour ? "Saving…" : "Save behaviour"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Knowledge base */}
      <Panel>
        <SectionTitle
          icon={<BookOpen className="size-4" />}
          title="Knowledge base"
          subtitle="Facts the assistant answers from — timings, doctors, prices, directions"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setKnowledge((cur) => [...cur, { title: "", content: "" }])}
            >
              <Plus className="size-3.5" /> Add entry
            </Button>
          }
        />
        <div className="mt-4 space-y-3">
          {knowledge.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="No knowledge yet"
              description="Add entries like OPD timings, consult fees or directions — the assistant only answers from what you put here."
            />
          ) : (
            knowledge.map((entry, index) => (
              <div
                key={entry.id ?? `new-${index}`}
                className="space-y-2 rounded-lg border border-line bg-canvas p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={entry.title}
                    onChange={(e) => updateEntry(index, { title: e.target.value })}
                    placeholder="Title — e.g. OPD timings"
                    aria-label={`Knowledge entry ${index + 1} title`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeEntry(index)}
                    title="Delete entry"
                  >
                    <Trash2 className="size-4 text-ink-faint" />
                  </Button>
                </div>
                <textarea
                  value={entry.content}
                  onChange={(e) => updateEntry(index, { content: e.target.value })}
                  rows={3}
                  placeholder="Mon–Sat 9am–1pm and 5pm–8pm. Sunday closed. Walk-ins accepted till 12:30pm."
                  className={textareaCls}
                  aria-label={`Knowledge entry ${index + 1} content`}
                />
              </div>
            ))
          )}
          <FormError message={knowledgeError} />
          <div>
            <Button onClick={saveKnowledge} disabled={savingKnowledge}>
              {savingKnowledge ? "Saving…" : "Save knowledge"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Opt-outs */}
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
      <SectionTitle
        icon={<UserX className="size-4" />}
        title="Opt-outs"
        subtitle="Numbers that asked to stop — campaigns and the assistant skip them"
      />
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Field label="Phone (with country code)" htmlFor="optout-phone">
              <Input
                id="optout-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+9198xxxxxxxx"
              />
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Reason (optional)" htmlFor="optout-reason">
              <Input
                id="optout-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. asked at front desk"
              />
            </Field>
          </div>
          <Button onClick={add} disabled={adding}>
            <Plus className="size-3.5" /> {adding ? "Adding…" : "Add opt-out"}
          </Button>
        </div>

        {optOuts.length === 0 ? (
          <EmptyState
            icon={<UserX className="size-5" />}
            title="No opt-outs"
            description='Patients who reply "STOP" on WhatsApp appear here automatically; you can also add numbers manually.'
          />
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(o.id)}
                  disabled={removing && removingId === o.id}
                  title="Remove opt-out"
                >
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
