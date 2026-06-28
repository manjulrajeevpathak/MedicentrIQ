import { WorkflowsBuilder } from "@/components/communications/workflows-builder";
import { fetchTemplates, fetchWorkflows } from "@/lib/comms-api";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const [workflows, templates] = await Promise.all([fetchWorkflows(), fetchTemplates()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Workflows</h1>
        <p className="text-sm text-ink-muted">
          Orchestrate staged messages, calls, forms and tasks across the patient lifecycle.
        </p>
      </div>
      <WorkflowsBuilder workflows={workflows} templates={templates} />
    </div>
  );
}
