/**
 * Assistant governance policy — the channel-agnostic brain of the WhatsApp (and
 * future voice) bot. The hospital edits a structured `AssistantConfig`; this
 * module compiles it into a system prompt and declares the appointment tools.
 * The SAME policy drives every channel — only the formatting layer differs.
 */
import type {
  AssistantChannels,
  AssistantConfig,
  AssistantMedicalScope,
  AssistantTopic
} from "./types.js";

export type AssistantChannel = "whatsapp" | "voice";

/** Predefined governance topics offered on the Assistant screen. */
export const PREDEFINED_TOPICS: { key: string; label: string; usesLiveData?: AssistantTopic["usesLiveData"] }[] = [
  { key: "hospital_info", label: "Hospital info & services" },
  { key: "doctors_schedule", label: "Doctors & schedules", usesLiveData: ["doctors"] },
  { key: "appointments", label: "Appointments (book & reschedule)", usesLiveData: ["slots"] },
  { key: "pricing", label: "Pricing & payment" },
  { key: "usp", label: "Why choose us (USP)" },
  { key: "logistics", label: "Location & directions", usesLiveData: ["branches"] },
  { key: "services", label: "Treatments & services" }
];

export const defaultAssistantChannels = (): AssistantChannels => ({ whatsapp: true, voice: false });

/** Starter policy for a hospital opening the screen for the first time. */
export const defaultAssistantTopics = (): AssistantTopic[] =>
  PREDEFINED_TOPICS.map((t) => ({
    id: t.key,
    key: t.key,
    label: t.label,
    // Info topics answer (from content the hospital adds); appointments/medical
    // are opt-in actions, so they start as handoff until configured.
    mode: t.key === "appointments" ? "handoff" : "answer",
    content: "",
    ...(t.usesLiveData ? { usesLiveData: t.usesLiveData } : {})
  }));

export const defaultMedicalScope = (): AssistantMedicalScope => ({ answerable: [], handoffTopics: [] });

// ---- Accessors with legacy fallback ----------------------------------------

const topicsOf = (config: AssistantConfig): AssistantTopic[] =>
  Array.isArray(config.topics) ? config.topics : [];
const medicalOf = (config: AssistantConfig): AssistantMedicalScope =>
  config.medical ?? defaultMedicalScope();
export const channelsOf = (config: AssistantConfig): AssistantChannels =>
  config.channels ?? defaultAssistantChannels();

/** Is a channel live for this policy? (master `enabled` is checked separately.) */
export const channelEnabled = (config: AssistantConfig, channel: AssistantChannel): boolean =>
  channel === "voice" ? channelsOf(config).voice : channelsOf(config).whatsapp;

/** Whether the appointment-booking tools should be offered (topic set to answer). */
export const appointmentsEnabled = (config: AssistantConfig): boolean =>
  topicsOf(config).some((t) => t.key === "appointments" && t.mode === "answer");

// ---- Prompt compiler --------------------------------------------------------

export type CompileParams = {
  orgName: string;
  branches: { displayName: string; city?: string; address?: string; phone?: string }[];
  doctors: { displayName: string; specialty?: string }[];
  config: AssistantConfig;
  channel: AssistantChannel;
};

/**
 * Compile the policy into a system prompt. Channel only swaps the formatting
 * rules; the governance (what to answer / hand off, medical scope, guardrails)
 * is identical, so voice and WhatsApp behave the same.
 */
export const compileAssistantSystemPrompt = (params: CompileParams): string => {
  const { orgName, branches, doctors, config, channel } = params;
  const topics = topicsOf(config);
  const answer = topics.filter((t) => t.mode === "answer");
  const handoff = topics.filter((t) => t.mode === "handoff");
  const medical = medicalOf(config);
  const lines: string[] = [];

  const fmt =
    channel === "voice"
      ? "You are on a VOICE call. Speak in short, natural spoken sentences. Do NOT use markdown, asterisks, emoji, links or bullet symbols — this is spoken aloud. Say numbers, dates and times in words."
      : "This is WhatsApp. Keep replies short (2–4 sentences), warm and concrete. Use WhatsApp formatting only: *single asterisks* for bold, _underscores_ for italics — never Markdown (**double asterisks**, # headings or bullet syntax).";
  lines.push(
    `You are the assistant for ${orgName}. Reply in the patient's language (mirror Hindi / English / Hinglish / Kannada). ${fmt}`
  );
  if (config.instructions?.trim()) {
    lines.push(config.instructions.trim());
  }

  // Immovable clinical guardrail.
  lines.push(
    "SAFETY: Never diagnose a person, interpret their own symptoms, or recommend medicines or treatment for their case. You may share ONLY general educational information on the clinical topics explicitly allowed below. For anything else clinical — or if someone asks about their own condition — do not answer; hand off."
  );

  if (answer.length > 0) {
    lines.push(
      "YOU CAN HELP WITH:\n" +
        answer
          .map((t) => `- *${t.label}*${t.content?.trim() ? `: ${t.content.trim()}` : ""}`)
          .join("\n")
    );
  }

  const usesLive = (kind: "doctors" | "branches" | "slots") =>
    answer.some((t) => (t.usesLiveData ?? []).includes(kind));
  if (usesLive("branches") && branches.length > 0) {
    lines.push(
      "Hospital address & contact (the ONLY source of truth for location/directions — never state any other address or city):\n" +
        branches
          .map(
            (b) =>
              `- ${b.displayName}${b.city ? `, ${b.city}` : ""}${b.address ? ` — ${b.address}` : ""}${
                b.phone ? ` · Phone: ${b.phone}` : ""
              }`
          )
          .join("\n")
    );
  }
  if ((usesLive("doctors") || usesLive("slots")) && doctors.length > 0) {
    lines.push(
      "Doctors:\n" + doctors.map((d) => `- ${d.displayName}${d.specialty ? ` (${d.specialty})` : ""}`).join("\n")
    );
  }

  if (appointmentsEnabled(config)) {
    lines.push(
      "APPOINTMENTS: You can look up a doctor's real available slots and book an appointment using your tools. Confirm the doctor, date, time and the patient's full name before calling book_appointment. After a successful booking, tell them it is confirmed with the date and time. If there are no slots, the details are unclear, or the patient wants a human, hand off."
    );
  }

  if (handoff.length > 0) {
    lines.push("DO NOT answer these — hand off to staff:\n" + handoff.map((t) => `- ${t.label}`).join("\n"));
  }

  if (medical.answerable.length > 0) {
    lines.push(
      "GENERAL CLINICAL INFO you may share (educational only, never about the person's own case):\n" +
        medical.answerable.map((t) => `- *${t.label}*: ${t.content}`).join("\n")
    );
  }
  const extra = medical.handoffTopics.filter((t) => t.trim());
  lines.push(
    `For ALL other clinical or medical questions${extra.length ? ` (including ${extra.join(", ")})` : ""}, and any question about a person's own symptoms, diagnosis or treatment, do NOT answer — hand off.`
  );

  // Legacy knowledge base still feeds the bot until the hospital moves to topics.
  if (config.knowledge?.length) {
    lines.push(
      "Hospital knowledge base:\n" + config.knowledge.map((k) => `## ${k.title}\n${k.content}`).join("\n\n")
    );
  }

  lines.push(
    `When you should hand off, append the literal marker [HANDOFF] at the very end of your reply and tell the patient a staff member will help.${
      config.hoursNote?.trim() ? ` ${config.hoursNote.trim()}` : ""
    }`
  );
  lines.push(
    "Never invent prices, timings, doctors or availability that are not given above or returned by a tool. If you don't know, say so and hand off."
  );

  return lines.join("\n\n");
};

// ---- Appointment tools (Anthropic tool schemas) -----------------------------

export const APPOINTMENT_TOOLS = [
  {
    name: "list_doctors",
    description: "List the hospital's active doctors and their specialties so you can help the patient choose one.",
    input_schema: { type: "object", properties: {}, required: [] as string[] }
  },
  {
    name: "list_available_slots",
    description:
      "Get a doctor's real available appointment slots on a date. Call this before offering times so you never invent availability.",
    input_schema: {
      type: "object",
      properties: {
        doctorName: { type: "string", description: "The doctor's name as the patient referred to them." },
        date: { type: "string", description: "Date to check, in YYYY-MM-DD." }
      },
      required: ["doctorName", "date"]
    }
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment ONLY after the patient has confirmed the doctor, date and time and given their full name. Returns a confirmation or an error to relay.",
    input_schema: {
      type: "object",
      properties: {
        doctorName: { type: "string", description: "The doctor to book with." },
        date: { type: "string", description: "Date in YYYY-MM-DD." },
        time: { type: "string", description: "Start time in 24-hour HH:MM, hospital local time." },
        patientName: { type: "string", description: "The patient's full name." },
        reason: { type: "string", description: "Short reason for the visit (optional)." }
      },
      required: ["doctorName", "date", "time", "patientName"]
    }
  }
] as const;
