import type {
  Appointment,
  AccessRequest,
  AuditEvent,
  Branch,
  Campaign,
  ClinicalRecord,
  Doctor,
  DocumentMetadata,
  FollowUp,
  Household,
  Interaction,
  JourneyEvent,
  JourneyTask,
  JourneyTemplate,
  Lead,
  LeadForm,
  LoginChallenge,
  MessageLog,
  MobileLinkSession,
  Organization,
  PasswordResetToken,
  TenantChannelConfig,
  PatientJourney,
  Patient,
  PlatformAdmin,
  ServiceApiKey,
  User,
  WorkbenchTask
} from "./types.js";
import { hashPassword } from "../auth/passwords.js";

// Demo credentials (hashed once at module load). Documented defaults for local login:
//   staff users  → password "Demo@12345"
//   org admin    → password "Admin@12345"
//   platform root→ superadmin@healthos.local / "Platform@12345"
const toCred = (plain: string) => {
  const { hash, salt } = hashPassword(plain);
  return { passwordHash: hash, passwordSalt: salt };
};
const DEMO_STAFF_CRED = toCred("Demo@12345");
const DEMO_ADMIN_CRED = toCred("Admin@12345");
const DEMO_PLATFORM_CRED = toCred("Platform@12345");

// Anchor demo timestamps to the current time so seeded appointments, sessions, and
// mobile-link expiries stay fresh on every boot (a fixed date silently expires them).
const now = new Date();
const minutesFromNow = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60_000).toISOString();

export const DEMO_TENANT_ID = "org_demo_healthcare";
export const DEMO_BRANCH_IND = "blr-indiranagar";
export const DEMO_BRANCH_WFD = "blr-whitefield";
export const DEMO_STAFF_USER_ID = "user_demo_frontdesk";
export const DEMO_SERVICE_API_KEY = "core_demo_service_key";

export type SeedData = {
  organizations: Organization[];
  branches: Branch[];
  users: User[];
  platformAdmins: PlatformAdmin[];
  loginChallenges: LoginChallenge[];
  passwordResetTokens: PasswordResetToken[];
  channelConfigs: TenantChannelConfig[];
  messages: MessageLog[];
  apiKeys: ServiceApiKey[];
  households: Household[];
  patients: Patient[];
  interactions: Interaction[];
  accessRequests: AccessRequest[];
  doctors: Doctor[];
  appointments: Appointment[];
  tasks: WorkbenchTask[];
  sessions: MobileLinkSession[];
  clinicalRecords: ClinicalRecord[];
  documents: DocumentMetadata[];
  followUps: FollowUp[];
  journeyTemplates: JourneyTemplate[];
  patientJourneys: PatientJourney[];
  journeyTasks: JourneyTask[];
  journeyEvents: JourneyEvent[];
  leads: Lead[];
  forms: LeadForm[];
  campaigns: Campaign[];
  auditEvents: AuditEvent[];
};

export const createSeedData = (): SeedData => ({
  organizations: [
    {
      id: DEMO_TENANT_ID,
      displayName: "Demo Specialty Care Network",
      status: "active",
      type: "hospital",
      planId: "enterprise",
      createdAt: daysFromNow(-120)
    }
  ],
  branches: [
    {
      id: DEMO_BRANCH_IND,
      tenantId: DEMO_TENANT_ID,
      displayName: "Indiranagar Eye Centre",
      city: "Bengaluru",
      status: "active",
      createdAt: daysFromNow(-120)
    },
    {
      id: DEMO_BRANCH_WFD,
      tenantId: DEMO_TENANT_ID,
      displayName: "Whitefield Diabetes Centre",
      city: "Bengaluru",
      status: "active",
      createdAt: daysFromNow(-120)
    }
  ],
  users: [
    {
      id: DEMO_STAFF_USER_ID,
      tenantId: DEMO_TENANT_ID,
      displayName: "Demo Front Desk",
      email: "frontdesk.demo@healthcareos.local",
      roles: ["front_desk", "call_center"],
      branchIds: [DEMO_BRANCH_IND, DEMO_BRANCH_WFD],
      status: "active",
      ...DEMO_STAFF_CRED,
      credentialVersion: 0,
      createdAt: daysFromNow(-90)
    },
    {
      id: "user_demo_coordinator",
      tenantId: DEMO_TENANT_ID,
      displayName: "Demo Care Coordinator",
      email: "coordinator.demo@healthcareos.local",
      roles: ["care_coordinator", "nurse"],
      branchIds: [DEMO_BRANCH_IND, DEMO_BRANCH_WFD],
      status: "active",
      ...DEMO_STAFF_CRED,
      credentialVersion: 0,
      createdAt: daysFromNow(-90)
    },
    {
      id: "user_demo_doctor",
      tenantId: DEMO_TENANT_ID,
      displayName: "Dr. Demo Rao",
      email: "doctor.demo@healthcareos.local",
      roles: ["doctor"],
      branchIds: [DEMO_BRANCH_IND],
      status: "active",
      ...DEMO_STAFF_CRED,
      credentialVersion: 0,
      createdAt: daysFromNow(-90)
    },
    {
      id: "user_demo_admin",
      tenantId: DEMO_TENANT_ID,
      displayName: "Demo Org Admin",
      email: "admin.demo@healthcareos.local",
      roles: ["org_admin", "admin"],
      branchIds: [DEMO_BRANCH_IND, DEMO_BRANCH_WFD],
      status: "active",
      ...DEMO_ADMIN_CRED,
      credentialVersion: 0,
      createdAt: daysFromNow(-90)
    }
  ],
  platformAdmins: [
    {
      id: "platform_admin_root",
      email: "superadmin@healthos.local",
      displayName: "HealthOS Root Admin",
      roles: ["platform_admin"],
      status: "active",
      ...DEMO_PLATFORM_CRED,
      credentialVersion: 0,
      createdAt: daysFromNow(-120)
    }
  ],
  loginChallenges: [],
  passwordResetTokens: [],
  channelConfigs: [],
  messages: [],
  apiKeys: [
    {
      id: "api_key_demo_integration",
      tenantId: DEMO_TENANT_ID,
      displayName: "Demo Integration Gateway",
      key: DEMO_SERVICE_API_KEY,
      role: "integration_service",
      status: "active",
      createdAt: daysFromNow(-30)
    },
    {
      id: "api_key_demo_workflow",
      tenantId: DEMO_TENANT_ID,
      displayName: "Demo Workflow Worker",
      key: "workflow_demo_service_key",
      role: "workflow_service",
      status: "active",
      createdAt: daysFromNow(-30)
    }
  ],
  households: [
    {
      id: "household_demo_sharma",
      tenantId: DEMO_TENANT_ID,
      displayName: "Sharma household",
      primaryPhone: "+919812340001",
      alternatePhones: ["+919876543210"],
      preferredLanguage: "Hindi",
      defaultCaregiverId: "caregiver_demo_001",
      riskNotes: ["Shared caregiver number", "Elderly post-op patient", "Caregiver-first communication"],
      members: [
        {
          patientId: "patient_demo_001",
          displayName: "Anita Sharma",
          relationship: "mother",
          branchId: DEMO_BRANCH_IND,
          primaryContact: true
        }
      ],
      caregiverPermissions: [
        {
          caregiverId: "caregiver_demo_001",
          caregiverName: "Rohit Sharma",
          relationship: "son",
          phone: "+919812340001",
          consentStatus: "granted",
          permissions: ["book", "reschedule", "receive_reminders", "upload_documents"]
        }
      ],
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-1)
    },
    {
      id: "household_demo_mehta",
      tenantId: DEMO_TENANT_ID,
      displayName: "Mehta household",
      primaryPhone: "+919900001111",
      alternatePhones: [],
      preferredLanguage: "English",
      riskNotes: ["Self-managed chronic care follow-up"],
      members: [
        {
          patientId: "patient_demo_002",
          displayName: "Rahul Mehta",
          relationship: "self",
          branchId: DEMO_BRANCH_WFD,
          primaryContact: true
        }
      ],
      caregiverPermissions: [],
      createdAt: daysFromNow(-60),
      updatedAt: daysFromNow(-3)
    }
  ],
  patients: [
    {
      id: "patient_demo_001",
      tenantId: DEMO_TENANT_ID,
      householdId: "household_demo_sharma",
      displayName: "Anita Sharma",
      age: 63,
      gender: "female",
      primaryPhone: "+919876543210",
      preferredLanguage: "Hindi",
      branchId: DEMO_BRANCH_IND,
      uhid: "EYE-2026-0001",
      identityStatus: "verified",
      tags: ["cataract", "post_op", "high_follow_up_value"],
      caregivers: [
        {
          id: "caregiver_demo_001",
          displayName: "Rohit Sharma",
          relationship: "son",
          phone: "+919812340001",
          consentStatus: "granted"
        }
      ],
      consent: {
        communications: "granted",
        aiProcessing: "granted",
        documentSharing: "granted"
      },
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-1)
    },
    {
      id: "patient_demo_002",
      tenantId: DEMO_TENANT_ID,
      householdId: "household_demo_mehta",
      displayName: "Rahul Mehta",
      age: 48,
      gender: "male",
      primaryPhone: "+919900001111",
      preferredLanguage: "English",
      branchId: DEMO_BRANCH_WFD,
      uhid: "DIA-2026-0142",
      identityStatus: "suggested_match",
      tags: ["diabetes", "hba1c_due"],
      caregivers: [],
      consent: {
        communications: "granted",
        aiProcessing: "unknown",
        documentSharing: "unknown"
      },
      createdAt: daysFromNow(-60),
      updatedAt: daysFromNow(-3)
    }
  ],
  interactions: [
    {
      id: "interaction_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      channel: "missed_call",
      direction: "inbound",
      status: "triaged",
      subject: "Missed follow-up callback",
      body: "Missed call from caregiver after post-op reminder.",
      from: "+919812340001",
      to: "+918000000001",
      language: "Hindi",
      intent: "post_op_follow_up",
      urgency: "high",
      receivedAt: minutesFromNow(-90),
      createdTaskIds: ["task_demo_001"],
      sourceExternalId: "tel_demo_001"
    },
    {
      id: "interaction_demo_002",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      channel: "whatsapp",
      direction: "inbound",
      status: "new",
      subject: "Asking for diabetes review",
      body: "Doctor ne HbA1c test bola tha. Appointment kab milega?",
      from: "+919900001111",
      to: "+918000000002",
      language: "Hinglish",
      intent: "book_follow_up",
      urgency: "medium",
      receivedAt: minutesFromNow(-35),
      createdTaskIds: [],
      sourceExternalId: "wa_demo_002"
    }
  ],
  accessRequests: [
    {
      id: "access_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      householdId: "household_demo_mehta",
      interactionId: "interaction_demo_002",
      requesterName: "Rahul Mehta",
      requesterPhone: "+919900001111",
      requestedSpecialty: "Diabetology",
      requestedBranchId: DEMO_BRANCH_WFD,
      reason: "Diabetes review and HbA1c follow-up",
      priority: "medium",
      status: "booked",
      candidateSlot: {
        doctorName: "Dr. Vikram Iyer",
        specialty: "Diabetology",
        branchId: DEMO_BRANCH_WFD,
        scheduledAt: daysFromNow(3)
      },
      appointmentId: "appointment_demo_002",
      mobileLinkToken: "mls_demo_rahul",
      notes: ["Seeded from inbound WhatsApp request."],
      createdAt: minutesFromNow(-35),
      updatedAt: daysFromNow(-1)
    }
  ],
  doctors: [
    {
      id: "doctor_demo_kavita",
      tenantId: DEMO_TENANT_ID,
      displayName: "Dr. Kavita Menon",
      specialty: "Ophthalmology",
      branchIds: [DEMO_BRANCH_IND],
      phone: "+919812300001",
      slotMinutes: 15,
      weeklyHours: {
        1: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
        2: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
        3: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
        4: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
        5: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }]
      },
      status: "active",
      userId: "user_demo_doctor",
      createdAt: daysFromNow(-90)
    },
    {
      id: "doctor_demo_vikram",
      tenantId: DEMO_TENANT_ID,
      displayName: "Dr. Vikram Iyer",
      specialty: "Diabetology",
      branchIds: [DEMO_BRANCH_WFD],
      phone: "+919812300002",
      slotMinutes: 20,
      weeklyHours: {
        1: [{ start: "10:00", end: "14:00" }],
        3: [{ start: "10:00", end: "14:00" }],
        5: [{ start: "10:00", end: "14:00" }]
      },
      status: "active",
      createdAt: daysFromNow(-90)
    }
  ],
  appointments: [
    {
      id: "appointment_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      doctorName: "Dr. Neha Rao",
      specialty: "Ophthalmology",
      branchId: DEMO_BRANCH_IND,
      scheduledAt: daysFromNow(1),
      status: "scheduled",
      reason: "7-day post cataract review",
      noShowRisk: "high",
      createdAt: daysFromNow(-2),
      updatedAt: daysFromNow(-1)
    },
    {
      id: "appointment_demo_002",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      doctorName: "Dr. Vikram Iyer",
      specialty: "Diabetology",
      branchId: DEMO_BRANCH_WFD,
      scheduledAt: daysFromNow(3),
      status: "scheduled",
      reason: "Diabetes review and HbA1c follow-up",
      noShowRisk: "medium",
      createdAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1)
    }
  ],
  tasks: [
    {
      id: "task_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      interactionId: "interaction_demo_001",
      appointmentId: "appointment_demo_001",
      title: "Recover missed cataract follow-up",
      priority: "high",
      dueAt: minutesFromNow(30),
      status: "open",
      ownerRole: "care_coordinator",
      reason: "Patient missed the first post-op callback and has high no-show risk.",
      recommendedAction: "Call caregiver first, then send a Hindi WhatsApp reminder if not reachable.",
      source: "healthcareos",
      createdAt: minutesFromNow(-80),
      updatedAt: minutesFromNow(-80)
    },
    {
      id: "task_demo_002",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      interactionId: "interaction_demo_002",
      title: "Book diabetes review",
      priority: "medium",
      dueAt: minutesFromNow(90),
      status: "open",
      ownerRole: "front_desk",
      reason: "Patient asked for follow-up after HbA1c recommendation.",
      recommendedAction: "Offer next available diabetology slot and request latest HbA1c report.",
      source: "healthcareos",
      createdAt: minutesFromNow(-25),
      updatedAt: minutesFromNow(-25)
    }
  ],
  sessions: [
    {
      token: "mls_demo_anita",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      expiresAt: daysFromNow(7),
      allowedActions: [
        "confirm_appointment",
        "upload_document_metadata",
        "confirm_follow_up",
        "reschedule_request",
        "update_checklist",
        "update_consent",
        "opt_out"
      ],
      createdAt: daysFromNow(-1)
    },
    {
      token: "mls_demo_rahul",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      expiresAt: daysFromNow(7),
      allowedActions: ["confirm_appointment", "upload_document_metadata", "confirm_follow_up", "opt_out"],
      createdAt: daysFromNow(-1)
    }
  ],
  clinicalRecords: [
    {
      patientId: "patient_demo_001",
      tenantId: DEMO_TENANT_ID,
      conditions: [
        { icd10Code: "H25.9", label: "Age-related cataract, unspecified", since: daysFromNow(-40), notes: "Right eye, post-op" }
      ],
      allergies: ["Sulfa drugs"],
      notes: "Cataract surgery completed; monitoring post-op recovery.",
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-1)
    }
  ],
  documents: [],
  followUps: [
    {
      id: "followup_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      appointmentId: "appointment_demo_001",
      title: "Post-op symptom check",
      dueAt: daysFromNow(1),
      status: "due",
      instructions: "Confirm vision, pain, redness, drops usage, and travel feasibility.",
      createdAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1)
    },
    {
      id: "followup_demo_002",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_002",
      appointmentId: "appointment_demo_002",
      title: "HbA1c report collection",
      dueAt: daysFromNow(2),
      status: "due",
      instructions: "Ask patient to upload latest HbA1c report before appointment.",
      createdAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1)
    }
  ],
  journeyTemplates: [
    {
      id: "journey_template_post_op_cataract",
      tenantId: DEMO_TENANT_ID,
      name: "Cataract post-op journey",
      condition: "cataract",
      status: "active",
      defaultOwnerRole: "care_coordinator",
      steps: [
        {
          key: "day_1_symptom_check",
          title: "Day 1 symptom check",
          offsetDays: 1,
          instructions: "Confirm vision, pain, redness, drops usage, and travel feasibility."
        },
        {
          key: "day_7_review",
          title: "Day 7 review readiness",
          offsetDays: 7,
          instructions: "Confirm appointment attendance and collect any post-op documents."
        }
      ],
      createdAt: daysFromNow(-30),
      updatedAt: daysFromNow(-5)
    }
  ],
  patientJourneys: [
    {
      id: "journey_demo_001",
      tenantId: DEMO_TENANT_ID,
      patientId: "patient_demo_001",
      templateId: "journey_template_post_op_cataract",
      title: "Anita Sharma cataract post-op",
      status: "active",
      ownerRole: "care_coordinator",
      startedAt: daysFromNow(-1),
      createdAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1)
    }
  ],
  journeyTasks: [
    {
      id: "journey_task_demo_001",
      tenantId: DEMO_TENANT_ID,
      journeyId: "journey_demo_001",
      patientId: "patient_demo_001",
      followUpId: "followup_demo_001",
      title: "Post-op symptom check",
      status: "pending",
      dueAt: daysFromNow(1),
      ownerRole: "care_coordinator",
      instructions: "Confirm vision, pain, redness, drops usage, and travel feasibility.",
      createdAt: daysFromNow(-1),
      updatedAt: daysFromNow(-1)
    }
  ],
  journeyEvents: [
    {
      id: "journey_event_demo_001",
      tenantId: DEMO_TENANT_ID,
      journeyId: "journey_demo_001",
      patientId: "patient_demo_001",
      type: "created",
      payload: {
        source: "seed"
      },
      occurredAt: daysFromNow(-1)
    }
  ],
  leads: [
    {
      id: "lead_demo_001",
      tenantId: DEMO_TENANT_ID,
      name: "Sunita Reddy",
      phone: "+919845012345",
      email: "sunita.reddy@example.com",
      source: "camp",
      sourceDetail: "Free Eye Camp - Indiranagar",
      stage: "new",
      branchId: DEMO_BRANCH_IND,
      formData: { age: "58", "village/area": "Indiranagar" },
      notes: "Walked up at the camp registration desk.",
      createdAt: daysFromNow(-4),
      updatedAt: daysFromNow(-4)
    },
    {
      id: "lead_demo_002",
      tenantId: DEMO_TENANT_ID,
      name: "Imran Khan",
      phone: "+919845067890",
      source: "meta",
      sourceDetail: "Cataract awareness - Meta lead form",
      stage: "contacted",
      assignedTo: DEMO_STAFF_USER_ID,
      branchId: DEMO_BRANCH_IND,
      notes: "Called once, asked to follow up next week.",
      createdAt: daysFromNow(-3),
      updatedAt: daysFromNow(-2)
    },
    {
      id: "lead_demo_003",
      tenantId: DEMO_TENANT_ID,
      name: "Lakshmi Narayan",
      phone: "+919845099111",
      email: "lakshmi.n@example.com",
      source: "referral",
      sourceDetail: "Referred by Dr. Vikram Iyer",
      stage: "qualified",
      assignedTo: "user_demo_coordinator",
      branchId: DEMO_BRANCH_WFD,
      notes: "Diabetic retinopathy screening candidate.",
      createdAt: daysFromNow(-2),
      updatedAt: daysFromNow(-1)
    },
    {
      id: "lead_demo_004",
      tenantId: DEMO_TENANT_ID,
      name: "Anita Sharma",
      phone: "+919876543210",
      source: "walk_in",
      sourceDetail: "Front desk walk-in",
      stage: "converted",
      branchId: DEMO_BRANCH_IND,
      convertedPatientId: "patient_demo_001",
      matchedPatientId: "patient_demo_001",
      notes: "Converted into existing patient record.",
      createdAt: daysFromNow(-20),
      updatedAt: daysFromNow(-19)
    }
  ],
  forms: [
    {
      id: "form_demo_eye_camp",
      tenantId: DEMO_TENANT_ID,
      title: "Free Eye Camp Registration",
      description: "Register for the free eye screening camp.",
      slug: "free-eye-camp-registration",
      fields: [
        { key: "name", label: "Full name", type: "text", required: true },
        { key: "phone", label: "Phone number", type: "phone", required: true },
        { key: "age", label: "Age", type: "number" },
        { key: "village/area", label: "Village / Area", type: "text" }
      ],
      status: "active",
      branchId: DEMO_BRANCH_IND,
      submissions: 0,
      createdAt: daysFromNow(-10)
    }
  ],
  campaigns: [
    {
      id: "campaign_demo_001",
      tenantId: DEMO_TENANT_ID,
      name: "Cataract camp follow-up",
      channelType: "transactional",
      audience: {
        include: "both",
        leadStages: ["new", "contacted"],
        leadSources: ["camp"],
        patientStages: [],
        conditionCodes: [],
        tags: ["cataract"]
      },
      body: "Hi {{name}}, this is Demo Specialty Care — your free eye screening report is ready. Reply to book a consult.",
      trigger: "manual",
      status: "draft",
      createdAt: daysFromNow(-5),
      updatedAt: daysFromNow(-5)
    }
  ],
  auditEvents: []
});

export const normalizeSeedData = (data: SeedData): SeedData => {
  const seed = createSeedData();
  const withTenant = <T extends { tenantId?: string }>(records: T[]) =>
    records.map((record) => ({
      ...record,
      tenantId: record.tenantId ?? DEMO_TENANT_ID
    }));
  const normalizeSessions = (records: SeedData["sessions"]) =>
    withTenant(records).map((session) => {
      const seeded = seed.sessions.find((entry) => entry.token === session.token);
      if (!seeded) {
        return session;
      }
      return {
        ...seeded,
        ...session,
        allowedActions: [...new Set([...seeded.allowedActions, ...session.allowedActions])]
      };
    });

  return {
    organizations: data.organizations?.length ? data.organizations : seed.organizations,
    branches: data.branches?.length ? withTenant(data.branches) : seed.branches,
    users: data.users?.length ? withTenant(data.users) : seed.users,
    platformAdmins: data.platformAdmins?.length ? data.platformAdmins : seed.platformAdmins,
    loginChallenges: data.loginChallenges ?? [],
    passwordResetTokens: data.passwordResetTokens ?? [],
    channelConfigs: data.channelConfigs ?? [],
    messages: data.messages ?? [],
    apiKeys: data.apiKeys?.length ? withTenant(data.apiKeys) : seed.apiKeys,
    households: data.households?.length ? withTenant(data.households) : seed.households,
    patients: withTenant(data.patients ?? []),
    interactions: withTenant(data.interactions ?? []),
    accessRequests: withTenant(data.accessRequests ?? []),
    doctors: data.doctors?.length ? withTenant(data.doctors) : seed.doctors,
    appointments: withTenant(data.appointments ?? []),
    tasks: withTenant(data.tasks ?? []),
    sessions: normalizeSessions(data.sessions ?? []),
    clinicalRecords: withTenant(data.clinicalRecords ?? []),
    documents: withTenant(data.documents ?? []),
    followUps: withTenant(data.followUps ?? []),
    journeyTemplates: withTenant(data.journeyTemplates ?? []),
    patientJourneys: withTenant(data.patientJourneys ?? []),
    journeyTasks: withTenant(data.journeyTasks ?? []),
    journeyEvents: withTenant(data.journeyEvents ?? []),
    leads: data.leads?.length ? withTenant(data.leads) : seed.leads,
    forms: data.forms?.length ? withTenant(data.forms) : seed.forms,
    campaigns: data.campaigns?.length ? withTenant(data.campaigns) : seed.campaigns,
    auditEvents: withTenant(data.auditEvents ?? [])
  };
};
