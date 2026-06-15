import { Suspense } from "react";
import { AiWorkbench } from "@/components/ai/ai-workbench";
import { getFeedbackOutcomes } from "@/lib/copilot";

export default async function AiWorkbenchPage() {
  const outcomes = await getFeedbackOutcomes();
  return (
    <Suspense>
      <AiWorkbench outcomes={outcomes} />
    </Suspense>
  );
}
