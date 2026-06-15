"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Inbox as InboxIcon,
  Languages,
  Link2,
  NotebookPen,
  Send,
  Sparkles,
  UserRound,
  UserPlus
} from "lucide-react";
import type { InboxItem, InteractionMessage, PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { sendWhatsApp } from "@/lib/whatsapp";
import { useSelection } from "@/lib/use-selection";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Meter } from "@/components/ui/meter";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty";
import { ChannelIcon } from "@/components/common/channel";
import { ActionButton } from "@/components/common/action-button";

type Filter = "all" | "new" | "escalated" | "assigned";

const statusTone: Record<InboxItem["status"], "critical" | "high" | "medium" | "low" | "good"> = {
  new: "medium",
  waiting: "low",
  assigned: "good",
  escalated: "critical"
};

export function InboxWorkspace() {
  const { data, assignConversation, escalateConversation, linkConversation, patientIdByName } = useApp();
  const { activeUser } = data.authContext;
  const has = (key: PermissionKey) => activeUser.permissions.includes(key);
  const canAssign = has("inbox:assign");

  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const { selectedId, select, clear, hasSelection } = useSelection(data.inbox[0]?.id);
  const [draft, setDraft] = useState("");
  const [to, setTo] = useState(process.env.NEXT_PUBLIC_ULTRAMSG_DEFAULT_TO ?? "");
  const [sending, setSending] = useState(false);
  /** Optimistic record of messages sent over WhatsApp, keyed by conversation id. */
  const [sentByConversation, setSentByConversation] = useState<Record<string, InteractionMessage[]>>({});

  const counts = useMemo(
    () => ({
      all: data.inbox.length,
      new: data.inbox.filter((c) => c.status === "new").length,
      escalated: data.inbox.filter((c) => c.status === "escalated").length,
      assigned: data.inbox.filter((c) => c.status === "assigned").length
    }),
    [data.inbox]
  );

  const list = useMemo(
    () => (filter === "all" ? data.inbox : data.inbox.filter((c) => c.status === filter)),
    [data.inbox, filter]
  );

  const selected = data.inbox.find((c) => c.id === selectedId) ?? list[0] ?? data.inbox[0];

  const patientId = patientIdByName(selected?.patient ?? "");

  const handleSendWhatsApp = async () => {
    if (!selected) return;
    if (!canAssign) {
      toast("Inbox assign permission required to send.", "error");
      return;
    }
    const text = draft.trim();
    const recipient = to.trim();
    if (!text) {
      toast("Type a message before sending.", "error");
      return;
    }
    if (!recipient) {
      toast("Enter a recipient WhatsApp number.", "error");
      return;
    }

    setSending(true);
    const result = await sendWhatsApp({ to: recipient, body: text });
    setSending(false);

    if (!result.ok) {
      toast(result.error ?? "WhatsApp send failed.", "error");
      return;
    }

    const message: InteractionMessage = {
      id: `wa-${result.id ?? Date.now()}`,
      author: "staff",
      authorName: activeUser.name,
      at: "Just now",
      body: text
    };
    setSentByConversation((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), message] }));
    setDraft("");
    toast(`Sent on WhatsApp to ${recipient}.`, "success");
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* Conversation list */}
      <Panel padded={false} className={cn("flex max-h-[calc(100dvh-7.5rem)] flex-col", hasSelection && "hidden lg:flex")}>
        <div className="border-b border-line p-4">
          <SectionTitle icon={<InboxIcon className="size-4" />} title="Conversations" subtitle="All channels, one queue" />
          <div className="mt-3 overflow-x-auto scrollbar-none">
            <Segmented
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "new", label: "New", count: counts.new },
                { value: "escalated", label: "Escalated", count: counts.escalated },
                { value: "assigned", label: "Assigned", count: counts.assigned }
              ]}
            />
          </div>
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {list.map((conversation) => {
            const active = conversation.id === selected?.id;
            return (
              <li key={conversation.id}>
                <button
                  onClick={() => select(conversation.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                    active ? "bg-brand-50" : "hover:bg-surface-muted"
                  )}
                >
                  <ChannelIcon channel={conversation.channel} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{conversation.patient}</span>
                      <span className="shrink-0 text-[11px] text-ink-faint">{conversation.age}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{conversation.preview}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge tone={statusTone[conversation.status]} className="capitalize">
                        {conversation.status}
                      </Badge>
                      <span className="truncate text-[11px] text-ink-muted">{conversation.intent}</span>
                      {conversation.unread ? (
                        <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 ? <EmptyState icon={<InboxIcon className="size-5" />} title="Inbox zero" description="No conversations match this filter." /> : null}
        </ul>
      </Panel>

      {/* Detail */}
      {selected ? (
        <div className={cn("space-y-5", !hasSelection && "hidden lg:block")}>
          <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden">
            <ArrowLeft className="size-4" /> All conversations
          </button>
          <Panel padded={false}>
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
              <div className="flex items-center gap-3">
                <Avatar name={selected.patient} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    {patientId ? (
                      <Link href={`/patients/${patientId}`} className="text-base font-semibold text-ink hover:text-brand-700 hover:underline">
                        {selected.patient}
                      </Link>
                    ) : (
                      <h2 className="text-base font-semibold text-ink">{selected.patient}</h2>
                    )}
                    <Badge tone={statusTone[selected.status]} className="capitalize">
                      {selected.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{selected.intent}</span>
                    {selected.language ? (
                      <span className="inline-flex items-center gap-1">
                        <Languages className="size-3" /> {selected.language}
                      </span>
                    ) : null}
                    {selected.linkedPatient ? (
                      <Badge tone="brand"><Link2 className="size-3" /> Linked</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {patientId ? (
                  <Link href={`/patients/${patientId}`}>
                    <Button variant="outline" size="sm">
                      <UserRound className="size-3.5" /> Patient 360
                    </Button>
                  </Link>
                ) : null}
                <ActionButton
                  action={{ type: "link_conversation_patient", id: selected.id }}
                  userId={activeUser.id}
                  icon={<Link2 className="size-3.5" />}
                  permitted={canAssign}
                  restrictedReason="Inbox assign permission required to link records."
                  onSuccess={() => linkConversation(selected.id, selected.patient)}
                >
                  Link patient
                </ActionButton>
                <ActionButton
                  action={{ type: "assign_interaction", id: selected.id }}
                  userId={activeUser.id}
                  icon={<UserPlus className="size-3.5" />}
                  permitted={canAssign}
                  restrictedReason="Inbox assign permission required."
                  onSuccess={() => assignConversation(selected.id, "Care coordinator")}
                >
                  Assign
                </ActionButton>
                <ActionButton
                  action={{ type: "escalate_interaction", id: selected.id }}
                  userId={activeUser.id}
                  variant="danger"
                  icon={<AlertTriangle className="size-3.5" />}
                  permitted={canAssign}
                  restrictedReason="Inbox assign permission required to escalate."
                  confirm={{ title: "Escalate to nurse desk?", body: `This moves ${selected.patient}'s conversation to the nurse escalation queue for urgent review.`, confirmLabel: "Escalate", danger: true }}
                  onSuccess={() => escalateConversation(selected.id)}
                >
                  Escalate
                </ActionButton>
              </div>
            </div>

            {/* thread */}
            <div className="max-h-[42vh] space-y-3 overflow-y-auto p-5">
              {[...(selected.thread ?? fallbackThread(selected)), ...(sentByConversation[selected.id] ?? [])].map((message) => (
                <Message key={message.id} message={message} />
              ))}
            </div>

            {/* composer */}
            <div className="border-t border-line p-4">
              <div className="rounded-xl border border-line bg-surface-muted focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder={`Reply to ${selected.patient}…`}
                  className="w-full resize-none bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                  <div className="flex items-center gap-2">
                    {selected.aiDraft ? (
                      <Button variant="secondary" size="sm" onClick={() => setDraft(selected.aiDraft ?? "")}>
                        <Sparkles className="size-3.5" /> Use AI draft
                      </Button>
                    ) : null}
                    <ActionButton
                      action={{ type: "add_inbox_note", id: selected.id, note: draft || undefined }}
                      userId={activeUser.id}
                      variant="ghost"
                      icon={<NotebookPen className="size-3.5" />}
                    >
                      Internal note
                    </ActionButton>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      inputMode="tel"
                      placeholder="+91…"
                      aria-label="WhatsApp recipient number"
                      className="w-32 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSendWhatsApp}
                      disabled={sending || !canAssign}
                      title={!canAssign ? "Inbox assign permission required to send." : undefined}
                    >
                      <Send className="size-3.5" /> {sending ? "Sending…" : "Send on WhatsApp"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* AI triage */}
          {selected.aiSummary ? (
            <Panel className="ai-surface">
              <SectionTitle
                icon={<Bot className="size-4" />}
                title="DatacentrIQ triage"
                action={
                  selected.confidence ? (
                    <div className="flex w-32 items-center gap-2">
                      <Meter value={selected.confidence} showLabel />
                    </div>
                  ) : null
                }
              />
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{selected.aiSummary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="brand" dot>
                  Intent: {selected.intent}
                </Badge>
                {selected.language ? <Badge tone="neutral">Language: {selected.language}</Badge> : null}
                <Badge tone="outline">
                  <ArrowUpRight className="size-3" /> Routed by Copilot
                </Badge>
              </div>
            </Panel>
          ) : null}
        </div>
      ) : (
        <Panel>
          <EmptyState icon={<InboxIcon className="size-5" />} title="No conversation selected" />
        </Panel>
      )}
    </div>
  );
}

function Message({ message }: { message: NonNullable<InboxItem["thread"]>[number] }) {
  if (message.author === "ai" || message.internal) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
          {message.author === "ai" ? <Sparkles className="size-3" /> : <NotebookPen className="size-3" />}
          {message.authorName}
          <span className="font-normal text-ink-faint">· {message.at} · internal</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">{message.body}</p>
      </div>
    );
  }

  const isPatient = message.author === "patient";
  return (
    <div className={cn("flex gap-2.5", isPatient ? "" : "flex-row-reverse")}>
      <Avatar name={message.authorName} size="sm" />
      <div className={cn("max-w-[78%]", isPatient ? "" : "items-end text-right")}>
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className="font-medium text-ink-muted">{message.authorName}</span> · {message.at}
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            isPatient ? "rounded-tl-sm bg-fill text-ink" : "rounded-tr-sm bg-brand-600 text-white"
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

function fallbackThread(item: InboxItem): NonNullable<InboxItem["thread"]> {
  return [
    {
      id: "fallback",
      author: "patient",
      authorName: item.patient,
      at: `${item.age} ago`,
      body: item.preview
    }
  ];
}
