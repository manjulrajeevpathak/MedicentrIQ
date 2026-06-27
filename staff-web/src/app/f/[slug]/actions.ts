"use server";

import type { PublicLeadForm } from "@/lib/leads-types";

/**
 * PUBLIC camp/lead-capture form helpers — NO session bearer. These hit core-api's
 * open `/public/forms/:slug` routes so the form can be shared with the world.
 * Deliberately self-contained (no `coreApi`, which requires a session cookie).
 */

const API_BASE = (process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export type PublicFormResult =
  | { ok: true; form: PublicLeadForm }
  | { ok: false; error: string };

export async function fetchPublicForm(slug: string): Promise<PublicFormResult> {
  try {
    const res = await fetch(`${API_BASE}/public/forms/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });
    const envelope = (await res.json().catch(() => ({}))) as {
      data?: PublicLeadForm;
      // Some public endpoints return the form unwrapped; tolerate both.
      title?: string;
      description?: string;
      fields?: PublicLeadForm["fields"];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: envelope.error?.message ?? "This form is not available." };
    }
    const form = envelope.data ?? {
      title: envelope.title ?? "Form",
      description: envelope.description,
      fields: envelope.fields ?? []
    };
    return { ok: true, form };
  } catch {
    return { ok: false, error: "Unable to reach the server. Try again." };
  }
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitPublicForm(
  slug: string,
  values: Record<string, string>
): Promise<SubmitResult> {
  try {
    const res = await fetch(`${API_BASE}/public/forms/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values })
    });
    const envelope = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: envelope.error?.message ?? "Could not submit the form. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to reach the server. Try again." };
  }
}
