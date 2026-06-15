/* ---------------------------------------------------------------------------
   WhatsApp-first comms: approved templates, language variants and governed
   broadcasts. Reflects the communications-first pilot scope.
   ------------------------------------------------------------------------- */

export type WaTemplate = {
  id: string;
  name: string;
  category: "utility" | "marketing" | "authentication";
  status: "approved" | "pending" | "rejected";
  languages: string[];
  body: string;
  useCount: number;
  lastUsed: string;
};

export type Campaign = {
  id: string;
  name: string;
  template: string;
  audience: string;
  audienceSize: number;
  status: "scheduled" | "running" | "completed" | "paused" | "draft";
  language: string;
  throttlePerMin: number;
  schedule: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  optOut: number;
};

export type CampaignsData = {
  optIn: { optedIn: number; optedOut: number; pending: number };
  delivery: { deliveryRate: number; readRate: number; replyRate: number };
  templates: WaTemplate[];
  campaigns: Campaign[];
};

const mock: CampaignsData = {
  optIn: { optedIn: 8420, optedOut: 612, pending: 1180 },
  delivery: { deliveryRate: 96, readRate: 74, replyRate: 38 },
  templates: [
    {
      id: "wt-appt-reminder",
      name: "appointment_reminder",
      category: "utility",
      status: "approved",
      languages: ["English", "Hindi", "Kannada", "Telugu"],
      body: "Namaste {{name}}, your appointment with {{doctor}} is on {{date}} at {{time}}. Reply 1 to confirm, 2 to reschedule.",
      useCount: 4120,
      lastUsed: "2m ago"
    },
    {
      id: "wt-postop-check",
      name: "post_op_safety_check",
      category: "utility",
      status: "approved",
      languages: ["Hindi", "English", "Tamil"],
      body: "Namaste {{name}}, how is your recovery after surgery? Reply with any pain, swelling or vision change and our nurse will call you.",
      useCount: 1860,
      lastUsed: "18m ago"
    },
    {
      id: "wt-hba1c",
      name: "lab_upload_reminder",
      category: "utility",
      status: "approved",
      languages: ["Marathi", "Hindi", "English"],
      body: "Namaste {{name}}, please upload your HbA1c report here {{link}} before your review on {{date}}.",
      useCount: 940,
      lastUsed: "1h ago"
    },
    {
      id: "wt-estimate",
      name: "procedure_estimate",
      category: "utility",
      status: "approved",
      languages: ["English", "Hindi", "Telugu"],
      body: "Namaste {{name}}, here is the estimate for {{procedure}}: {{amount}}. Reply to book or ask about payment options.",
      useCount: 612,
      lastUsed: "32m ago"
    },
    {
      id: "wt-camp",
      name: "eye_check_camp",
      category: "marketing",
      status: "pending",
      languages: ["Kannada", "English"],
      body: "Free eye screening camp at {{branch}} on {{date}}. Reply BOOK to reserve a slot for your family.",
      useCount: 0,
      lastUsed: "—"
    },
    {
      id: "wt-otp",
      name: "secure_link_otp",
      category: "authentication",
      status: "approved",
      languages: ["English"],
      body: "{{code}} is your HealthcareOS verification code. Valid for 10 minutes.",
      useCount: 7300,
      lastUsed: "just now"
    }
  ],
  campaigns: [
    {
      id: "cmp-301",
      name: "Cataract review recovery",
      template: "appointment_reminder",
      audience: "Post-op patients with no booked Week-1 review",
      audienceSize: 142,
      status: "running",
      language: "Hindi",
      throttlePerMin: 30,
      schedule: "Now · live",
      sent: 96,
      delivered: 92,
      read: 71,
      replied: 38,
      optOut: 2
    },
    {
      id: "cmp-298",
      name: "HbA1c collection nudge",
      template: "lab_upload_reminder",
      audience: "Diabetes review due, report missing",
      audienceSize: 88,
      status: "scheduled",
      language: "Marathi",
      throttlePerMin: 20,
      schedule: "Today 6:00 PM",
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      optOut: 0
    },
    {
      id: "cmp-292",
      name: "IVF estimate follow-up",
      template: "procedure_estimate",
      audience: "Advised IVF, estimate viewed, not booked",
      audienceSize: 34,
      status: "completed",
      language: "English",
      throttlePerMin: 15,
      schedule: "Yesterday",
      sent: 34,
      delivered: 33,
      read: 29,
      replied: 17,
      optOut: 1
    },
    {
      id: "cmp-287",
      name: "Free eye camp — Indiranagar",
      template: "eye_check_camp",
      audience: "Opted-in households within 5km",
      audienceSize: 1240,
      status: "draft",
      language: "Kannada",
      throttlePerMin: 40,
      schedule: "Pending template approval",
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      optOut: 0
    }
  ]
};

export async function getCampaigns(): Promise<CampaignsData> {
  return mock;
}
