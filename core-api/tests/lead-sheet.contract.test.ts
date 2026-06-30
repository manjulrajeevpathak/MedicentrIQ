import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { createApiServer } from "../src/http/router.js";
import { createCoreService, parseCsv, type CoreService } from "../src/services/core-service.js";
import type { LeadSheetConfig } from "../src/domain/types.js";

type JsonObject = Record<string, unknown>;

describe("lead-sheet ingest contract (CRM Phase 3)", () => {
  let server: Server;
  let service: CoreService;
  let baseUrl: string;
  let token: string;
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    ALLOW_DEMO_SESSION_ISSUER: process.env.ALLOW_DEMO_SESSION_ISSUER
  };

  before(async () => {
    delete process.env.DATABASE_URL;
    process.env.STAFF_SESSION_SECRET = "lead_sheet_contract_secret";
    process.env.ALLOW_DEMO_SESSION_ISSUER = "true";
    service = await createCoreService();
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

  it("GET /tenant/lead-sheet returns a disabled default", async () => {
    const body = (await (await authed("/tenant/lead-sheet")).json()) as { data: LeadSheetConfig };
    assert.equal(body.data.enabled, false);
    assert.deepEqual(body.data.importedKeys, []);
    assert.deepEqual(body.data.mapping, {});
  });

  it("PATCH /tenant/lead-sheet connects a sheet and GET reflects it", async () => {
    const res = await authed("/tenant/lead-sheet", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: true,
        csvUrl: "https://docs.google.com/spreadsheets/d/abc/pub?output=csv",
        mapping: { name: "Full Name", phone: "Mobile", email: "Email" },
        sourceKey: "camp_self"
      })
    });
    assert.equal(res.status, 200);
    const reflected = (await (await authed("/tenant/lead-sheet")).json()) as { data: LeadSheetConfig };
    assert.equal(reflected.data.enabled, true);
    assert.equal(reflected.data.csvUrl, "https://docs.google.com/spreadsheets/d/abc/pub?output=csv");
    assert.deepEqual(reflected.data.mapping, { name: "Full Name", phone: "Mobile", email: "Email" });
    assert.equal(reflected.data.sourceKey, "camp_self");
  });

  it("PATCH /tenant/lead-sheet rejects a non-http csvUrl", async () => {
    const res = await authed("/tenant/lead-sheet", {
      method: "PATCH",
      body: JSON.stringify({ csvUrl: "not-a-url" })
    });
    assert.equal(res.status, 400);
  });

  it("PATCH /tenant/lead-sheet rejects an unknown sourceKey", async () => {
    const res = await authed("/tenant/lead-sheet", {
      method: "PATCH",
      body: JSON.stringify({ sourceKey: "no_such_source" })
    });
    assert.equal(res.status, 400);
  });

  it("parseCsv handles quoted fields, embedded commas, and CRLF", () => {
    const csv = 'Full Name,Mobile,Email\r\n"Doe, Jane",+91 90000 11111,jane@x.com\r\nRavi,9000022222,\r\n';
    const rows = parseCsv(csv);
    assert.deepEqual(rows[0], ["Full Name", "Mobile", "Email"]);
    assert.deepEqual(rows[1], ["Doe, Jane", "+91 90000 11111", "jane@x.com"]);
    assert.deepEqual(rows[2], ["Ravi", "9000022222", ""]);
    assert.equal(rows.length, 3); // trailing newline does not yield an empty row
  });

  it("ingestSheetRows imports new rows, dedups by phone, and is idempotent on re-run", async () => {
    const context = service.authenticate({ authorization: `Bearer ${token}` });
    const mapping = { name: "Full Name", phone: "Mobile", email: "Email" };
    const config: LeadSheetConfig = {
      tenantId: context.tenantId,
      enabled: true,
      csvUrl: "https://example.test/pub?output=csv",
      mapping,
      sourceKey: "camp_self",
      importedKeys: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 3 data rows, two of which share the same normalized phone (one duplicate).
    const csv = [
      "Full Name,Mobile,Email",
      "Asha Verma,+91 98765 43210,asha@example.com",
      "Bilal Khan,9000012345,bilal@example.com",
      "Asha (dup),098765 43210,asha2@example.com"
    ].join("\n");
    const rows = parseCsv(csv);

    const before = service.listLeads(context).length;
    const result = await service.ingestSheetRows(context, config, rows);
    assert.deepEqual(result, { imported: 2, skipped: 1, total: 3 });

    const leads = service.listLeads(context);
    assert.equal(leads.length, before + 2);
    const created = leads.filter((l) => l.email === "asha@example.com" || l.email === "bilal@example.com");
    assert.equal(created.length, 2);
    for (const lead of created) {
      assert.equal(lead.source, "camp_self");
      assert.equal(lead.intake, "google_sheet");
    }
    // importedKeys now carries the two normalized phones.
    assert.equal(config.importedKeys.length, 2);

    // Re-running the SAME rows imports 0 (dedup via importedKeys).
    const second = await service.ingestSheetRows(context, config, rows);
    assert.deepEqual(second, { imported: 0, skipped: 3, total: 3 });
    assert.equal(service.listLeads(context).length, before + 2);
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
