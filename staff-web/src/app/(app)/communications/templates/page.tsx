import { TemplatesManager } from "@/components/communications/templates-manager";
import { WaTemplatesPanel } from "@/components/communications/wa-templates-panel";
import { fetchTemplates, fetchTemplateMessageStats } from "@/lib/comms-api";
import type { TemplateMessageStats } from "@/lib/comms-types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await fetchTemplates();

  // Delivery stats per template (sent/failed from the message log).
  const statsEntries = await Promise.all(
    templates.map(async (t) => [t.id, await fetchTemplateMessageStats(t.id)] as const)
  );
  const stats: Record<string, TemplateMessageStats> = Object.fromEntries(statsEntries);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Templates</h1>
        <p className="text-sm text-ink-muted">
          Reusable WhatsApp messages and call scripts that power your communication workflows.
        </p>
      </div>
      <TemplatesManager templates={templates} stats={stats} />
      <WaTemplatesPanel />
    </div>
  );
}
