import type { AppointmentSlot, PatientLinkState } from "./types";

/**
 * Demo session — Anita Sharma, ophthalmology review. Renders the focused
 * appointment surface when NEXT_PUBLIC_CORE_API_URL is unset (or unreachable).
 */
export function mockPatientLink(token: string): PatientLinkState {
  const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  // A fixed UTC wall-clock so the demo time renders consistently.
  const scheduledAt = "2026-07-04T11:20:00Z";
  return {
    source: "mock",
    linkStatus: "active",
    secureLink: {
      tokenPreview: token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token,
      expiresAt,
      allowedActions: ["confirm_appointment", "reschedule_request", "upload_document_metadata"],
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
      maskedPhone: "+91 ******0442"
    },
    appointment: {
      id: "APT-5520",
      status: "scheduled",
      scheduledAt,
      displayDate: "Saturday, 4 July",
      displayTime: "11:20 AM",
      doctorName: "Dr. Kavita Menon",
      department: "Ophthalmology · post-op review",
      branchName: "Indiranagar Eye Centre",
      address: "100 Ft Road, Indiranagar, Bengaluru 560038",
      mapUrl: "https://maps.google.com/?q=Indiranagar+Eye+Centre+Bengaluru"
    },
    greeting: { vernacular: "नमस्ते", language: "Hindi" }
  };
}

/** Demo slot grid for the slot picker when running without a live API. */
export function mockAppointmentSlots(dateISO: string): AppointmentSlot[] {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : new Date().toISOString().slice(0, 10);
  const times = ["09:30", "10:00", "10:30", "11:00", "11:45", "12:15", "15:00", "15:30", "16:00"];
  return times.map((hhmm) => ({
    start: `${base}T${hhmm}:00Z`,
    end: `${base}T${hhmm}:00Z`
  }));
}
