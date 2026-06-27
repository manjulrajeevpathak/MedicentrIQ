import type { RequestContext } from "../domain/types.js";

const postJson = async (url: string, payload: unknown, headers: Record<string, string> = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}`);
  }

  return response.json() as Promise<unknown>;
};

export class WorkflowClient {
  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string
  ) {}

  get isConfigured() {
    return Boolean(this.baseUrl);
  }

  async startWorkflow(type: string, payload: Record<string, unknown>, context: RequestContext): Promise<void> {
    if (!this.baseUrl) {
      return;
    }

    try {
      await postJson(
        `${this.baseUrl}/workflows/${encodeURIComponent(type)}/start`,
        {
          tenantId: context.tenantId,
          requestedBy: context.actorId,
          patientId: payload.patientId,
          trigger: String(payload.trigger ?? `${context.actorType}.${context.actorId}`),
          context: payload,
          payload
        },
        this.apiKey ? { "x-service-api-key": this.apiKey } : {}
      );
    } catch {
      // Outbound workflow dispatch is best effort in the MVP.
    }
  }
}

export type OutboundClients = {
  workflow: WorkflowClient;
};

export const createOutboundClients = (): OutboundClients => ({
  workflow: new WorkflowClient(process.env.WORKFLOW_WORKER_URL, process.env.WORKFLOW_SERVICE_API_KEY)
});
