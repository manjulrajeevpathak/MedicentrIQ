"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import type { Branch } from "@/lib/users-types";
import { saveBranchContactAction } from "@/app/staff/(app)/admin/actions";

const textareaCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200 min-h-[72px] resize-y disabled:cursor-not-allowed disabled:opacity-60";

type Props = { branches: Branch[] };

/**
 * Admin → Clinic locations. Per-branch contact + map editor. The saved values
 * feed the {{address}} / {{mapLink}} / {{clinicPhone}} appointment tokens and
 * the patient confirm page.
 */
export function LocationsPanel({ branches }: Props) {
  const { toast } = useToast();

  return (
    <Panel padded={false}>
      <div className="p-4 pb-3">
        <SectionTitle
          icon={<MapPin className="size-4" />}
          title="Clinic locations"
          subtitle="Contact details and directions sent to patients"
        />
        <p className="mt-2 text-[11px] text-ink-muted">
          Used in appointment messages (<span className="font-mono">{"{{address}}"}</span>,{" "}
          <span className="font-mono">{"{{mapLink}}"}</span>) and the patient confirm page.
        </p>
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-5" />}
          title="No branches yet"
          description="Branches for this tenant will appear here once they exist."
        />
      ) : (
        <div className="space-y-4 p-4 pt-1">
          {branches.map((branch) => (
            <BranchRow key={branch.id} branch={branch} onToast={toast} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function BranchRow({
  branch,
  onToast
}: {
  branch: Branch;
  onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [mapUrl, setMapUrl] = useState(branch.mapUrl ?? "");
  const [timings, setTimings] = useState(branch.timings ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveBranchContactAction(branch.id, { phone, address, mapUrl, timings });
      if (!result.ok) {
        onToast(result.error ?? "Could not save the location.", "error");
        return;
      }
      // Reflect the server-normalised (trimmed/cleared) values.
      setPhone(result.branch?.phone ?? "");
      setAddress(result.branch?.address ?? "");
      setMapUrl(result.branch?.mapUrl ?? "");
      setTimings(result.branch?.timings ?? "");
      onToast(result.message ?? "Location saved.", "success");
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{branch.displayName}</p>
          {branch.city ? <p className="text-[11px] text-ink-muted">{branch.city}</p> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Phone" htmlFor={`phone-${branch.id}`}>
          <Input
            id={`phone-${branch.id}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 80 1234 5678"
            disabled={pending}
          />
        </Field>
        <Field label="Google Maps link" htmlFor={`map-${branch.id}`}>
          <Input
            id={`map-${branch.id}`}
            value={mapUrl}
            onChange={(e) => setMapUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/…"
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Clinic timings" htmlFor={`timings-${branch.id}`}>
          <Input
            id={`timings-${branch.id}`}
            value={timings}
            onChange={(e) => setTimings(e.target.value)}
            placeholder="Mon–Sat 9am–7pm · Sunday closed"
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Address" htmlFor={`address-${branch.id}`}>
          <textarea
            id={`address-${branch.id}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, area, city, PIN"
            disabled={pending}
            className={textareaCls}
          />
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
