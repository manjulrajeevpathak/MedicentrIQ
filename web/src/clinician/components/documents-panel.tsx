"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { getDocumentUrlAction, uploadDocumentAction, type ActionResult } from "@/app/clinician/actions";
import { DOCUMENT_TYPES, type ClinicalDocument } from "@clinician/lib/types";
import { formatDate, titleCase } from "@clinician/lib/utils";

export function DocumentsPanel({
  patientId,
  documents
}: {
  patientId: string;
  documents: ClinicalDocument[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(uploadDocumentAction, {});
  const [filename, setFilename] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the picked-file label after a successful upload (the list revalidates
  // server-side, so the new document appears on its own).
  useEffect(() => {
    if (state.ok) {
      setFilename(null);
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <section className="surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4.5 w-4.5 text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Documents</h2>
      </div>

      {documents.length === 0 ? (
        <p className="mb-3 text-sm text-ink-muted">No documents uploaded.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{d.filename || "Document"}</span>
                <span className="text-xs text-ink-muted">
                  {titleCase(d.type) || "Other"} · {formatDate(d.createdAt)}
                </span>
              </span>
              <DownloadButton documentId={d.id} />
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="rounded-xl border border-line bg-surface-muted p-3">
        <input type="hidden" name="patientId" value={patientId} />

        <label htmlFor="doc-type" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
          Type
        </label>
        <select
          id="doc-type"
          name="type"
          defaultValue="prescription"
          className="tap mb-3 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label
          htmlFor="doc-file"
          className="tap mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface text-sm font-medium text-ink-soft active:bg-fill"
        >
          <Upload className="h-4 w-4 text-brand-600" />
          {filename ? <span className="truncate">{filename}</span> : "Choose photo or PDF"}
        </label>
        <input
          id="doc-file"
          name="file"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
        />

        {state.error ? <p className="mb-2 text-sm text-critical">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="tap flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {pending ? "Uploading…" : "Upload document"}
        </button>
      </form>
    </section>
  );
}

function DownloadButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const result = await getDocumentUrlAction(documentId);
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      aria-label="Download document"
      className="tap flex w-10 shrink-0 items-center justify-center rounded-lg text-brand-700 active:bg-brand-50 disabled:opacity-50"
    >
      <Download className="h-5 w-5" />
    </button>
  );
}
