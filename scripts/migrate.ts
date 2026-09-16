import { loadEnv } from "./load-env";
loadEnv();

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não configurada (verifique .env.local ou o ambiente do shell).");
    process.exit(1);
  }

  const client = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  });
  const db = drizzle(client);

  // Fail fast with a clear message if the connection itself is bad
  // (wrong host/credentials/network) instead of letting the migrator's
  // own error surface first, which can be harder to read.
  console.log("Verificando conexão com o banco...");
  await db.execute(sql`select 1`);

  console.log("Aplicando migrações...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrações aplicadas com sucesso.");

  // Real evidence the connection survives a transaction, not just a single
  // autocommit statement — exercises the same code path server actions use.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select 1`);
  });
  console.log("Transação de verificação concluída com sucesso.");

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
