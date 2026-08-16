"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronDown, Copy, X } from "lucide-react";

/**
 * In-app, operator-facing version of docs/meta-whatsapp-integration.md: a
 * step-by-step drawer for connecting a hospital's own WhatsApp Business
 * Account to the Cloud API, with THIS tenant's real webhook URL inlined.
 * Content mirrors the doc's Stages A–H — update both together.
 */

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-ink-soft ring-1 ring-inset ring-line">
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition hover:bg-fill"
      >
        {copied ? <Check className="size-3 text-good" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

type Step = {
  key: string;
  title: string;
  time?: string;
  body: React.ReactNode;
};

export function WaSetupGuide({
  webhookUrl,
  verifyToken
}: {
  webhookUrl: string;
  verifyToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [openStep, setOpenStep] = useState<string>("business");

  const steps: Step[] = [
    {
      key: "business",
      title: "1 · Meta Business Portfolio + verification",
      time: "~10 min + review wait",
      body: (
        <>
          <p>
            Go to <b>business.facebook.com</b> with the hospital owner&rsquo;s Facebook login and create a{" "}
            <b>Business Portfolio</b> (exact legal name, business email on your own domain if possible).
          </p>
          <p>
            Then start <b>Business Verification</b>: <i>Business Settings → Security Centre → Start Verification</i>{" "}
            — upload GST / incorporation proof matching the legal name and address. It takes days to ~2 weeks and
            unlocks volume (1,000 conversations/day instead of ~250), so <b>start it first</b>; every other step can
            proceed while it&rsquo;s pending.
          </p>
        </>
      )
    },
    {
      key: "app",
      title: "2 · Create the Meta app + add WhatsApp",
      time: "~10 min",
      body: (
        <>
          <p>
            On <b>developers.facebook.com</b>: <i>My Apps → Create App</i> → use case <b>Other</b> → type{" "}
            <b>Business</b> → link it to the Business Portfolio from step 1.
          </p>
          <p>
            On the app dashboard find <b>WhatsApp → Set up</b>. Meta auto-creates a test WhatsApp account with a free{" "}
            <b>test number</b> — on <i>WhatsApp → API Setup</i> you can add up to 5 test recipients (each confirms an
            OTP) and message them immediately. Use this to try everything before the real number goes live.
          </p>
        </>
      )
    },
    {
      key: "number",
      title: "3 · Connect the hospital's real number",
      time: "~15 min",
      body: (
        <>
          <p>
            The number must <b>not</b> be registered on the WhatsApp consumer or small-business app (delete that
            account first: WhatsApp → Settings → Account → Delete account — the SIM/number is unaffected). It must
            receive one SMS or voice-call OTP; a landline with voice works.
          </p>
          <p>
            <i>WhatsApp → API Setup → Add phone number</i>: display name shown to patients (e.g. the hospital name),
            category <i>Medical &amp; Health</i>, then complete the OTP. Meta briefly reviews the display name.
          </p>
          <p>
            Select the new number and note the <b>Phone Number ID</b> and <b>WhatsApp Business Account ID (WABA
            ID)</b> shown on that page — both are <b>numeric Graph IDs, not the phone number itself</b>. They go into
            the form on the left.
          </p>
        </>
      )
    },
    {
      key: "token",
      title: "4 · Permanent access token (most-skipped step!)",
      time: "~10 min",
      body: (
        <>
          <p>
            The token on the API Setup page <b>expires in 24 hours</b> — don&rsquo;t use it. Create a permanent{" "}
            <b>System User</b> token instead:
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              <i>business.facebook.com → Settings → Users → System users → Add</i> — name it e.g.{" "}
              <code className="rounded bg-fill px-1">medicentriq-integration</code>, role <b>Admin</b>.
            </li>
            <li>
              On the system user → <b>Add Assets</b>: assign your <b>App</b> (full control) and the <b>WhatsApp
              account</b> (full control).
            </li>
            <li>
              <b>Generate New Token</b> → pick the app → expiration <b>Never</b> → tick{" "}
              <code className="rounded bg-fill px-1">whatsapp_business_messaging</code> and{" "}
              <code className="rounded bg-fill px-1">whatsapp_business_management</code> → Generate.
            </li>
          </ol>
          <p>
            Copy the token once (Meta never shows it again) and paste it into the <b>Access token</b> field — it is
            stored for this hospital only and never displayed back.
          </p>
        </>
      )
    },
    {
      key: "secret",
      title: "5 · App secret",
      time: "~2 min",
      body: (
        <p>
          App dashboard → <i>App settings → Basic</i> → <b>App Secret → Show</b>. Paste it into the <b>App secret</b>{" "}
          field on the left — it lets us verify that incoming webhooks really come from Meta (signature check).
        </p>
      )
    },
    {
      key: "form",
      title: "6 · Save the form on this page",
      body: (
        <>
          <p>Fill and save the WhatsApp Business (Meta) card with:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li><b>Phone Number ID</b> + <b>WABA ID</b> — the numeric IDs from step 3</li>
            <li><b>Access token</b> — the permanent token from step 4</li>
            <li><b>App secret</b> — from step 5</li>
            <li><b>Verify token</b> — any string you invent (you&rsquo;ll type the same one into Meta next)</li>
            <li><b>Enabled</b> — on</li>
          </ul>
        </>
      )
    },
    {
      key: "webhook",
      title: "7 · Webhook (inbound messages + delivery receipts)",
      time: "~5 min",
      body: (
        <>
          <p>
            Meta app dashboard → <i>WhatsApp → Configuration → Webhook → Edit</i> and enter:
          </p>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-ink">Callback URL (this hospital&rsquo;s own):</p>
            <CopyValue value={webhookUrl} />
            <p className="text-[11px] font-semibold text-ink">
              Verify token: {verifyToken ? <>use the one you saved — <code className="rounded bg-fill px-1">{verifyToken}</code></> : "the string you entered in step 6"}
            </p>
          </div>
          <p>
            Save — Meta instantly calls the URL to confirm; if it fails, the gateway isn&rsquo;t publicly reachable or
            the verify tokens don&rsquo;t match. Then under <b>Webhook fields → Manage</b>, subscribe to{" "}
            <code className="rounded bg-fill px-1">messages</code> (that one field carries inbound messages AND
            sent/delivered/read receipts).
          </p>
        </>
      )
    },
    {
      key: "test",
      title: "8 · Test, templates, go live",
      body: (
        <>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <b>Inbound:</b> WhatsApp the hospital number from your phone — it appears in the message log; the{" "}
              <b>Assistant</b> replies if enabled, otherwise it lands in the Unified Inbox.
            </li>
            <li>
              <b>Template send:</b> every WABA ships with the approved <code className="rounded bg-fill px-1">hello_world</code>{" "}
              template (language <code className="rounded bg-fill px-1">en_US</code>) — try it from a Campaign with
              provider <i>WhatsApp Cloud</i>.
            </li>
            <li>
              <b>Opt-out:</b> reply STOP → you get the unsubscribe confirmation and the number shows under opt-outs
              (Assistant page). START clears it.
            </li>
            <li>
              <b>Real templates:</b> write them once in <i>Communications → Templates</i> with normal tokens
              (<code className="rounded bg-fill px-1">{"{{patientName}}"}</code>…) and click <b>Submit to Meta</b> in
              the editor — tokens convert to Meta&rsquo;s format automatically; approval is usually minutes-to-hours.
            </li>
            <li>
              <b>Billing:</b> attach a payment method in WhatsApp Manager (Billing &amp; payments) — Meta bills your
              WABA per marketing/utility template message; replies within the 24h service window are free.
            </li>
          </ul>
        </>
      )
    }
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50"
      >
        <BookOpen className="size-3.5" /> Setup guide
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="WhatsApp Cloud API setup guide"
            className="animate-in relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-pop"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
                  <BookOpen className="size-4 text-brand-600" /> Connect WhatsApp Business (Meta)
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  One-time setup, ~45 minutes hands-on. Your hospital keeps full ownership of the WhatsApp account —
                  MedicentrIQ only operates it with the credentials you save here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {steps.map((step) => {
                const expanded = openStep === step.key;
                return (
                  <div key={step.key} className="overflow-hidden rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => setOpenStep(expanded ? "" : step.key)}
                      className="flex w-full items-center justify-between gap-2 bg-canvas px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-semibold text-ink">{step.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {step.time ? <span className="text-[10px] text-ink-faint">{step.time}</span> : null}
                        <ChevronDown className={`size-4 text-ink-faint transition ${expanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {expanded ? (
                      <div className="space-y-2 border-t border-line p-3 text-xs leading-relaxed text-ink-soft">
                        {step.body}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="rounded-lg border border-line bg-canvas p-3 text-[11px] leading-relaxed text-ink-muted">
                <p className="font-semibold text-ink-soft">If something fails</p>
                <p className="mt-1">
                  Webhook won&rsquo;t validate → gateway not publicly reachable or verify-token mismatch. Sends fail
                  with &ldquo;recipient not in allowed list&rdquo; → you&rsquo;re still on the test number. Template
                  &ldquo;does not exist&rdquo; → the language must match exactly (en ≠ en_US). Token suddenly invalid
                  → you used the 24-hour token; do step 4. Capped at ~250/day → business verification still pending.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
