import type { PatientLinkState } from "./types";

/**
 * Demo session — Rohit Sharma (son, authorized caregiver) acting for
 * Anita Sharma, post-op cataract patient. Continues the same household
 * narrative used across the staff console demo data.
 */
export function mockPatientLink(token: string): PatientLinkState {
  const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  return {
    source: "mock",
    linkStatus: "active",
    secureLink: {
      tokenPreview: token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token,
      expiresAt,
      allowedActions: [
        "confirm_appointment",
        "reschedule_request",
        "upload_document_metadata",
        "confirm_follow_up",
        "update_consent",
        "opt_out"
      ],
      securityLabel: "Verified secure link"
    },
    provider: {
      name: "Demo Specialty Care Network",
      branch: "Indiranagar Eye Centre",
      supportPhone: "+91 98765 43210"
    },
    patient: {
      id: "P-77421",
      displayName: "Anita Sharma",
      ageLabel: "62 years",
      preferredLanguage: "Hindi",
      maskedPhone: "+91 ******0442"
    },
    caregiver: {
      displayName: "Rohit Sharma",
      relationship: "son",
      actingForPatient: true,
      consentStatus: "granted",
      permissions: ["book", "reschedule", "receive_reminders", "upload_documents"]
    },
    appointment: {
      id: "APT-5520",
      status: "pending_confirmation",
      displayDate: "Saturday, 14 June",
      displayTime: "11:20 AM",
      doctorName: "Dr. Kavita Menon",
      department: "Ophthalmology · post-op review",
      location: "Indiranagar Eye Centre, 100 Ft Road",
      statusCopy: "Please confirm this slot, or ask for a different time."
    },
    checklist: [
      {
        id: "check-drops",
        title: "Continue prescribed eye drops",
        note: "4 times daily until the review. Do not rub the eye.",
        completed: true,
        required: true
      },
      {
        id: "check-reports",
        title: "Carry the discharge summary",
        note: "Bring the surgery discharge note and any prior prescriptions.",
        completed: false,
        required: true
      },
      {
        id: "check-arrival",
        title: "Arrive 15 minutes early",
        note: "The front desk will verify details before the consult.",
        completed: false,
        required: false
      }
    ],
    documents: [
      {
        id: "doc-receipt",
        title: "Payment receipt",
        note: "Photo or PDF of the surgery payment receipt.",
        status: "pending"
      },
      {
        id: "doc-prescription",
        title: "Current prescription",
        note: "Photo of the eye-drop prescription is enough.",
        status: "pending"
      }
    ],
    followUp: {
      id: "FQ-481",
      title: "Day 2 recovery check",
      status: "pending",
      dueLabel: "Due today",
      instructions: "Is the eye comfortable today? Any pain, watering, or blurred vision?",
      nextSteps: [
        "Tell us how the recovery feels today.",
        "If anything feels wrong, our nurse will call you within 15 minutes.",
        "Your Saturday review completes the recovery plan."
      ]
    },
    consent: {
      whatsApp: true,
      calls: true,
      documentSharing: true,
      optedOut: false
    },
    greeting: { vernacular: "नमस्ते", language: "Hindi" }
  };
}
