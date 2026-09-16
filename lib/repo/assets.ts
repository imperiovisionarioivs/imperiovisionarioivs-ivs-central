import "server-only";
import { db } from "@/lib/db";
import { assets, ASSET_STATUSES } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export type AssetRow = typeof assets.$inferSelect;

const DONE_STATUSES = new Set<string>(ASSET_STATUSES.filter((s) => s.done).map((s) => s.key));

export function isAssetDone(status: string): boolean {
  return DONE_STATUSES.has(status as (typeof ASSET_STATUSES)[number]["key"]);
}

export async function getAssetsForClient(clientId: number): Promise<AssetRow[]> {
  return db.select().from(assets).where(eq(assets.clientId, clientId)).orderBy(desc(assets.createdAt));
}

export async function getAsset(id: number): Promise<AssetRow | null> {
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listAssets(): Promise<AssetRow[]> {
  return db.select().from(assets).orderBy(desc(assets.updatedAt));
}

/** Ativos com renovação nos próximos `days` dias (padrão 30) — string de
 *  data "YYYY-MM-DD" comparada lexicograficamente, mesma técnica usada na
 *  agenda do CRM para datas guardadas como texto. */
export async function listUpcomingRenewals(days = 30): Promise<AssetRow[]> {
  const all = await listAssets();
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  const todayStr = today.toISOString().slice(0, 10);
  const limitStr = limit.toISOString().slice(0, 10);
  return all
    .filter((a) => a.renewalDate && a.renewalDate >= todayStr && a.renewalDate <= limitStr)
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
}
