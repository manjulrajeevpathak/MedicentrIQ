import { createSeedData, normalizeSeedData, type SeedData } from "../domain/seed.js";

export type CollectionName = keyof SeedData;

export interface CorePersistence {
  readonly mode: "in-memory" | "postgres";
  load(): Promise<SeedData>;
  saveCollection<K extends CollectionName>(collection: K, records: SeedData[K]): Promise<void>;
}

export class InMemoryPersistence implements CorePersistence {
  readonly mode = "in-memory" as const;

  async load(): Promise<SeedData> {
    return normalizeSeedData(createSeedData());
  }

  async saveCollection(): Promise<void> {
    // In-memory mode keeps state inside the running process only.
  }
}
