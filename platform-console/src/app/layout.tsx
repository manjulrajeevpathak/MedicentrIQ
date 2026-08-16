import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthFlow — Platform Console",
  description:
    "Superadmin console for the MedicentrIQ healthcare platform: onboard tenants, assign plan tiers, toggle feature modules.",
  applicationName: "HealthFlow Platform Console"
};

export const viewport: Viewport = {
  themeColor: "#356fe8",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
