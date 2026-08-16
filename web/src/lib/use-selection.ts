"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-backed selection for split-pane workspaces. The selected item id lives in
 * the `?sel=` query param so selection is deep-linkable, survives refresh, and
 * lets the command palette open a specific item. Falls back to `defaultId`.
 */
export function useSelection(defaultId?: string): {
  selectedId: string;
  select: (id: string) => void;
  clear: () => void;
  hasSelection: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("sel");
  const selectedId = fromUrl ?? defaultId ?? "";

  const setParam = useCallback(
    (value: string | null) => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (value) next.set("sel", value);
      else next.delete("sel");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  return {
    selectedId,
    select: useCallback((id: string) => setParam(id), [setParam]),
    clear: useCallback(() => setParam(null), [setParam]),
    hasSelection: fromUrl != null
  };
}
