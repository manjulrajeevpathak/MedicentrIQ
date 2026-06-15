"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, Search, Sparkles } from "lucide-react";
import { findNavItem } from "@/lib/ia";
import type { DemoAuthContext } from "@/lib/types";
import { ContextSwitcher } from "./context-switcher";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  auth,
  source,
  generatedAt,
  onOpenCommand,
  onOpenCopilot,
  onOpenMobileNav
}: {
  auth: DemoAuthContext;
  source: "core-api" | "mock";
  generatedAt: string;
  onOpenCommand: () => void;
  onOpenCopilot: () => void;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = findNavItem(pathname);
  const live = source === "core-api";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        onClick={onOpenMobileNav}
        className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-fill md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{nav?.label ?? "Today"}</h1>
        <p className="hidden truncate text-xs text-ink-muted sm:block">{nav?.description}</p>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          onClick={onOpenCommand}
          className="group hidden h-9 w-56 items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 text-sm text-ink-faint transition hover:border-line-strong hover:bg-surface lg:flex xl:w-72"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search patients, queues…</span>
          <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-muted">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onOpenCommand}
          className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-fill lg:hidden"
          aria-label="Search"
        >
          <Search className="size-5" />
        </button>

        <button
          onClick={onOpenCopilot}
          className="group flex h-9 items-center gap-1.5 rounded-xl bg-ai-gradient px-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110"
          title="Ask HealthcareOS Copilot (⌘J)"
        >
          <Sparkles className="size-4" />
          <span className="hidden xl:inline">Ask AI</span>
        </button>

        <ThemeToggle />

        <StatusPill live={live} generatedAt={generatedAt} />

        <div className="h-6 w-px bg-line" />

        <ContextSwitcher auth={auth} />

        <button
          onClick={handleLogout}
          className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-fill"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

function StatusPill({ live, generatedAt }: { live: boolean; generatedAt: string }) {
  // Locale time formatting can differ between the Node SSR render and the
  // browser (timezone / 12h-vs-24h locale defaults), so resolve it only after
  // mount. SSR + first client render show no time, keeping hydration in sync.
  const [time, setTime] = useState("");
  useEffect(() => {
    try {
      setTime(new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setTime("");
    }
  }, [generatedAt]);

  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 sm:flex"
      title={live ? "Connected to core-api" : "Rich demo data (core-api not connected)"}
    >
      <span className="relative flex size-2">
        <span
          className={`absolute inline-flex size-2 rounded-full ${live ? "bg-[var(--color-good)]" : "bg-[var(--color-high)]"} animate-pulse-ring`}
        />
        <span className={`relative inline-flex size-2 rounded-full ${live ? "bg-[var(--color-good)]" : "bg-[var(--color-high)]"}`} />
      </span>
      <span className="text-[11px] font-medium text-ink-soft">{live ? "Live" : "Demo"}</span>
      {time ? <span className="text-[11px] tabular-nums text-ink-faint">· {time}</span> : null}
    </div>
  );
}
