import { Suspense } from "react";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";

export default function InboxPage() {
  return (
    <Suspense>
      <InboxWorkspace />
    </Suspense>
  );
}
