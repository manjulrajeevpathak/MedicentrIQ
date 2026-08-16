import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"),
  title: "HealthFlow — Staff Console",
  description:
    "Patient access and continuity operations console for Indian healthcare providers.",
  applicationName: "HealthFlow"
};

export const viewport: Viewport = {
  themeColor: "#356fe8",
  width: "device-width",
  initialScale: 1
};

// Theme is a cookie so the server renders the right <html> class directly —
// no FOUC and no hydration fight. Light is the default.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const dark = store.get("hcos-theme")?.value === "dark";

  return (
    <html lang="en" className={`${inter.variable}${dark ? " dark" : ""}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
