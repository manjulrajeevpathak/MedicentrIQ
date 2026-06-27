import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { WorkflowClient } from "../src/integrations/outbound-clients.js";
import type { RequestContext } from "../src/domain/types.js";

type JsonObject = Record<string, unknown>;

describe("core-api outbound service client contracts", () => {
  let workflowServer: Server;
  let workflowUrl: string;
  const workflowRequests: Array<{ headers: JsonObject; body: JsonObject; url?: string }> = [];

  before(async () => {
    workflowServer = createServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/workflows/post-visit-follow-up/start") {
        const body = await readJson(request);
        workflowRequests.push({ headers: request.headers as JsonObject, body, url: request.url });
        response.writeHead(request.headers["x-service-api-key"] === "workflow_contract_key" ? 202 : 401, {
          "content-type": "application/json"
        });
        response.end(JSON.stringify({ service: "workflow-worker", accepted: true }));
        return;
      }
      response.writeHead(404).end();
    });
    workflowUrl = await listen(workflowServer);
  });

  after(async () => {
    await close(workflowServer);
  });

  it("starts workflow-worker runs with top-level routing fields and context payload", async () => {
    const client = new WorkflowClient(workflowUrl, "workflow_contract_key");
    const context: RequestContext = {
      actorType: "staff",
      tenantId: "org_demo_healthcare",
      actorId: "user_demo_admin",
      displayName: "Demo Org Admin",
      roles: ["org_admin"],
      branchIds: ["blr-indiranagar"],
      permissions: [],
      isDemoMode: true,
      source: "demo_headers"
    };

    await client.startWorkflow(
      "post-visit-follow-up",
      {
        patientId: "patient_demo_001",
        followUpId: "followup_demo_001",
        trigger: "contract.core_outbound"
      },
      context
    );

    assert.equal(workflowRequests.length, 1);
    assert.equal(workflowRequests[0].headers["x-service-api-key"], "workflow_contract_key");
    assert.equal(workflowRequests[0].body.tenantId, "org_demo_healthcare");
    assert.equal(workflowRequests[0].body.patientId, "patient_demo_001");
    assert.equal(workflowRequests[0].body.trigger, "contract.core_outbound");
    assert.equal((workflowRequests[0].body.context as JsonObject).followUpId, "followup_demo_001");
    assert.equal((workflowRequests[0].body.payload as JsonObject).patientId, "patient_demo_001");
  });
});

async function readJson(request: NodeJS.ReadableStream): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as JsonObject;
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
