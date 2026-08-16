import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@clinician/components/sw-register";

// Segment layout for the clinician PWA (/clinician). A fragment — the root
// layout owns <html>/<body> + Inter + globals. PWA meta is emitted via the
// metadata/viewport API (Next renders the head tags); manifest, icons and the
// service worker are all scoped under /clinician so the PWA never controls the
// other segments.
export const metadata: Metadata = {
  applicationName: "HealthFlow Clinician",
  title: "HealthFlow Clinician",
  description: "Find a patient, view clinical history, upload documents, and record a visit disposition.",
  manifest: "/clinician/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HealthFlow Clinician"
  },
  icons: {
    icon: "/clinician/icon-192.png",
    apple: "/clinician/icon-192.png"
  },
  other: { "mobile-web-app-capable": "yes" }
};

export const viewport: Viewport = {
  themeColor: "#356fe8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegister />
    </>
  );
}
