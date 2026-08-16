import { redirect } from "next/navigation";

// Neutral landing for the unified app. Staff is the default face; patients,
// clinicians and superadmins arrive on their own prefixed deep-links.
export default function LandingPage() {
  redirect("/staff");
}
