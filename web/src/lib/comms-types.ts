/**
 * Client-safe types for the Communication Workflows engine (Templates + Workflows).
 * Mirrors the core-api contract; no server-only imports so client components can use them.
 */

export type CommChannel = "whatsapp" | "call_script";
export type CommKind = "text" | "form";
export type CommTemplateStatus = "active" | "archived";

/**
 * Meta (WhatsApp Cloud) state for a library template that has been submitted
 * to / synced with the tenant's WABA. `paramTokens[i]` is the named token
 * behind positional param {{i+1}}; numeric strings ("1", "2") mean the
 * template was imported from Meta and params need manual values.
 */
export type CommTemplateMeta = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  /** Meta review status: APPROVED / PENDING / REJECTED / PAUSED / ... */
  status: string;
  paramTokens: string[];
  rejectionReason?: string;
  syncedAt: string;
};

export type TemplateRichButton =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url: string }
  | { type: "phone"; text: string; phone: string };

/** Optional WhatsApp extras: header (text or image), footer, up to 3 buttons. */
export type CommTemplateRich = {
  headerText?: string;
  headerImageKey?: string;
  footerText?: string;
  buttons?: TemplateRichButton[];
};

export type CommTemplate = {
  id: string;
  tenantId: string;
  name: string;
  channel: CommChannel;
  kind: CommKind;
  body?: string | null;
  formId?: string | null;
  rich?: CommTemplateRich;
  status: CommTemplateStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Present once the template has been submitted to / synced from Meta. */
  meta?: CommTemplateMeta;
};

export type WorkflowAnchor = "appointment" | "visit" | "manual";
export type WorkflowStatus = "draft" | "active" | "archived";
export type StageAction = "message" | "call" | "form" | "task";

export type StageTrigger =
  | { type: "on_enroll" }
  | { type: "on_event"; event: string }
  | { type: "relative"; anchorEvent: string; offsetHours: number };

export type WorkflowStage = {
  key: string;
  name: string;
  action: StageAction;
  templateId?: string | null;
  trigger: StageTrigger;
  enabled: boolean;
  ownerRole?: string | null;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string | null;
  anchor: WorkflowAnchor;
  status: WorkflowStatus;
  stages: WorkflowStage[];
};

export type TemplateMessageStats = { sent: number; failed: number; total: number };

// ---- Label / option constants (shared by the editors) ---------------------

export const CHANNEL_LABELS: Record<CommChannel, string> = {
  whatsapp: "WhatsApp",
  call_script: "Call script"
};

export const KIND_LABELS: Record<CommKind, string> = {
  text: "Text",
  form: "Form"
};

export const ANCHOR_LABELS: Record<WorkflowAnchor, string> = {
  appointment: "Appointment",
  visit: "Visit",
  manual: "Manual"
};

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived"
};

export const STAGE_ACTION_LABELS: Record<StageAction, string> = {
  message: "Message",
  call: "Call",
  form: "Form",
  task: "Task"
};

/** Actions that send/route via a template (so a template picker is required). */
export const STAGE_ACTIONS_NEEDING_TEMPLATE: StageAction[] = ["message", "call", "form"];

/** Events an "on_event" stage trigger can fire on. */
export const STAGE_EVENTS: { value: string; label: string }[] = [
  { value: "cancelled", label: "Appointment cancelled" },
  { value: "rescheduled", label: "Appointment rescheduled" },
  { value: "checked_in", label: "Patient checked in" },
  { value: "visit_completed", label: "Visit completed" }
];

/** Anchor events a "relative" (timed) stage trigger can offset from. */
export const STAGE_ANCHOR_EVENTS: { value: string; label: string }[] = [
  { value: "appointment_start", label: "Appointment start" },
  { value: "enrollment", label: "Enrollment" },
  { value: "visit_end", label: "Visit end" }
];

/** Reusable message tokens for the text-template body editor. */
export const TEMPLATE_TOKENS = [
  "{{patientName}}",
  "{{doctorName}}",
  "{{date}}",
  "{{time}}",
  "{{branch}}",
  "{{address}}",
  "{{mapLink}}",
  "{{clinicPhone}}",
  "{{confirmLink}}"
];
