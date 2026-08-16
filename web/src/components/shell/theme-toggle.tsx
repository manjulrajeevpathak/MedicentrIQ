"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  // Dark mode is scoped to the staff subtree (the [data-theme-root] wrapper in
  // app/staff/layout.tsx), NOT <html> — so it never bleeds into /console,
  // /clinician or /care, which share the same tokens but stay light.
  useEffect(() => {
    const root = document.querySelector("[data-theme-root]");
    setDark(root?.classList.contains("dark") ?? false);
  }, []);

  const toggle = () => {
    const root = document.querySelector("[data-theme-root]");
    if (!root) return;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    // Persist via cookie so the server renders the right class on the next request.
    document.cookie = `hcos-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-fill"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {dark === null ? <Sun className="size-[18px] opacity-0" /> : dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
