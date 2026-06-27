import { Pool } from "pg";
import { createSeedData, normalizeSeedData, type SeedData } from "../domain/seed.js";
import type { CorePersistence, CollectionName } from "./store.js";

type PersistedRecord = {
  collection: CollectionName;
  record_id: string;
  payload: unknown;
};

const collections: CollectionName[] = [
  "organizations",
  "branches",
  "users",
  "platformAdmins",
  "loginChallenges",
  "passwordResetTokens",
  "channelConfigs",
  "messages",
  "apiKeys",
  "households",
  "patients",
  "interactions",
  "accessRequests",
  "doctors",
  "appointments",
  "tasks",
  "sessions",
  "clinicalRecords",
  "documents",
  "followUps",
  "invoices",
  "journeyTemplates",
  "patientJourneys",
  "journeyTasks",
  "journeyEvents",
  "leads",
  "forms",
  "campaigns",
  "auditEvents"
];

export class PostgresPersistence implements CorePersistence {
  readonly mode = "postgres" as const;
  private readonly pool: Pool;

  /**
   * Per-record snapshot of what was last persisted (recordId -> serialized payload),
   * keyed by collection. Lets saveCollection() write only the rows that actually
   * changed instead of rewriting the whole collection on every mutation.
   */
  private readonly persistedSnapshots = new Map<CollectionName, Map<string, string>>();

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "5", 10),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      // The trusted core-api role runs with platform scope so its boot load and
      // service-layer-filtered reads/writes see all tenants. RLS (see migrate())
      // is enforced as defense-in-depth: any connection WITHOUT this scope set
      // only sees rows for the tenant in `app.tenant_scope` (and global config).
      options: "-c app.tenant_scope=platform"
    });
  }

  async load(): Promise<SeedData> {
    await this.migrate();
    const count = await this.countRecords();
    if (count === 0) {
      const seed = normalizeSeedData(createSeedData());
      await this.saveAll(seed);
      return seed;
    }

    const normalized = normalizeSeedData(await this.loadExisting());
    await this.saveAll(normalized);
    return normalized;
  }

  async saveCollection<K extends CollectionName>(collection: K, records: SeedData[K]): Promise<void> {
    const previous = this.persistedSnapshots.get(collection) ?? new Map<string, string>();
    const next = new Map<string, string>();

    // Determine which rows are new/changed (upserts) and which disappeared (deletes),
    // so a mutation that touches one record writes one row — not the whole collection.
    const upserts: { id: string; record: unknown; payload: string }[] = [];
    for (const record of records) {
      const id = recordId(collection, record);
      const payload = JSON.stringify(record);
      next.set(id, payload);
      if (previous.get(id) !== payload) {
        upserts.push({ id, record, payload });
      }
    }
    const deletes: string[] = [];
    for (const id of previous.keys()) {
      if (!next.has(id)) {
        deletes.push(id);
      }
    }

    if (upserts.length === 0 && deletes.length === 0) {
      this.persistedSnapshots.set(collection, next);
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const { id, record, payload } of upserts) {
        await client.query(
          `INSERT INTO healthcareos_core_records
            (collection, record_id, tenant_id, patient_id, status, payload, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
           ON CONFLICT (collection, record_id)
           DO UPDATE SET
             tenant_id = EXCLUDED.tenant_id,
             patient_id = EXCLUDED.patient_id,
             status = EXCLUDED.status,
             payload = EXCLUDED.payload,
             updated_at = now()`,
          [collection, id, tenantId(record), patientId(record), status(record), payload]
        );
      }

      if (deletes.length > 0) {
        await client.query(
          "DELETE FROM healthcareos_core_records WHERE collection = $1 AND record_id = ANY($2::text[])",
          [collection, deletes]
        );
      }

      await client.query("COMMIT");
      this.persistedSnapshots.set(collection, next);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async saveAll(data: SeedData): Promise<void> {
    for (const collection of collections) {
      await this.saveCollection(collection, data[collection]);
    }
  }

  private async loadExisting(): Promise<SeedData> {
    const seed = createSeedData();
    const result = await this.pool.query<PersistedRecord>(
      "SELECT collection, record_id, payload FROM healthcareos_core_records ORDER BY collection, record_id"
    );

    for (const collection of collections) {
      seed[collection] = [] as never;
    }

    for (const row of result.rows) {
      if (collections.includes(row.collection)) {
        (seed[row.collection] as unknown[]).push(row.payload);
      }
    }

    return seed;
  }

  private async countRecords(): Promise<number> {
    const result = await this.pool.query<{ count: string }>("SELECT count(*) FROM healthcareos_core_records");
    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  private async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS healthcareos_core_records (
        collection text NOT NULL,
        record_id text NOT NULL,
        tenant_id text,
        patient_id text,
        status text,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, record_id)
      );

      ALTER TABLE healthcareos_core_records
        ADD COLUMN IF NOT EXISTS tenant_id text;

      CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_collection
        ON healthcareos_core_records (collection);

      CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_tenant
        ON healthcareos_core_records (tenant_id)
        WHERE tenant_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_patient
        ON healthcareos_core_records (patient_id)
        WHERE patient_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_status
        ON healthcareos_core_records (status)
        WHERE status IS NOT NULL;
    `);

    // Row-Level Security: tenant isolation enforced at the database (defense-in-depth).
    // A connection sees a row only if it runs with platform scope, the row is global
    // (tenant_id IS NULL), or the row's tenant matches `app.tenant_scope`. FORCE makes
    // this apply even to the table owner. core-api connects with platform scope (Pool
    // options) and additionally filters by tenant in the service layer.
    await this.pool.query(`
      ALTER TABLE healthcareos_core_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE healthcareos_core_records FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation ON healthcareos_core_records;
      CREATE POLICY tenant_isolation ON healthcareos_core_records
        USING (
          current_setting('app.tenant_scope', true) = 'platform'
          OR tenant_id IS NULL
          OR tenant_id = current_setting('app.tenant_scope', true)
        )
        WITH CHECK (
          current_setting('app.tenant_scope', true) = 'platform'
          OR tenant_id IS NULL
          OR tenant_id = current_setting('app.tenant_scope', true)
        );
    `);
  }
}

function recordId(collection: CollectionName, record: unknown): string {
  if (!isRecord(record)) {
    throw new Error(`Cannot persist invalid ${collection} record.`);
  }

  const tokenKeyed = collection === "sessions" || collection === "loginChallenges" || collection === "passwordResetTokens";
  // channelConfigs are one-per-tenant (keyed by tenantId); clinicalRecords are
  // one-per-patient (keyed by patientId).
  const value =
    collection === "channelConfigs"
      ? record.tenantId
      : collection === "clinicalRecords"
        ? record.patientId
        : tokenKeyed
          ? record.token
          : record.id;
  if (typeof value !== "string" || !value) {
    throw new Error(`Cannot persist ${collection} record without id.`);
  }

  return value;
}

function tenantId(record: unknown): string | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  return typeof record.tenantId === "string" ? record.tenantId : undefined;
}

function patientId(record: unknown): string | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  return typeof record.patientId === "string" ? record.patientId : undefined;
}

function status(record: unknown): string | undefined {
  if (!isRecord(record)) {
    return undefined;
  }

  return typeof record.status === "string" ? record.status : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
