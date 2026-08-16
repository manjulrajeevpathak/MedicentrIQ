/**
 * Client-safe types + label constants for the WhatsApp Cloud API (Meta) surfaces:
 * per-WABA message templates and the tenant opt-out list. No server-only imports
 * (next/headers) so client components can import these freely. Mirrors core-api's
 * /tenant/whatsapp/templates and /tenant/opt-outs contracts ({data} envelope).
 */

// ---- Meta message templates -------------------------------------------------

export type WaTemplateCategory = "MARKETING" | "UTILITY";

/** One message template as Meta reports it for the tenant's WABA. */
export type WaTemplate = {
  id: string;
  name: string;
  /** Meta review status: APPROVED / PENDING / REJECTED / PAUSED / ... */
  status: string;
  category: string;
  language: string;
  body?: string;
  rejectionReason?: string;
};

/** Shape POSTed to submit a new template for Meta review. */
export type WaTemplateInput = {
  name: string;
  category: WaTemplateCategory;
  language: string;
  body: string;
  /** Required by Meta when the body contains {{1}}, {{2}}… placeholders. */
  sampleParams?: string[];
};

export const WA_TEMPLATE_CATEGORY_OPTIONS: { value: WaTemplateCategory; label: string; hint: string }[] = [
  { value: "UTILITY", label: "Utility", hint: "Service updates tied to an existing interaction (reminders, confirmations)." },
  { value: "MARKETING", label: "Marketing", hint: "Promotions, offers and re-engagement broadcasts." }
];

/** Common languages offered in the picker — Meta accepts any locale code. */
export const WA_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English (en)" },
  { value: "en_US", label: "English — US (en_US)" },
  { value: "hi", label: "Hindi (hi)" }
];

/** Badge tone for a Meta review status. */
export function waStatusTone(status: string): "good" | "high" | "critical" | "neutral" {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "good";
  if (s === "PENDING" || s === "IN_APPEAL") return "high";
  if (s === "REJECTED" || s === "DISABLED" || s === "PAUSED") return "critical";
  return "neutral";
}

/** Meta template names must be lowercase_with_underscores. */
export function slugifyWaTemplateName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_/, "");
}

// ---- Opt-outs ----------------------------------------------------------------

export type OptOut = {
  id: string;
  phone: string;
  reason: string;
  note?: string;
  createdAt: string;
};
