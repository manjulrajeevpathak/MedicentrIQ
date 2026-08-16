import { cn, titleCase } from "@clinician/lib/utils";

/** Maps a lifecycle stage to a semantic colour tone. */
function toneFor(stage?: string | null): string {
  const s = (stage ?? "").toLowerCase();
  if (["active", "engaged", "in_care"].includes(s)) return "bg-good-soft text-good";
  if (["discharged", "closed", "inactive"].includes(s)) return "bg-low-soft text-low";
  if (["lead", "new", "prospect"].includes(s)) return "bg-medium-soft text-medium";
  if (["at_risk", "overdue", "critical"].includes(s)) return "bg-critical-soft text-critical";
  return "bg-fill text-ink-soft";
}

export function StageChip({ stage }: { stage?: string | null }) {
  if (!stage) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneFor(stage)
      )}
    >
      {titleCase(stage)}
    </span>
  );
}
