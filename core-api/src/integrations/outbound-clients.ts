import type { Interaction, RequestContext } from "../domain/types.js";

type DatacentrIQIntentResponse = {
  data?: {
    intent?: string;
    primaryIntent?: string;
    urgency?: string;
  };
  confidence?: number;
  decisionTrace?: {
    traceId?: string;
  };
};

export type ExtractedIntent = {
  intent?: string;
  urgency?: string;
  confidence?: number;
  traceId?: string;
};

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

export class DatacentrIQClient {
  constructor(
    private readonly baseUrl?: string,
    private readonly apiKey?: string
  ) {}

  get isConfigured() {
    return Boolean(this.baseUrl);
  }

  async extractIntent(interaction: Pick<Interaction, "subject" | "body" | "channel" | "language">): Promise<ExtractedIntent | undefined> {
    if (!this.baseUrl) {
      return undefined;
    }

    try {
      const result = (await postJson(`${this.baseUrl}/v1/copilot/extract-intent`, {
        text: `${interaction.subject}\n${interaction.body}`,
        channel: interaction.channel,
        language: interaction.language
      }, this.apiKey ? { "x-service-api-key": this.apiKey } : {})) as DatacentrIQIntentResponse;

      return {
        intent: result.data?.intent ?? result.data?.primaryIntent,
        urgency: result.data?.urgency,
        confidence: result.confidence,
        traceId: result.decisionTrace?.traceId
      };
    } catch {
      return undefined;
    }
  }
}

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
  datacentriq: DatacentrIQClient;
  workflow: WorkflowClient;
};

export const createOutboundClients = (): OutboundClients => ({
  datacentriq: new DatacentrIQClient(process.env.DATACENTRIQ_GATEWAY_URL, process.env.DATACENTRIQ_SERVICE_API_KEY),
  workflow: new WorkflowClient(process.env.WORKFLOW_WORKER_URL, process.env.WORKFLOW_SERVICE_API_KEY)
});
