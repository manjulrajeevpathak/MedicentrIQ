"use client";

import type { DemoAuthContext } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";

// TODO: Restore these imports when the profile panel is re-enabled.
// import { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import { Building2, Check, ChevronDown, GitBranch, ShieldCheck } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { ACTIVE_USER_COOKIE } from "@/lib/constants";
// import { useApp } from "@/lib/store";
// import { Badge } from "@/components/ui/badge";

// TODO: Restore branch list when branch-switcher is re-enabled.
// const branches = [
//   { id: "blr-indiranagar", name: "Indiranagar Eye Centre" },
//   { id: "lko", name: "Lucknow" },
//   { id: "hyd", name: "Hyderabad" },
//   { id: "mum-thane", name: "Mumbai - Thane" }
// ];

const roleLabel: Record<string, string> = {
  front_desk: "Front desk",
  call_center: "Call center",
  care_coordinator: "Care coordinator",
  nurse: "Nurse",
  doctor: "Doctor",
  department_admin: "Dept admin",
  org_admin: "Org admin"
};

export function ContextSwitcher({ auth }: { auth: DemoAuthContext }) {
  // TODO: Wire this to the real user profile panel once auth is fully production-ready.
  // Re-enable the dropdown (open state, viewAs, branch switcher, permissions panel)
  // when the session comes from the real JWT rather than the demo cookie.

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
        <Avatar name={auth.activeUser.name} size="sm" />
        <div className="hidden text-left leading-tight sm:block">
          <p className="max-w-[120px] truncate text-xs font-semibold text-ink">{auth.activeUser.name}</p>
          <p className="max-w-[120px] truncate text-[11px] text-ink-muted">{roleLabel[auth.activeUser.role]}</p>
        </div>
      </div>

      {/* TODO: Expandable profile panel — commented out until production auth is wired.
      <button onClick={() => setOpen(o => !o)} ...>
        ...avatar + name + ChevronDown...
      </button>
      {open ? (
        <div ...dropdown with org context, permissions, branch switcher, view-as roles...>
        </div>
      ) : null}
      */}
    </div>
  );
}
