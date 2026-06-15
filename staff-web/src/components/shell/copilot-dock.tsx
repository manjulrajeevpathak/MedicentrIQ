"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { answerFor, copilotSuggestions, type CopilotAnswer } from "@/lib/copilot";
import { Badge } from "@/components/ui/badge";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; answer: CopilotAnswer }
  | { id: number; role: "thinking" };

let seq = 0;

export function CopilotDock({ open, onClose, userName }: { open: boolean; onClose: () => void; userName: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    seq += 1;
    const userMsg: Msg = { id: seq, role: "user", text: q };
    seq += 1;
    const thinking: Msg = { id: seq, role: "thinking" };
    setMessages((m) => [...m, userMsg, thinking]);
    setInput("");
    const answer = answerFor(q);
    setTimeout(() => {
      setMessages((m) => m.map((msg) => (msg.id === thinking.id ? { id: thinking.id, role: "assistant", answer } : msg)));
    }, 650);
  };

  return (
    <>
      <div
        className={cn("fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="HealthcareOS copilot"
        className={cn(
          "fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col border-l border-line bg-surface shadow-pop transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ai-gradient text-white">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Ask HealthcareOS</p>
              <p className="text-[11px] text-ink-muted">DatacentrIQ Copilot</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close copilot" className="rounded-lg p-1.5 text-ink-faint transition hover:bg-fill hover:text-ink-soft">
            <X className="size-4" />
          </button>
        </div>

        {/* thread */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="pt-2">
              <div className="rounded-2xl bg-brand-50 p-4">
                <p className="text-sm text-ink">
                  Hi {userName.split(" ")[0]} — I can see the inbox, Patient 360, journeys, the leakage model and Command Center. Ask me anything operational.
                </p>
              </div>
              <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Try asking</p>
              <div className="space-y-1.5">
                {copilotSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink-soft transition hover:border-brand-200 hover:bg-brand-50/50"
                  >
                    <Wand2 className="size-3.5 shrink-0 text-brand-500" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => <Bubble key={message.id} message={message} onFollowUp={ask} />)
          )}
        </div>

        {/* composer */}
        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-muted p-1.5 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about patients, leakage, journeys…"
              className="max-h-28 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              onClick={() => ask(input)}
              disabled={!input.trim()}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-center text-[10px] text-ink-faint">Copilot drafts and explains — actions still need staff approval.</p>
        </div>
      </aside>
    </>
  );
}

function Bubble({ message, onFollowUp }: { message: Msg; onFollowUp: (text: string) => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2 text-sm text-white">{message.text}</div>
      </div>
    );
  }
  if (message.role === "thinking") {
    return (
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Sparkles className="size-3.5 animate-pulse" />
        <span className="text-xs">Thinking…</span>
      </div>
    );
  }
  const a = message.answer;
  return (
    <div className="ai-surface animate-in space-y-2 rounded-2xl rounded-tl-sm p-3.5 shadow-card">
      <p className="text-sm font-semibold text-ink">{a.title}</p>
      <p className="text-sm text-ink-soft">{a.body}</p>
      {a.bullets ? (
        <ul className="space-y-1">
          {a.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-1.5 text-xs text-ink-soft">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-400" />
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {a.suggestedAction ? (
        <div className="rounded-xl bg-brand-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
            <Wand2 className="size-3" /> Suggested
          </p>
          <p className="mt-0.5 text-xs text-ink">{a.suggestedAction}</p>
        </div>
      ) : null}
      {a.citations?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {a.citations.map((citation) => (
            <Badge key={citation} tone="outline">
              <FileText className="size-3" /> {citation}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
