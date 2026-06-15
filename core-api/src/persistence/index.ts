import { InMemoryPersistence, type CorePersistence } from "./store.js";
import { PostgresPersistence } from "./postgres-store.js";

export type { CorePersistence } from "./store.js";

export const createPersistence = (): CorePersistence => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new PostgresPersistence(databaseUrl);
  }

  return new InMemoryPersistence();
};
