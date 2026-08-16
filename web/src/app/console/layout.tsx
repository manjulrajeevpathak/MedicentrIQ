import type { Metadata, Viewport } from "next";

// Segment layout for the platform superadmin console (/console). A fragment —
// the root layout owns <html>/<body> and loads globals + Inter. This console is
// light-only; it inherits the shared design tokens.
export const metadata: Metadata = {
  title: "HealthFlow — Platform Console",
  description:
    "Superadmin console for the MedicentrIQ healthcare platform: onboard tenants, assign plan tiers, toggle feature modules.",
  applicationName: "HealthFlow Platform Console"
};

export const viewport: Viewport = {
  themeColor: "#356fe8"
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
