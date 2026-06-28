"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { PublicLeadForm } from "@/lib/leads-types";
import { submitPublicForm } from "./actions";

const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

const inputTypeFor: Record<string, string> = {
  text: "text",
  phone: "tel",
  email: "email",
  number: "number"
};

export function PublicFormView({ slug, form }: { slug: string; form: PublicLeadForm }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, startSubmit] = useTransition();

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti(key: string, option: string) {
    setValues((prev) => {
      const selected = (prev[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const next = selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option];
      return { ...prev, [key]: next.join(", ") };
    });
  }

  function submit() {
    const missing = form.fields.find((f) => f.required && !(values[f.key] ?? "").trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setError(null);
    startSubmit(async () => {
      const result = await submitPublicForm(slug, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-7 text-center shadow-card">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-good-soft)] text-[var(--color-good)]">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="text-base font-semibold text-ink">Thank you!</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Your details have been received. Our team will reach out to you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">{form.title}</h1>
      {form.description ? <p className="mt-1.5 text-sm text-ink-muted">{form.description}</p> : null}

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {form.fields.map((field) => {
          const id = `pf-${field.key}`;
          return (
            <div key={field.key} className="space-y-1.5">
              <label htmlFor={id} className="block text-xs font-medium text-ink-soft">
                {field.label}
                {field.required ? <span className="text-[var(--color-critical)]"> *</span> : null}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={id}
                  rows={3}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                />
              ) : field.type === "select" ? (
                <select
                  id={id}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === "multiselect" ? (
                <div className="space-y-0.5 rounded-lg border border-line-strong bg-surface p-1.5">
                  {(field.options ?? []).map((opt) => {
                    const selected = (values[field.key] ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .includes(opt);
                    return (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMulti(field.key, opt)}
                          className="size-4 rounded border-line-strong text-brand-600 focus:ring-brand-200"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <Input
                  id={id}
                  type={inputTypeFor[field.type] ?? "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValue(field.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        {error ? <p className="text-xs font-medium text-[var(--color-critical)]">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  );
}
