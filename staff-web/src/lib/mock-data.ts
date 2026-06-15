import type {
  AuditEvent,
  DashboardData,
  DemoAuthContext,
  DemoUser,
  PatientSummary,
  PermissionBadge,
  PermissionKey
} from "./types";

export const demoTenant = { id: "org_demo_healthcare", name: "Demo Specialty Care Network" };
export const demoBranch = { id: "blr-indiranagar", name: "Indiranagar Eye Centre" };

export const demoUsers: DemoUser[] = [
  {
    id: "user_demo_coordinator",
    name: "Priya Nair",
    role: "care_coordinator",
    title: "Care coordinator",
    permissions: ["workbench:manage", "inbox:assign", "patient360:view", "patients:create", "followup:manage", "audit:view", "journey:manage", "analytics:view"]
  },
  {
    id: "user_demo_frontdesk",
    name: "Aman Verma",
    role: "front_desk",
    title: "Front desk lead",
    permissions: ["workbench:manage", "inbox:assign", "patient360:view", "patients:create", "appointment:write", "campaign:send"]
  },
  {
    id: "user_demo_doctor",
    name: "Dr. Kavita Menon",
    role: "doctor",
    title: "Consultant ophthalmologist",
    permissions: ["patient360:view", "ai:approve", "analytics:view"]
  },
  {
    id: "user_demo_admin",
    name: "Rhea Kapoor",
    role: "org_admin",
    title: "Operations admin",
    permissions: [
      "workbench:manage",
      "inbox:assign",
      "patient360:view",
      "patients:create",
      "appointment:write",
      "followup:manage",
      "ai:approve",
      "audit:view",
      "analytics:view",
      "campaign:send",
      "journey:manage"
    ]
  }
];

const permissionLabels: Record<PermissionKey, string> = {
  "workbench:manage": "Workbench",
  "inbox:assign": "Inbox assign",
  "patient360:view": "Patient 360",
  "patients:create": "Add patients",
  "appointment:write": "Appointments",
  "followup:manage": "Follow-up",
  "ai:approve": "AI approval",
  "audit:view": "Audit",
  "analytics:view": "Analytics",
  "campaign:send": "Campaigns",
  "journey:manage": "Journeys"
};

export function getDemoUser(userId?: string): DemoUser {
  return demoUsers.find((user) => user.id === userId) ?? demoUsers[0];
}

export function buildPermissionBadges(user: DemoUser): PermissionBadge[] {
  return (Object.keys(permissionLabels) as PermissionKey[]).map((key) => ({
    key,
    label: permissionLabels[key],
    granted: user.permissions.includes(key)
  }));
}

export function buildDemoAuthContext(
  userId?: string,
  mode: DemoAuthContext["mode"] = "fallback"
): DemoAuthContext {
  const activeUser = getDemoUser(userId);
  return {
    mode,
    tenant: demoTenant,
    branch: demoBranch,
    activeUser,
    availableUsers: demoUsers,
    permissionBadges: buildPermissionBadges(activeUser)
  };
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();

export const mockAuditEvents: AuditEvent[] = [
  {
    id: "AUD-9007",
    at: minsAgo(8),
    actor: "Priya Nair",
    actorRole: "care_coordinator",
    action: "patient360.view",
    resource: "P-77421",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "allowed",
    summary: "Opened Anita Sharma timeline before nurse escalation."
  },
  {
    id: "AUD-9003",
    at: minsAgo(21),
    actor: "HealthcareOS AI",
    actorRole: "system",
    action: "recommendation.created",
    resource: "AI-811",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "system",
    summary: "Created post-op escalation recommendation with approval required."
  },
  {
    id: "AUD-8998",
    at: minsAgo(43),
    actor: "Aman Verma",
    actorRole: "front_desk",
    action: "ai.approve",
    resource: "AI-804",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "denied",
    summary: "AI approval blocked because front desk role lacks AI approval permission."
  },
  {
    id: "AUD-8991",
    at: minsAgo(67),
    actor: "integration-gateway",
    actorRole: "service",
    action: "inbox.event.ingested",
    resource: "IN-2317",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "system",
    summary: "WhatsApp post-op concern normalized into patient inbox."
  },
  {
    id: "AUD-8984",
    at: minsAgo(95),
    actor: "Priya Nair",
    actorRole: "care_coordinator",
    action: "followup.escalate",
    resource: "FQ-481",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "allowed",
    summary: "Escalated overdue cataract day-2 safety check to nurse desk."
  },
  {
    id: "AUD-8977",
    at: minsAgo(132),
    actor: "workflow-worker",
    actorRole: "service",
    action: "workflow.callback",
    resource: "WF-3321",
    tenantId: demoTenant.id,
    branchId: demoBranch.id,
    outcome: "system",
    summary: "No-show recovery workflow delivered reminder callback to core-api."
  }
];

export const patientProfiles: Record<string, PatientSummary> = {
  "P-77421": {
    id: "P-77421",
    name: "Anita Sharma",
    age: 62,
    gender: "Female",
    phone: "+91 98XX XXX 442",
    caregiver: "Son: Rohit Sharma",
    language: "Hindi",
    branch: "Indiranagar Eye Centre",
    doctor: "Dr. Kavita Menon",
    condition: "Cataract surgery follow-up",
    risk: "critical",
    nextBestAction: "Escalate to nurse, call caregiver, and book urgent review if symptom persists.",
    openItems: ["Pain message waiting for nurse review", "Post-op day 2 checklist incomplete", "Payment receipt pending upload"],
    household: {
      id: "household-demo-sharma",
      name: "Sharma household",
      primaryPhone: "+91 ******0001",
      preferredLanguage: "Hindi",
      riskNotes: ["Shared caregiver number", "Caregiver-first communication"],
      members: [
        { patientId: "P-77421", displayName: "Anita Sharma", relationship: "mother", primaryContact: true },
        { patientId: "P-77422", displayName: "Vijay Sharma", relationship: "father", primaryContact: false }
      ],
      caregivers: [
        { id: "caregiver-001", displayName: "Rohit Sharma", relationship: "son", consentStatus: "granted", permissions: ["book", "reschedule", "receive_reminders", "upload_documents"] }
      ]
    },
    timeline: [
      { at: "Today 10:42", title: "WhatsApp concern received", note: "Patient reported pain and blurred vision after surgery.", kind: "message" },
      { at: "Today 10:42", title: "AI escalation recommended", note: "DatacentrIQ flagged post-op risk language, confidence 92%.", kind: "ai" },
      { at: "Yesterday 17:20", title: "Surgery completed", note: "Right-eye cataract procedure marked complete in imported HIS event.", kind: "clinical" },
      { at: "Mon 09:15", title: "Pre-op checklist closed", note: "Consent, payment, and blood pressure check confirmed.", kind: "task" }
    ]
  },
  "P-77310": {
    id: "P-77310",
    name: "Rafiq Khan",
    age: 58,
    gender: "Male",
    phone: "+91 90XX XXX 118",
    caregiver: "Self",
    language: "Hindi",
    branch: "Lucknow",
    doctor: "Dr. Arvind Rao",
    condition: "Cardiology review after abnormal ECG",
    risk: "high",
    nextBestAction: "Offer Saturday cardiology slot and send the cost estimate in Hindi.",
    openItems: ["Abnormal ECG uploaded, no review booked", "Saturday slot preference unconfirmed", "Estimate explanation requested in Hindi"],
    timeline: [
      { at: "Today 10:08", title: "ECG uploaded via web", note: "Document flagged abnormal by diagnostics adapter.", kind: "clinical" },
      { at: "Today 10:10", title: "AI follow-up suggested", note: "Missed review flagged; Saturday slot suggested.", kind: "ai" },
      { at: "Tue 14:30", title: "Missed cardiology appointment", note: "No-show on prior booked review.", kind: "system" }
    ]
  },
  "P-77188": {
    id: "P-77188",
    name: "Meena Iyer",
    age: 34,
    gender: "Female",
    phone: "+91 99XX XXX 771",
    caregiver: "Spouse: Karthik Iyer",
    language: "Tamil",
    branch: "Indiranagar Eye Centre",
    doctor: "Dr. S. Prakash",
    condition: "IVF cycle consultation",
    risk: "medium",
    nextBestAction: "Share the IVF cycle estimate with financing options and hold a consult slot.",
    openItems: ["Cost estimate and doctor availability requested", "Spouse details and prior reports pending", "Price sensitivity noted"],
    timeline: [
      { at: "1h ago", title: "Cost + availability query", note: "High-intent IVF enquiry via call.", kind: "message" },
      { at: "1h ago", title: "AI care reminder", note: "Advised procedure not yet scheduled; financing options shared.", kind: "ai" },
      { at: "Last week", title: "Initial fertility enquiry", note: "Referred internally from gynaecology.", kind: "system" }
    ]
  },
  "P-77042": {
    id: "P-77042",
    name: "Suresh Patil",
    age: 49,
    gender: "Male",
    phone: "+91 70XX XXX 233",
    caregiver: "Self",
    language: "Marathi",
    branch: "Indiranagar Eye Centre",
    doctor: "Dr. N. Joshi",
    condition: "Diabetes quarterly review",
    risk: "medium",
    nextBestAction: "Send the HbA1c upload link in Marathi and schedule a callback if not uploaded by 6 PM.",
    openItems: ["HbA1c report not uploaded", "Quarterly review due today", "History of late uploads"],
    timeline: [
      { at: "1h 20m ago", title: "Upload location query", note: "Patient asked where to upload HbA1c after the reminder.", kind: "message" },
      { at: "Today 09:00", title: "Reminder sent", note: "Marathi WhatsApp reminder dispatched for the review.", kind: "task" },
      { at: "Quarter start", title: "Review booked", note: "Diabetes quarterly review scheduled.", kind: "clinical" }
    ]
  },
  "P-76991": {
    id: "P-76991",
    name: "Devika Nair",
    age: 45,
    gender: "Female",
    phone: "+91 98XX XXX 904",
    caregiver: "Daughter: Anjali Nair",
    language: "English",
    branch: "Indiranagar Eye Centre",
    doctor: "Dr. R. Bose",
    condition: "Oncology second opinion",
    risk: "high",
    nextBestAction: "Collect the PET-CT report before the consult and confirm caregiver attendance.",
    openItems: ["PET-CT report pending", "Biopsy slides requested", "Consult readiness blocked on documents"],
    timeline: [
      { at: "1h ago", title: "Referral intake", note: "Referred by Dr. Bose for an oncology second opinion.", kind: "system" },
      { at: "Today", title: "Document checklist opened", note: "PET-CT and biopsy slides requested from patient.", kind: "task" }
    ]
  },
  "P-76840": {
    id: "P-76840",
    name: "Lakshmi Reddy",
    age: 67,
    gender: "Female",
    phone: "+91 91XX XXX 556",
    caregiver: "Son: Ravi Reddy",
    language: "Telugu",
    branch: "Hyderabad",
    doctor: "Unassigned",
    condition: "Cataract package enquiry",
    risk: "low",
    nextBestAction: "Share the cataract package estimate in Telugu and offer a Friday consult hold.",
    openItems: ["Walk-in price query open", "Advised procedure not converted", "Doctor not yet assigned"],
    timeline: [
      { at: "2h ago", title: "Walk-in price enquiry", note: "Asked for cataract package pricing at the front desk.", kind: "message" },
      { at: "2h ago", title: "AI care reminder", note: "Advised procedure not yet scheduled.", kind: "ai" }
    ]
  }
};

export const mockDashboardData: DashboardData = {
  generatedAt: new Date().toISOString(),
  source: "mock",
  authContext: buildDemoAuthContext(),
  metrics: [
    {
      label: "Open work items",
      value: "148",
      delta: "23 high priority",
      tone: "watch",
      hint: "Across all queues, this branch",
      trend: [40, 44, 50, 47, 58, 62, 60, 66]
    },
    {
      label: "Today bookings",
      value: "86",
      delta: "+14% vs last Thu",
      tone: "good",
      trend: [50, 52, 49, 58, 62, 70, 74, 86]
    },
    {
      label: "No-show risk",
      value: "17",
      delta: "9 need callback",
      tone: "risk",
      trend: [30, 28, 34, 40, 38, 44, 42, 46]
    },
    {
      label: "Follow-ups due",
      value: "64",
      delta: "31 overdue",
      tone: "watch",
      trend: [60, 58, 62, 64, 70, 66, 72, 64]
    },
    {
      label: "Recovered revenue",
      value: "₹4.8L",
      delta: "from 22 actions",
      tone: "good",
      hint: "Leakage recovered this week",
      trend: [20, 28, 30, 42, 48, 55, 60, 72]
    }
  ],
  daySummary: "142 people are expected today. 6 are waiting now, and 3 need someone to step in.",
  floorVitals: [
    { label: "Expected today", value: "142", hint: "on track so far", tone: "good" },
    { label: "Waiting now", value: "6", hint: "longest 18 min", tone: "watch" },
    { label: "Running late", value: "4", hint: "arrivals overdue", tone: "neutral" },
    { label: "Open slots from no-shows", value: "5", hint: "offer to people waiting", tone: "watch" },
    { label: "Not confirmed yet", value: "12", hint: "coming in today", tone: "neutral" },
    { label: "Needs a person now", value: "3", hint: "don't let these wait", tone: "risk" }
  ],
  todayFlow: [
    { hour: "8", load: 30, state: "normal" },
    { hour: "9", load: 55, state: "now" },
    { hour: "10", load: 72, state: "normal" },
    { hour: "11", load: 100, state: "busy" },
    { hour: "12", load: 80, state: "normal" },
    { hour: "1", load: 48, state: "normal" },
    { hour: "2", load: 22, state: "quiet" },
    { hour: "3", load: 26, state: "quiet" },
    { hour: "4", load: 60, state: "normal" },
    { hour: "5", load: 44, state: "normal" }
  ],
  waitingRoom: [
    { id: "wait-1", name: "Lakshmi Rao", context: "58 · blood pressure review", waitMin: 18, note: "came alone, a little anxious", action: "Check in", tone: "watch" },
    { id: "wait-2", name: "Rohit", context: "here with his mother Sunita", waitMin: 9, note: "walk-in · hoping for a slot today", action: "Find a slot", tone: "neutral" },
    { id: "wait-3", name: "Imran Qureshi", context: "41 · blood test", waitMin: 6, note: "on time", action: "Check in", tone: "neutral" }
  ],
  needsPerson: {
    id: "P-77421",
    name: "Anita Sharma",
    age: 62,
    note: "Post-op review — reported pain and blurred vision, hasn't heard back since yesterday."
  },
  workbench: [
    {
      id: "WB-1042",
      priority: "critical",
      owner: "Care coordinator",
      patient: "Anita Sharma",
      summary: "Post-op day 2 cataract patient reported pain and blurred vision on WhatsApp.",
      due: "Now",
      reason: "Clinical escalation keyword plus recent surgery.",
      channel: "WhatsApp",
      slaMinutes: -42
    },
    {
      id: "WB-1039",
      priority: "high",
      owner: "Front desk",
      patient: "Rafiq Khan",
      summary: "Missed cardiology appointment after abnormal ECG upload.",
      due: "15 min",
      reason: "Abnormal document and no booked review.",
      channel: "Web",
      slaMinutes: 15
    },
    {
      id: "WB-1036",
      priority: "high",
      owner: "Call center",
      patient: "Meena Iyer",
      summary: "IVF cycle patient asked for cost estimate and doctor availability.",
      due: "30 min",
      reason: "High intent query with price sensitivity.",
      channel: "Call",
      slaMinutes: 30
    },
    {
      id: "WB-1028",
      priority: "medium",
      owner: "Nurse",
      patient: "Suresh Patil",
      summary: "Diabetes follow-up due with HbA1c report not uploaded.",
      due: "Today",
      reason: "Chronic care journey SLA.",
      channel: "WhatsApp",
      slaMinutes: 180
    },
    {
      id: "WB-1021",
      priority: "medium",
      owner: "Care coordinator",
      patient: "Devika Nair",
      summary: "Oncology second opinion needs PET-CT report before consult.",
      due: "Tomorrow",
      reason: "Document readiness blocking consult.",
      channel: "Referral",
      slaMinutes: 600
    }
  ],
  inbox: [
    {
      id: "IN-2317",
      channel: "WhatsApp",
      patient: "Anita Sharma",
      preview: "Operation ke baad aankh me dard hai, kya doctor se baat ho sakti hai?",
      intent: "Post-op concern",
      status: "escalated",
      age: "6m",
      assignee: "Nurse desk",
      language: "Hindi",
      confidence: 92,
      unread: 2,
      aiSummary:
        "Post-op day 2 cataract patient reports eye pain and blurred vision. Risk language detected — routed ahead of generic diagnostics intent.",
      aiDraft:
        "नमस्ते अनीता जी, आपकी चिंता समझ आ रही है। हमारी नर्स आपको 10 मिनट में कॉल करेंगी। कृपया आँख को न छुएँ और निर्धारित ड्रॉप जारी रखें।",
      thread: [
        {
          id: "m1",
          author: "patient",
          authorName: "Anita Sharma",
          at: "Today 10:42",
          body: "Operation ke baad aankh me dard hai, kya doctor se baat ho sakti hai?"
        },
        {
          id: "m2",
          author: "ai",
          authorName: "DatacentrIQ Copilot",
          at: "Today 10:42",
          body: "Detected post-op concern with pain + blurred vision. Confidence 92%. Recommend nurse escalation.",
          internal: true
        },
        {
          id: "m3",
          author: "patient",
          authorName: "Anita Sharma",
          at: "Today 10:44",
          body: "Thoda dhundhla bhi dikh raha hai."
        }
      ]
    },
    {
      id: "IN-2312",
      channel: "Call",
      patient: "Unknown caller",
      preview: "Missed call from family number used by three patients.",
      intent: "Needs identity match",
      status: "new",
      age: "18m",
      assignee: "Unassigned",
      language: "Unknown",
      confidence: 54,
      unread: 1,
      aiSummary:
        "Missed call from a shared household number linked to three patient records. Identity resolution required before action.",
      thread: [
        {
          id: "m1",
          author: "system",
          authorName: "Telephony adapter",
          at: "Today 10:30",
          body: "Missed call from +91 ******0001 (Sharma household). 3 candidate patients."
        }
      ]
    },
    {
      id: "IN-2307",
      channel: "Web",
      patient: "Rafiq Khan",
      preview: "Uploaded ECG and requested Saturday cardiology slot.",
      intent: "Appointment booking",
      status: "assigned",
      age: "34m",
      assignee: "Priya",
      language: "English",
      confidence: 88,
      aiSummary:
        "Patient uploaded an ECG flagged abnormal and explicitly asked for a Saturday cardiology slot. High booking intent.",
      aiDraft:
        "Hi Rafiq, thanks for sharing your ECG. Dr. Arvind Rao has a Saturday 11:20 AM slot at Lucknow. Shall I hold it for you?",
      thread: [
        {
          id: "m1",
          author: "patient",
          authorName: "Rafiq Khan",
          at: "Today 10:08",
          body: "I uploaded my ECG. Can I get a Saturday slot with the heart doctor?"
        }
      ]
    },
    {
      id: "IN-2298",
      channel: "Referral",
      patient: "Devika Nair",
      preview: "Referred by Dr. Bose for oncology second opinion.",
      intent: "Referral intake",
      status: "waiting",
      age: "1h",
      assignee: "Aman",
      language: "English",
      confidence: 81
    },
    {
      id: "IN-2285",
      channel: "WhatsApp",
      patient: "Suresh Patil",
      preview: "HbA1c report kaha upload karu? Reminder mila tha.",
      intent: "Document upload",
      status: "assigned",
      age: "1h 20m",
      assignee: "Priya",
      language: "Marathi",
      confidence: 84
    },
    {
      id: "IN-2274",
      channel: "Walk-in",
      patient: "Lakshmi Reddy",
      preview: "Walk-in asking for cataract package pricing.",
      intent: "Price query",
      status: "new",
      age: "2h",
      assignee: "Unassigned",
      language: "Telugu",
      confidence: 76
    }
  ],
  patient360: patientProfiles["P-77421"],
  patientProfiles,
  directory: [
    {
      id: "P-77421",
      name: "Anita Sharma",
      age: 62,
      gender: "Female",
      phone: "+91 98XX XXX 442",
      uhid: "UHID-552901",
      branch: "Indiranagar",
      doctor: "Dr. Kavita Menon",
      condition: "Cataract post-op",
      risk: "critical",
      lastSeen: "Today",
      tags: ["Post-op", "Caregiver-first"]
    },
    {
      id: "P-77310",
      name: "Rafiq Khan",
      age: 58,
      gender: "Male",
      phone: "+91 90XX XXX 118",
      uhid: "UHID-551183",
      branch: "Lucknow",
      doctor: "Dr. Arvind Rao",
      condition: "Cardiology review",
      risk: "high",
      lastSeen: "34m ago",
      tags: ["Abnormal ECG", "Missed appt"]
    },
    {
      id: "P-77188",
      name: "Meena Iyer",
      age: 34,
      gender: "Female",
      phone: "+91 99XX XXX 771",
      uhid: "UHID-550042",
      branch: "Indiranagar",
      doctor: "Dr. S. Prakash",
      condition: "IVF cycle",
      risk: "medium",
      lastSeen: "1h ago",
      tags: ["High intent", "Price sensitive"]
    },
    {
      id: "P-77042",
      name: "Suresh Patil",
      age: 49,
      gender: "Male",
      phone: "+91 70XX XXX 233",
      uhid: "UHID-549810",
      branch: "Indiranagar",
      doctor: "Dr. N. Joshi",
      condition: "Diabetes review",
      risk: "medium",
      lastSeen: "2h ago",
      tags: ["Chronic care", "HbA1c pending"]
    },
    {
      id: "P-76991",
      name: "Devika Nair",
      age: 45,
      gender: "Female",
      phone: "+91 98XX XXX 904",
      uhid: "UHID-549221",
      branch: "Indiranagar",
      doctor: "Dr. R. Bose",
      condition: "Oncology 2nd opinion",
      risk: "high",
      lastSeen: "1h ago",
      tags: ["Referral", "Docs pending"]
    },
    {
      id: "P-76840",
      name: "Lakshmi Reddy",
      age: 67,
      gender: "Female",
      phone: "+91 91XX XXX 556",
      uhid: "UHID-548770",
      branch: "Hyderabad",
      doctor: "Unassigned",
      condition: "Cataract enquiry",
      risk: "low",
      lastSeen: "Today",
      tags: ["Walk-in", "New"]
    }
  ],
  matchCandidates: [
    {
      id: "P-77421",
      name: "Anita Sharma",
      phone: "+91 ******0001",
      uhid: "UHID-552901",
      branch: "Indiranagar",
      confidence: 86,
      signals: ["Shared household number", "Recent surgery", "Caregiver Rohit linked"]
    },
    {
      id: "P-77422",
      name: "Vijay Sharma",
      phone: "+91 ******0001",
      uhid: "UHID-552902",
      branch: "Indiranagar",
      confidence: 61,
      signals: ["Same household number", "No recent activity"]
    },
    {
      id: "P-70912",
      name: "Anya Sharma",
      phone: "+91 ******0044",
      uhid: "UHID-540118",
      branch: "Delhi",
      confidence: 38,
      signals: ["Similar name", "Different branch", "Different number"]
    }
  ],
  accessQueue: [
    {
      id: "AQ-118",
      patient: "Rafiq Khan",
      request: "Cardiology review after ECG upload",
      branch: "Lucknow",
      doctor: "Dr. Arvind Rao",
      slot: "Sat 11:20",
      risk: "high",
      blocker: "Patient wants Hindi explanation of estimate.",
      channel: "Web",
      noShowRisk: 38,
      slots: [
        { id: "s1", label: "Sat 11:20 AM", doctor: "Dr. Arvind Rao", branch: "Lucknow", status: "open" },
        { id: "s2", label: "Sat 12:40 PM", doctor: "Dr. Arvind Rao", branch: "Lucknow", status: "limited" },
        { id: "s3", label: "Mon 09:30 AM", doctor: "Dr. P. Singh", branch: "Lucknow", status: "open" }
      ]
    },
    {
      id: "AQ-114",
      patient: "Meena Iyer",
      request: "IVF cycle consultation",
      branch: "Indiranagar",
      doctor: "Dr. S. Prakash",
      slot: "Today 16:40",
      risk: "medium",
      blocker: "Needs spouse details and prior reports.",
      channel: "Call",
      noShowRisk: 22,
      slots: [
        { id: "s1", label: "Today 4:40 PM", doctor: "Dr. S. Prakash", branch: "Indiranagar", status: "held" },
        { id: "s2", label: "Tomorrow 11:00 AM", doctor: "Dr. S. Prakash", branch: "Indiranagar", status: "open" }
      ]
    },
    {
      id: "AQ-109",
      patient: "Unknown caller",
      request: "Missed call follow-up",
      branch: "Mumbai - Thane",
      doctor: "Unassigned",
      slot: "No slot",
      risk: "medium",
      blocker: "Shared phone number needs patient match.",
      channel: "Call",
      noShowRisk: 51,
      slots: []
    },
    {
      id: "AQ-104",
      patient: "Lakshmi Reddy",
      request: "Cataract package consult",
      branch: "Hyderabad",
      doctor: "Dr. T. Rao",
      slot: "Fri 10:00",
      risk: "low",
      blocker: "Awaiting package pricing confirmation.",
      channel: "Walk-in",
      noShowRisk: 18,
      slots: [{ id: "s1", label: "Fri 10:00 AM", doctor: "Dr. T. Rao", branch: "Hyderabad", status: "open" }]
    }
  ],
  followUpQueue: [
    {
      id: "FQ-481",
      patient: "Anita Sharma",
      journey: "Cataract post-op",
      stage: "Day 2 safety check",
      due: "Overdue by 42m",
      owner: "Nurse desk",
      risk: "critical",
      nextStep: "Call now and record symptom checklist.",
      leakageRisk: 88,
      stages: [
        { label: "Surgery", state: "done" },
        { label: "Day 1 check", state: "done" },
        { label: "Day 2 safety", state: "active" },
        { label: "Week 1 review", state: "pending" }
      ],
      protocol: [
        { label: "Pain / vision symptom check", done: false },
        { label: "Eye-drop adherence confirmed", done: false },
        { label: "Caregiver briefed", done: true }
      ]
    },
    {
      id: "FQ-466",
      patient: "Suresh Patil",
      journey: "Diabetes quarterly review",
      stage: "HbA1c report collection",
      due: "Today",
      owner: "Care coordinator",
      risk: "medium",
      nextStep: "Send Marathi reminder and upload link.",
      leakageRisk: 54,
      stages: [
        { label: "Review booked", state: "done" },
        { label: "HbA1c collection", state: "active" },
        { label: "Consult", state: "pending" }
      ],
      protocol: [
        { label: "Upload link sent", done: true },
        { label: "Report received", done: false }
      ]
    },
    {
      id: "FQ-459",
      patient: "Devika Nair",
      journey: "Oncology second opinion",
      stage: "Document readiness",
      due: "Tomorrow",
      owner: "Aman",
      risk: "high",
      nextStep: "Collect PET-CT report before consult.",
      leakageRisk: 67,
      stages: [
        { label: "Referral", state: "done" },
        { label: "Document readiness", state: "active" },
        { label: "Consult", state: "pending" }
      ],
      protocol: [
        { label: "PET-CT requested", done: true },
        { label: "Biopsy slides requested", done: false }
      ]
    }
  ],
  recommendations: [
    {
      id: "AI-811",
      title: "Prioritize clinical escalation",
      patient: "Anita Sharma",
      action: "Move to nurse queue, call caregiver, and draft urgent review message.",
      evidence: "Recent surgery, Hindi pain message, incomplete day 2 checklist.",
      confidence: 92,
      requiresApproval: true,
      category: "clinical",
      sources: ["Interaction IN-2317", "HIS surgery event", "Journey FQ-481"],
      trace: [
        "Detected pain + blurred vision keywords",
        "Linked to cataract surgery 18h ago",
        "Day 2 safety check overdue",
        "Escalation ranked above generic diagnostics intent"
      ]
    },
    {
      id: "AI-804",
      title: "Recover missed cardiology follow-up",
      patient: "Rafiq Khan",
      action: "Offer Saturday slot and send cost estimate in Hindi.",
      evidence: "Abnormal ECG upload, missed appointment, explicit Saturday preference.",
      confidence: 87,
      requiresApproval: false,
      category: "access",
      sources: ["Interaction IN-2307", "ECG document", "Access AQ-118"],
      trace: ["Abnormal ECG flag", "No booked review", "Saturday preference stated"]
    },
    {
      id: "AI-796",
      title: "Prevent chronic care drop-off",
      patient: "Suresh Patil",
      action: "Send HbA1c upload link and schedule callback if not uploaded by 6 PM.",
      evidence: "Quarterly diabetes journey due, report missing, prior late uploads.",
      confidence: 78,
      requiresApproval: false,
      category: "continuity",
      sources: ["Journey FQ-466", "Prior upload history"],
      trace: ["Quarterly review due", "Report missing", "History of late uploads"]
    },
    {
      id: "AI-790",
      title: "Help schedule advised cataract surgery",
      patient: "Lakshmi Reddy",
      action: "Share package estimate in Telugu and offer Friday consult hold.",
      evidence: "Walk-in price query, advised procedure not converted, low no-show risk.",
      confidence: 71,
      requiresApproval: false,
      category: "revenue",
      sources: ["Interaction IN-2274", "Advised procedure note"],
      trace: ["Advised procedure logged", "Price query intent", "Low no-show risk"]
    }
  ],
  serviceStatus: [
    {
      name: "core-api",
      health: "degraded",
      detail: "Using local fallback data until API responds with governed headers.",
      latency: "n/a",
      authMode: "demo headers",
      scope: `${demoTenant.id} / ${demoBranch.id}`
    },
    {
      name: "datacentriq-gateway",
      health: "online",
      detail: "Mocked Copilot and Control Tower responses available.",
      latency: "142 ms",
      authMode: "service scoped",
      scope: demoTenant.id
    },
    {
      name: "integration-gateway",
      health: "online",
      detail: "WhatsApp and telephony adapters simulated.",
      latency: "96 ms",
      authMode: "service scoped",
      scope: demoTenant.id
    },
    {
      name: "workflow-worker",
      health: "online",
      detail: "Journey timers and reminders simulated.",
      latency: "121 ms",
      authMode: "service scoped",
      scope: demoTenant.id
    }
  ],
  auditEvents: mockAuditEvents
};
