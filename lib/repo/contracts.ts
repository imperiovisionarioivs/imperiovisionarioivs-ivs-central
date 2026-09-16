import "server-only";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export type ContractRow = typeof contracts.$inferSelect;

export async function getContractsForClient(clientId: number): Promise<ContractRow[]> {
  return db.select().from(contracts).where(eq(contracts.clientId, clientId)).orderBy(desc(contracts.createdAt));
}

export async function getContract(id: number): Promise<ContractRow | null> {
  const rows = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listContracts(): Promise<ContractRow[]> {
  return db.select().from(contracts).orderBy(desc(contracts.createdAt));
}
