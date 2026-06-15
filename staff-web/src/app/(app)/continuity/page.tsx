import { Suspense } from "react";
import { ContinuityWorkspace } from "@/components/continuity/continuity-workspace";

export default function ContinuityPage() {
  return (
    <Suspense>
      <ContinuityWorkspace />
    </Suspense>
  );
}
