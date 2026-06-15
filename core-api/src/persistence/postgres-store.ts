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
  "apiKeys",
  "households",
  "patients",
  "interactions",
  "accessRequests",
  "appointments",
  "tasks",
  "sessions",
  "documents",
  "followUps",
  "journeyTemplates",
  "patientJourneys",
  "journeyTasks",
  "journeyEvents",
  "recommendations",
  "auditEvents"
];

export class PostgresPersistence implements CorePersistence {
  readonly mode = "postgres" as const;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number.parseInt(process.env.DATABASE_POOL_SIZE ?? "5", 10),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const record of records) {
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
          [
            collection,
            recordId(collection, record),
            tenantId(record),
            patientId(record),
            status(record),
            JSON.stringify(record)
          ]
        );
      }

      await client.query("COMMIT");
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
  }
}

function recordId(collection: CollectionName, record: unknown): string {
  if (!isRecord(record)) {
    throw new Error(`Cannot persist invalid ${collection} record.`);
  }

  const value = collection === "sessions" ? record.token : record.id;
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
