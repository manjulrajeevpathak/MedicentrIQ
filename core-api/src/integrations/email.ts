import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email delivery for auth flows (invites/default passwords, password resets,
 * login OTP codes). Two transports:
 *  - ConsoleTransport (default): logs the message and keeps a small in-memory
 *    outbox so dev/test can read OTP codes and reset links without a provider.
 *  - GmailTransport: real Gmail / Google Workspace SMTP, activated when
 *    GMAIL_APP_PASSWORD is set (sends from GMAIL_USER, e.g. info@finclarity.ai).
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tag for the dev outbox so tests can find a specific kind of mail. */
  kind?: "otp" | "password_reset" | "invite" | "generic";
  /** Structured payload echoed into the dev outbox (e.g. { code } or { link }). */
  meta?: Record<string, string>;
};

export type OutboxEntry = EmailMessage & { id: string; sentAt: string; transport: string };

export interface EmailService {
  readonly transport: string;
  send(message: EmailMessage): Promise<void>;
  /** Dev-only: most recent messages (ConsoleTransport keeps these; Gmail returns []). */
  recentOutbox(limit?: number): OutboxEntry[];
}

let outboxSeq = 0;

class ConsoleEmailService implements EmailService {
  readonly transport = "console";
  private readonly outbox: OutboxEntry[] = [];

  async send(message: EmailMessage): Promise<void> {
    const entry: OutboxEntry = {
      ...message,
      id: `mail_${++outboxSeq}`,
      sentAt: new Date().toISOString(),
      transport: this.transport
    };
    this.outbox.unshift(entry);
    if (this.outbox.length > 50) this.outbox.length = 50;
    // Surface the actionable bit (code/link) prominently in the server log.
    const detail = message.meta ? ` ${JSON.stringify(message.meta)}` : "";
    console.log(`[email:console] to=${message.to} kind=${message.kind ?? "generic"} subject="${message.subject}"${detail}`);
  }

  recentOutbox(limit = 20): OutboxEntry[] {
    return this.outbox.slice(0, limit);
  }
}

class GmailEmailService implements EmailService {
  readonly transport = "gmail";
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(user: string, appPassword: string, fromName?: string) {
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // STARTTLS
      auth: { user, pass: appPassword }
    });
    this.from = fromName ? `${fromName} <${user}>` : user;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
  }

  recentOutbox(): OutboxEntry[] {
    return [];
  }
}

let singleton: EmailService | undefined;

export const createEmailService = (): EmailService => {
  if (singleton) return singleton;
  const user = process.env.GMAIL_USER;
  // Google displays App Passwords in 4 space-separated groups; SMTP needs them
  // without spaces. Normalize so it works however it's stored.
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (user && appPassword) {
    singleton = new GmailEmailService(user, appPassword, process.env.GMAIL_FROM_NAME);
    console.log(`[email] Gmail transport active (from ${user}).`);
  } else {
    singleton = new ConsoleEmailService();
    console.log("[email] Console transport active (no GMAIL_APP_PASSWORD set). OTP/links are logged + in dev outbox.");
  }
  return singleton;
};

// ---- Templates -------------------------------------------------------------

export const otpEmail = (to: string, code: string): EmailMessage => ({
  to,
  kind: "otp",
  subject: "Your HealthFlow login code",
  text: `Your one-time login code is ${code}. It expires in 10 minutes. If you did not try to sign in, ignore this email.`,
  meta: { code }
});

export const passwordResetEmail = (to: string, link: string): EmailMessage => ({
  to,
  kind: "password_reset",
  subject: "Reset your HealthFlow password",
  text: `Reset your password using this link (valid 30 minutes): ${link}. If you did not request this, ignore this email.`,
  meta: { link }
});

export const inviteEmail = (to: string, link: string, tempPassword: string): EmailMessage => ({
  to,
  kind: "invite",
  subject: "Your HealthFlow account is ready",
  text: `An account has been created for you. Sign in at ${link} with the temporary password "${tempPassword}". You'll be asked to set your own password on first login.`,
  meta: { link, tempPassword }
});
