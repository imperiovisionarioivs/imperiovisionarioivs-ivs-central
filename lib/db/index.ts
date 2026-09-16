import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __ivsPgClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __ivsDb: Db | undefined;
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Configure a variável de ambiente com a connection string do Postgres."
    );
  }
  return url;
}

function createDb(): Db {
  const client =
    global.__ivsPgClient ??
    postgres(getConnectionString(), {
      max: process.env.NODE_ENV === "production" ? 5 : 1,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    });

  if (process.env.NODE_ENV !== "production") {
    global.__ivsPgClient = client;
  }

  return drizzle(client, { schema });
}

// Lazily instantiate the connection on first real use rather than at module
// load. Next.js loads every route module during the build's "Collecting
// page data" step (and some serverless cold-start paths do too) — if the
// Postgres client were created eagerly here, a build or boot without
// DATABASE_URL set would crash before a single request is served, even
// though nothing actually queried the database yet. Deferring construction
// to the first real query keeps builds resilient and still fails loudly,
// with a clear message, the moment a route actually needs the database.
function getDb(): Db {
  if (!global.__ivsDb) {
    global.__ivsDb = createDb();
  }
  return global.__ivsDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
