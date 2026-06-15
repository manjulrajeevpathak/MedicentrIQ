"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    // Persist via cookie so the server renders the right <html> class on
    // the next request — same mechanism as the view-as demo user.
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
