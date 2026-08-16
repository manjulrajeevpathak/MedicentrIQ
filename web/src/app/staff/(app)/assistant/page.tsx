import { Bot } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { fetchAssistant, fetchOptOuts } from "@/lib/assistant-api";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const [assistantResult, optOuts] = await Promise.all([fetchAssistant(), fetchOptOuts()]);

  if (!assistantResult.ok) {
    return (
      <Panel>
        <EmptyState
          icon={<Bot className="size-5" />}
          title="Couldn't load the assistant"
          description={assistantResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  return <AssistantWorkspace assistant={assistantResult.data} optOuts={optOuts} />;
}
