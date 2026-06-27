import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService } from "../src/services/core-service.js";

type JsonObject = Record<string, unknown>;

describe("continuity + billing contract", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;
  let followUpId: string;
  let invoiceId: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "continuity_billing_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";
    const service = await createCoreService();
    server = createApiServer(service);
    baseUrl = await listen(server);

    const res = await fetch(`${baseUrl}/auth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "org_demo_healthcare", userId: "user_demo_admin", expiresInSeconds: 900 })
    });
    token = String(((await res.json()) as { data: JsonObject }).data.accessToken);
  });

  after(async () => {
    await close(server);
    restoreEnv(previousEnv);
  });

  const authed = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }
    });

  // ---- Continuity follow-ups ----

  it("lists seeded follow-ups with patient name resolved", async () => {
    const body = (await (await authed("/followups")).json()) as { data: JsonObject[] };
    assert.ok(Array.isArray(body.data));
    const seeded = body.data.find((f) => f.id === "followup_demo_001");
    assert.ok(seeded);
    assert.equal(seeded?.patientName, "Anita Sharma");
  });

  it("filters follow-ups by status", async () => {
    const body = (await (await authed("/followups?status=due")).json()) as { data: JsonObject[] };
    assert.ok(body.data.every((f) => f.status === "due"));
  });

  it("creates a follow-up", async () => {
    const res = await authed("/followups", {
      method: "POST",
      body: JSON.stringify({
        patientId: "patient_demo_001",
        title: "Eye drop adherence check",
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        instructions: "Confirm patient is using drops thrice daily."
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    followUpId = String(body.data.id);
    assert.ok(followUpId.startsWith("followup_"));
    assert.equal(body.data.status, "due");
    assert.equal(body.data.patientName, "Anita Sharma");
  });

  it("patches a follow-up status to confirmed", async () => {
    const res = await authed(`/followups/${followUpId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed", instructions: "Confirmed adherence." })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.status, "confirmed");
    assert.ok(typeof body.data.confirmedAt === "string");
    assert.equal(body.data.instructions, "Confirmed adherence.");
  });

  // ---- Billing ----

  it("creates an invoice and computes total + unpaid status", async () => {
    const res = await authed("/invoices", {
      method: "POST",
      body: JSON.stringify({
        patientId: "patient_demo_001",
        items: [
          { description: "OPD consult", amount: 600 },
          { description: "OCT scan", amount: 1400 }
        ]
      })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    invoiceId = String(body.data.id);
    assert.ok(invoiceId.startsWith("invoice_"));
    assert.equal(body.data.total, 2000);
    assert.equal(body.data.amountSettled, 0);
    assert.equal(body.data.status, "unpaid");
    assert.equal(body.data.patientName, "Anita Sharma");
  });

  it("records a partial payment (status partial)", async () => {
    const res = await authed(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount: 500, method: "cash" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.amountSettled, 500);
    assert.equal(body.data.status, "partial");
    assert.equal((body.data.payments as JsonObject[]).length, 1);
  });

  it("records the rest (status paid)", async () => {
    const res = await authed(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount: 1500, method: "upi" })
    });
    const body = (await res.json()) as { data: JsonObject };
    assert.equal(res.status, 200);
    assert.equal(body.data.amountSettled, 2000);
    assert.equal(body.data.status, "paid");
  });

  it("rejects overpayment beyond the total (400)", async () => {
    const res = await authed(`/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });
    assert.equal(res.status, 400);
  });

  it("returns a tenant billing summary", async () => {
    const body = (await (await authed("/billing/summary")).json()) as {
      data: { billed: number; settled: number; outstanding: number; unpaidCount: number };
    };
    assert.equal(body.data.outstanding, body.data.billed - body.data.settled);
    // Seeded invoice_demo_001 is partial (15800 outstanding); ours is now paid.
    assert.ok(body.data.outstanding >= 15800);
    assert.ok(body.data.unpaidCount >= 1);
  });

  it("returns a patient invoice list with a summary", async () => {
    const body = (await (await authed("/patients/patient_demo_001/invoices")).json()) as {
      data: { invoices: JsonObject[]; summary: { billed: number; settled: number; outstanding: number } };
    };
    assert.ok(body.data.invoices.length >= 3);
    assert.equal(body.data.summary.outstanding, body.data.summary.billed - body.data.summary.settled);
    assert.ok(body.data.summary.billed >= body.data.summary.settled);
  });
});

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}
function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
}
