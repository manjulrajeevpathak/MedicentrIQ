import type { Metadata, Viewport } from "next";

// Segment layout for the patient care link (/care). A fragment — the root owns
// <html>/<body> + Inter + globals. The `.care-scope` wrapper carries the few
// patient-specific token/typography overrides so they don't touch other apps.
export const metadata: Metadata = {
  title: "Your care link — HealthFlow",
  applicationName: "HealthFlow"
};

export const viewport: Viewport = {
  themeColor: "#356fe8",
  width: "device-width",
  initialScale: 1
};

export default function CareLayout({ children }: { children: React.ReactNode }) {
  return <div className="care-scope min-h-dvh">{children}</div>;
}
