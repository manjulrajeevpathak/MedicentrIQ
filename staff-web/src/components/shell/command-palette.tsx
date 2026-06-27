"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarClock,
  CornerDownLeft,
  Inbox,
  Search,
  User,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/ia";
import type { SearchEntry } from "./app-shell";

const kindMeta: Record<SearchEntry["kind"], { label: string; icon: LucideIcon }> = {
  patient: { label: "Patients", icon: User },
  conversation: { label: "Conversations", icon: Inbox },
  access: { label: "Access requests", icon: CalendarClock },
  journey: { label: "Journeys", icon: Activity }
};

type Row =
  | { type: "nav"; id: string; title: string; subtitle: string; href: string; icon: LucideIcon }
  | { type: "entry"; entry: SearchEntry; icon: LucideIcon };

export function CommandPalette({
  open,
  onClose,
  entries
}: {
  open: boolean;
  onClose: () => void;
  entries: SearchEntry[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const navRows: Row[] = navItems
      .filter((item) => !q || item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
      .map((item) => ({
        type: "nav",
        id: item.href,
        title: item.label,
        subtitle: item.description,
        href: item.href,
        icon: item.icon
      }));

    const entryRows: Row[] = entries
      .filter((entry) => !q || entry.title.toLowerCase().includes(q) || entry.subtitle.toLowerCase().includes(q))
      .slice(0, 24)
      .map((entry) => ({ type: "entry", entry, icon: kindMeta[entry.kind].icon }));

    return [...navRows, ...entryRows];
  }, [query, entries]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const go = (row: Row) => {
    onClose();
    router.push(row.type === "nav" ? row.href : row.entry.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === "Enter" && rows[active]) {
      event.preventDefault();
      go(rows[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command search"
        className="animate-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patients, conversations, queues, actions…"
            className="h-14 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
            Esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-ink-muted">No results for “{query}”.</p>
          ) : (
            rows.map((row, index) => {
              const Icon = row.icon;
              const title = row.type === "nav" ? row.title : row.entry.title;
              const subtitle = row.type === "nav" ? row.subtitle : row.entry.subtitle;
              const tag = row.type === "nav" ? "Go to" : kindMeta[row.entry.kind].label;
              const isActive = index === active;
              return (
                <button
                  key={`${row.type}-${row.type === "nav" ? row.id : row.entry.id}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(row)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition",
                    isActive ? "bg-brand-50" : "hover:bg-surface-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      isActive ? "bg-brand-100 text-brand-700" : "bg-fill text-ink-muted"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{title}</p>
                    <p className="truncate text-xs text-ink-muted">{subtitle}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-ink-faint">{tag}</span>
                  {isActive ? <CornerDownLeft className="size-3.5 shrink-0 text-brand-400" /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
