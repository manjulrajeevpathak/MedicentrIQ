import { Suspense } from "react";
import { AccessWorkspace } from "@/components/access/access-workspace";

export default function AccessPage() {
  return (
    <Suspense>
      <AccessWorkspace />
    </Suspense>
  );
}
