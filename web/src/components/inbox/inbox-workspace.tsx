"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Inbox as InboxIcon,
  Languages,
  Link2,
  NotebookPen,
  Paperclip,
  Phone,
  Send,
  UserRound,
  UserPlus,
  X
} from "lucide-react";
import type { InboxItem, InteractionMessage, PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import {
  getMessageMediaUrlAction,
  listApprovedWaTemplatesAction,
  refreshInboxAction,
  sendInboxAttachmentAction,
  sendInboxTemplateAction,
  sendInboxWhatsAppAction,
  type ApprovedWaTemplate
} from "@/app/staff/(app)/inbox/actions";
import { useSelection } from "@/lib/use-selection";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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
  const { data, assignConversation, escalateConversation, linkConversation, patientIdByName, refreshInbox } = useApp();
  const { activeUser } = data.authContext;
  const has = (key: PermissionKey) => activeUser.permissions.includes(key);
  const canAssign = has("inbox:assign");

  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const { selectedId, select, clear, hasSelection } = useSelection(data.inbox[0]?.id);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  /** Optimistic record of messages sent over WhatsApp, keyed by conversation id. */
  const [sentByConversation, setSentByConversation] = useState<Record<string, InteractionMessage[]>>({});

  // Live updates: incoming WhatsApp messages must appear without a manual
  // refresh, so poll the session-authed inbox and refetch on window focus.
  useEffect(() => {
    if (data.source !== "core-api") return;
    let cancelled = false;
    const tick = async () => {
      const result = await refreshInboxAction();
      if (!cancelled && result.ok && result.inbox && result.source === "core-api") {
        refreshInbox(result.inbox);
      }
    };
    const interval = setInterval(tick, 10_000);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [data.source, refreshInbox]);

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

  // Meta's 24h service rule: free-form replies are only deliverable while the
  // patient's latest message is under 24h old. Live WhatsApp conversations only.
  const replyWindowOpen = useMemo(() => {
    if (!selected || selected.channel !== "WhatsApp" || data.source !== "core-api") return true;
    if (!selected.lastPatientAt) return false;
    return Date.now() - new Date(selected.lastPatientAt).getTime() < 24 * 60 * 60 * 1000;
  }, [selected, data.source]);

  const handleSendWhatsApp = async () => {
    if (!selected) return;
    if (!canAssign) {
      toast("Inbox assign permission required to send.", "error");
      return;
    }
    const text = draft.trim();
    // The recipient is the conversation's phone — never hand-typed.
    const recipient = selected.phone?.trim() ?? "";
    if (!text && !attachment) {
      toast("Type a message or attach a file before sending.", "error");
      return;
    }
    if (!recipient) {
      toast("This conversation has no phone number on file.", "error");
      return;
    }

    setSending(true);
    let result: { ok: boolean; error?: string };
    if (attachment) {
      const form = new FormData();
      form.set("to", recipient);
      form.set("file", attachment);
      if (text) form.set("caption", text);
      result = await sendInboxAttachmentAction(form);
    } else {
      result = await sendInboxWhatsAppAction({ to: recipient, body: text });
    }
    setSending(false);

    if (!result.ok) {
      toast(result.error ?? "WhatsApp send failed.", "error");
      return;
    }

    // Optimistic bubble until the next inbox refresh returns the logged message.
    const message: InteractionMessage = {
      id: `wa-${Date.now()}`,
      author: "staff",
      authorName: activeUser.name,
      at: "Just now",
      body: text || (attachment ? `📎 ${attachment.name}` : ""),
      origin: "staff",
      status: "sent",
      ...(attachment
        ? { media: { kind: attachment.type.startsWith("image/") ? ("image" as const) : ("document" as const), filename: attachment.name } }
        : {})
    };
    setSentByConversation((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), message] }));
    setDraft("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast(`Sent on WhatsApp to ${formatPhone(recipient)}.`, "success");
    const refreshed = await refreshInboxAction();
    if (refreshed.ok && refreshed.inbox && refreshed.source === "core-api") refreshInbox(refreshed.inbox);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* Conversation list */}
      <Panel padded={false} className={cn("flex h-[calc(100dvh-8rem)] flex-col", hasSelection && "hidden lg:flex")}>
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
        <div className={cn("flex min-h-0 flex-col gap-3", !hasSelection && "hidden lg:flex")}>
          <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft lg:hidden">
            <ArrowLeft className="size-4" /> All conversations
          </button>
          <Panel padded={false} className="flex h-[calc(100dvh-10.5rem)] flex-col lg:h-[calc(100dvh-8rem)]">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
              <div className="flex items-center gap-3">
                <Avatar name={selected.patient} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    {patientId ? (
                      <Link href={`/staff/patients/${patientId}`} className="text-base font-semibold text-ink hover:text-brand-700 hover:underline">
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
                    {selected.phone ? (
                      <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
                        <Phone className="size-3" /> {formatPhone(selected.phone)}
                      </span>
                    ) : null}
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
                  <Link href={`/staff/patients/${patientId}`}>
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
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {mergeThread(selected, sentByConversation[selected.id]).map((message) => (
                <Message key={message.id} message={message} />
              ))}
            </div>

            {/* composer */}
            <div className="border-t border-line p-4">
              {!replyWindowOpen ? (
                <TemplateReplyPanel
                  patient={selected.patient}
                  phone={selected.phone}
                  canSend={canAssign}
                  authorName={activeUser.name}
                  onSent={(message) =>
                    setSentByConversation((prev) => ({
                      ...prev,
                      [selected.id]: [...(prev[selected.id] ?? []), message]
                    }))
                  }
                />
              ) : (
              <div className="rounded-xl border border-line bg-surface-muted focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder={attachment ? "Add a caption (optional)…" : `Reply to ${selected.patient}…`}
                  className="w-full resize-none bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                {attachment ? (
                  <div className="mx-3 mb-2 flex w-fit items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-soft">
                    <Paperclip className="size-3.5 text-ink-faint" />
                    <span className="max-w-56 truncate">{attachment.name}</span>
                    <span className="text-ink-faint">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="rounded p-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
                      aria-label="Remove attachment"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ActionButton
                      action={{ type: "add_inbox_note", id: selected.id, note: draft || undefined }}
                      userId={activeUser.id}
                      variant="ghost"
                      icon={<NotebookPen className="size-3.5" />}
                    >
                      Internal note
                    </ActionButton>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      className="hidden"
                      onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach an image or document"
                    >
                      <Paperclip className="size-3.5" /> Attach
                    </Button>
                  </div>
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
              )}
            </div>
          </Panel>
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
  if (message.internal) {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
          <NotebookPen className="size-3" />
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
      <div className={cn("flex max-w-[78%] flex-col", isPatient ? "items-start" : "items-end")}>
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className="font-medium text-ink-muted">{message.authorName}</span>
          {message.origin === "assistant" ? (
            <span className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              Auto
            </span>
          ) : null}
          <span>· {message.at}</span>
        </div>
        <div
          className={cn(
            "w-fit rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed",
            isPatient ? "rounded-tl-sm bg-fill text-ink" : "rounded-tr-sm bg-brand-600 text-white"
          )}
        >
          {message.media ? <MediaBubble message={message} /> : message.body}
        </div>
        {!isPatient && message.status ? <DeliveryTicks status={message.status} /> : null}
      </div>
    </div>
  );
}

/**
 * Attachment inside a chat bubble: images render inline (fetched via a
 * short-lived signed URL), documents render as a click-to-download chip.
 * Optimistic messages (id `wa-…`) aren't on the server yet — chip only.
 */
function MediaBubble({ message }: { message: InteractionMessage }) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isImage = message.media?.kind === "image";
  const onServer = !message.id.startsWith("wa-");

  useEffect(() => {
    if (!isImage || !onServer) return;
    let alive = true;
    getMessageMediaUrlAction(message.id).then((result) => {
      if (alive && result.ok && result.url) setImageUrl(result.url);
    });
    return () => {
      alive = false;
    };
  }, [isImage, onServer, message.id]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const openDocument = async () => {
    if (!onServer || opening) return;
    setOpening(true);
    const result = await getMessageMediaUrlAction(message.id);
    setOpening(false);
    if (result.ok && result.url) window.open(result.url, "_blank", "noopener");
    else toast(result.error ?? "Could not open the attachment.", "error");
  };

  if (isImage && imageUrl) {
    const alt = message.media?.filename ?? "Attachment";
    return (
      <span className="block">
        <button type="button" onClick={() => setExpanded(true)} className="block cursor-zoom-in" title="Click to expand">
          {/* Signed URLs are short-lived and dynamic — next/image can't optimize them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={alt} className="max-h-64 max-w-full rounded-lg" />
        </button>
        {message.body && !message.body.startsWith("📎") ? <span className="mt-1 block">{message.body}</span> : null}
        {expanded ? (
          <span
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-black/85 p-6"
            onClick={() => setExpanded(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} className="max-h-full max-w-full rounded-lg object-contain shadow-pop" />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/25"
              aria-label="Close image preview"
            >
              <X className="size-5" />
            </button>
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={openDocument}
      disabled={!onServer}
      className={cn("flex items-center gap-1.5 text-left", onServer && "cursor-pointer hover:underline")}
      title={onServer ? "Open attachment" : undefined}
    >
      <Paperclip className="size-3.5 shrink-0" />
      <span className="min-w-0 break-all">{opening ? "Opening…" : message.body}</span>
    </button>
  );
}

const PATIENT_TOKENS = ["patientname", "name", "firstname"];

/**
 * Out-of-window reply: Meta only delivers pre-approved templates once the
 * patient's last message is >24h old. Templates whose params we can't fill
 * from conversation context (non-patient tokens) are listed but disabled.
 */
function TemplateReplyPanel({
  patient,
  phone,
  canSend,
  authorName,
  onSent
}: {
  patient: string;
  phone?: string;
  canSend: boolean;
  authorName: string;
  onSent: (message: InteractionMessage) => void;
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ApprovedWaTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    listApprovedWaTemplatesAction().then((result) => {
      if (alive) setTemplates(result.ok ? (result.templates ?? []) : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const firstName = patient.split(" ")[0] || patient;
  const usable = (t: ApprovedWaTemplate) =>
    t.meta.paramTokens.every((token) => PATIENT_TOKENS.includes(token.toLowerCase()));
  const preview = (t: ApprovedWaTemplate) =>
    t.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, token: string) =>
      PATIENT_TOKENS.includes(token.toLowerCase()) ? firstName : whole
    );
  const chosen = templates?.find((t) => t.id === templateId);

  const send = async () => {
    if (!chosen || !phone) {
      toast(!phone ? "This conversation has no phone number on file." : "Pick a template first.", "error");
      return;
    }
    setSending(true);
    const result = await sendInboxTemplateAction({
      to: phone,
      templateName: chosen.meta.name,
      language: chosen.meta.language,
      params: chosen.meta.paramTokens.length > 0 ? chosen.meta.paramTokens.map(() => firstName) : undefined
    });
    setSending(false);
    if (!result.ok) {
      toast(result.error ?? "Template send failed.", "error");
      return;
    }
    toast("Template sent on WhatsApp.", "success");
    onSent({
      id: `wa-${Date.now()}`,
      author: "staff",
      authorName,
      at: "Just now",
      body: preview(chosen),
      origin: "staff",
      status: "sent"
    });
    setTemplateId("");
  };

  return (
    <div className="rounded-xl border border-[var(--color-high)]/30 bg-[var(--color-high-soft)] p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-high)]">
        <AlertTriangle className="size-3.5" /> 24-hour reply window closed
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        {patient}&rsquo;s last message is over 24 hours old — WhatsApp only delivers pre-approved templates
        until they write again.
      </p>
      {templates === null ? (
        <p className="mt-3 text-xs text-ink-muted">Loading approved templates…</p>
      ) : templates.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">
          No approved templates yet. Create one under Communications → Templates and submit it to Meta.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              aria-label="Approved template"
              className="h-9 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              <option value="">Choose an approved template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!usable(t)}>
                  {t.name}
                  {usable(t) ? "" : " — needs campaign params"}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={send}
              disabled={!chosen || sending || !canSend}
              title={!canSend ? "Inbox assign permission required to send." : undefined}
            >
              <Send className="size-3.5" /> {sending ? "Sending…" : "Send template"}
            </Button>
          </div>
          {chosen ? (
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-ink-soft">{preview(chosen)}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** WhatsApp-style delivery state: ✓ sent, ✓✓ delivered, blue ✓✓ read. */
function DeliveryTicks({ status }: { status: NonNullable<InteractionMessage["status"]> }) {
  if (status === "failed") {
    return <span className="mt-0.5 text-[10px] font-medium text-[var(--color-critical)]">Failed to send</span>;
  }
  const read = status === "read";
  const delivered = read || status === "delivered";
  const label = read ? "Read" : delivered ? "Delivered" : "Sent";
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("mt-0.5 inline-flex items-center", read ? "text-[var(--color-medium)]" : "text-ink-faint")}
    >
      {delivered ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />}
    </span>
  );
}

/** "919522584955" → "+91 95225 84955"; anything else gets a best-effort +prefix. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw.startsWith("+") ? raw : `+${digits || raw}`;
}

/**
 * Server thread + optimistic locally-sent messages, dropping optimistic
 * entries the server has since confirmed (same staff-authored body) so a
 * background refresh doesn't double-render them.
 */
function mergeThread(item: InboxItem, optimistic?: InteractionMessage[]): NonNullable<InboxItem["thread"]> {
  const serverThread = item.thread ?? fallbackThread(item);
  const pending = (optimistic ?? []).filter(
    (m) => !serverThread.some((s) => s.author !== "patient" && s.body === m.body)
  );
  return [...serverThread, ...pending];
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
