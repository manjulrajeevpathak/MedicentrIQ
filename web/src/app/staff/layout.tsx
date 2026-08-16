import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "HealthFlow — Staff Console",
  description:
    "Patient access and continuity operations console for Indian healthcare providers."
};

export const viewport: Viewport = {
  themeColor: "#356fe8"
};

// Staff-scoped layout. Dark mode is a cookie applied HERE (on a wrapper), not on
// <html>, so a staff dark preference never bleeds into /console, /clinician or
// /care — which share the same design tokens but are light-only.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const dark = store.get("hcos-theme")?.value === "dark";

  return (
    <div data-theme-root className={cn("min-h-dvh bg-canvas", dark && "dark")}>
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
