"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { CopilotDock } from "./copilot-dock";

export type SearchEntry = {
  id: string;
  title: string;
  subtitle: string;
  kind: "patient" | "conversation" | "access" | "journey" | "ai";
  href: string;
};

export type NavBadges = {
  workbench: number;
  inbox: number;
  access: number;
  continuity: number;
  ai: number;
};

export function AppShell({ children }: { children: ReactNode }) {
  const { data, badges } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const openCopilot = useCallback(() => setCopilotOpen(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setCopilotOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setCopilotOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchIndex = useMemo<SearchEntry[]>(
    () => [
      ...data.directory.map((p) => ({ id: p.id, title: p.name, subtitle: `${p.condition} · ${p.uhid}`, kind: "patient" as const, href: `/patients/${p.id}` })),
      ...data.inbox.map((c) => ({ id: c.id, title: c.patient, subtitle: `${c.intent} · ${c.channel}`, kind: "conversation" as const, href: `/inbox?sel=${c.id}` })),
      ...data.accessQueue.map((a) => ({ id: a.id, title: a.patient, subtitle: `${a.request} · ${a.branch}`, kind: "access" as const, href: `/access?sel=${a.id}` })),
      ...data.followUpQueue.map((f) => ({ id: f.id, title: f.patient, subtitle: `${f.journey} · ${f.stage}`, kind: "journey" as const, href: `/continuity?sel=${f.id}` })),
      ...data.recommendations.map((r) => ({ id: r.id, title: r.title, subtitle: `${r.patient} · ${r.confidence}% confidence`, kind: "ai" as const, href: `/ai-workbench?sel=${r.id}` }))
    ],
    [data]
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Sidebar
        auth={data.authContext}
        badges={badges}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          auth={data.authContext}
          source={data.source}
          generatedAt={data.generatedAt}
          onOpenCommand={openCommand}
          onOpenCopilot={openCopilot}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main id="main" className="flex-1 overflow-y-auto px-4 pb-12 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} entries={searchIndex} />
      <CopilotDock open={copilotOpen} onClose={() => setCopilotOpen(false)} userName={data.authContext.activeUser.name} />
    </div>
  );
}
