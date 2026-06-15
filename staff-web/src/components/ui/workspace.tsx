"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * List + detail split layout shared by inbox, access, continuity, etc.
 * Collapses to stacked single-column below `lg`.
 */
export function SplitView({
  list,
  detail,
  listWidth = "380px",
  className
}: {
  list: ReactNode;
  detail: ReactNode;
  listWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-5", className)}
      style={{ gridTemplateColumns: undefined }}
    >
      <div className="grid grid-cols-1 gap-5 lg:[grid-template-columns:var(--lw)_minmax(0,1fr)]" style={{ ["--lw" as string]: `minmax(0,${listWidth})` }}>
        {list}
        {detail}
      </div>
    </div>
  );
}

export function ColumnFill({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex max-h-[calc(100dvh-12rem)] flex-col", className)}>{children}</div>;
}
