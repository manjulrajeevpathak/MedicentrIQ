import type { PatientSignal } from "./types.js";

export const seededPatients: PatientSignal[] = [
  {
    patientId: "pat-eye-001",
    patientName: "Anita Sharma",
    age: 64,
    gender: "female",
    preferredLanguage: "Hindi",
    phone: "+91-90000-00001",
    caregiverName: "Rohit Sharma",
    specialty: "Ophthalmology",
    branch: "Delhi South",
    doctorName: "Dr. Meera Rao",
    messages: [
      "Patient asked if cataract surgery can be scheduled next week.",
      "Caregiver requested estimate and insurance documents."
    ],
    callNotes: ["Missed counselling call yesterday. Patient worried about surgery cost."],
    appointmentStatus: "completed",
    lastVisitAt: "2026-06-09T10:30:00+05:30",
    nextFollowUpAt: "2026-06-12T10:00:00+05:30",
    diagnoses: ["Cataract"],
    reports: [
      {
        id: "rep-eye-001",
        name: "Pre-op eye evaluation",
        status: "normal",
        summary: "Fit for cataract procedure pending payment confirmation.",
        reviewed: true
      }
    ],
    openTasks: [
      {
        id: "task-eye-001",
        title: "Call caregiver for cataract surgery counselling",
        status: "open",
        ownerRole: "care_coordinator",
        priority: "high"
      }
    ],
    payments: [
      {
        id: "pay-eye-001",
        amount: 18000,
        status: "pending",
        label: "Cataract procedure advance"
      }
    ]
  },
  {
    patientId: "pat-dia-002",
    patientName: "Imran Khan",
    age: 52,
    gender: "male",
    preferredLanguage: "Hinglish",
    phone: "+91-90000-00002",
    specialty: "Diabetes",
    branch: "Lucknow",
    doctorName: "Dr. Nikhil Sinha",
    messages: ["Patient uploaded HbA1c report and asked if visit is required."],
    appointmentStatus: "no_show",
    lastVisitAt: "2026-03-04T12:00:00+05:30",
    nextFollowUpAt: "2026-06-04T12:00:00+05:30",
    diagnoses: ["Type 2 diabetes", "Hypertension"],
    medications: ["Metformin", "Telmisartan"],
    reports: [
      {
        id: "rep-dia-001",
        name: "HbA1c",
        status: "abnormal",
        summary: "HbA1c is above target. Follow-up visit is recommended.",
        reviewed: false
      }
    ],
    openTasks: [
      {
        id: "task-dia-001",
        title: "Recover missed diabetes follow-up",
        status: "open",
        ownerRole: "nurse",
        priority: "high"
      }
    ]
  },
  {
    patientId: "pat-mat-003",
    patientName: "Pooja Nair",
    age: 29,
    gender: "female",
    preferredLanguage: "English",
    phone: "+91-90000-00003",
    caregiverName: "Arjun Nair",
    specialty: "Maternity",
    branch: "Bengaluru East",
    doctorName: "Dr. Kavya Iyer",
    messages: ["Patient wants to reschedule antenatal scan because of travel."],
    appointmentStatus: "booked",
    appointmentAt: "2026-06-13T09:30:00+05:30",
    diagnoses: ["Pregnancy - second trimester"],
    openTasks: [
      {
        id: "task-mat-001",
        title: "Confirm rescheduled scan slot",
        status: "open",
        ownerRole: "front_desk",
        priority: "medium"
      }
    ]
  }
];

export function findSeedPatient(patientId: string | undefined): PatientSignal | undefined {
  if (!patientId) {
    return undefined;
  }

  return seededPatients.find((patient) => patient.patientId === patientId);
}
