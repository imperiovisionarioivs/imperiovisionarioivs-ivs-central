import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * "The process is running" and "the database is reachable" are different
 * facts — the previous handler only ever reported the first one (it always
 * returned {ok:true} even if DATABASE_URL was missing or Postgres was
 * down), which makes it useless for telling a bad deploy apart from a
 * healthy one. This checks both and reports them separately, with the
 * database check bounded by a timeout so a hung connection doesn't hang
 * the health check itself.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: { ok: boolean; latencyMs?: number; error?: string };

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout (3s)")), 3000)),
    ]);
    database = { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    database = { ok: false, error: err instanceof Error ? err.message : "erro desconhecido" };
  }

  return NextResponse.json(
    {
      process: { ok: true },
      database,
      time: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 }
  );
}
