import "server-only";
import { db } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type ProposalRow = typeof proposals.$inferSelect;

/** A cliente's current (latest) proposal, if any exists. */
export async function getLatestProposalForClient(clientId: number): Promise<ProposalRow | null> {
  const rows = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.clientId, clientId), eq(proposals.isLatest, true)))
    .limit(1);
  return rows[0] ?? null;
}

/** Full revision history for one proposal series, oldest first. */
export async function getProposalRevisions(rootId: number): Promise<ProposalRow[]> {
  return db.select().from(proposals).where(eq(proposals.rootId, rootId)).orderBy(proposals.revisionNumber);
}

/** Every client's current proposal (for the /propostas overview list). */
export async function listLatestProposals(): Promise<ProposalRow[]> {
  return db.select().from(proposals).where(eq(proposals.isLatest, true)).orderBy(desc(proposals.createdAt));
}

export async function getProposal(id: number): Promise<ProposalRow | null> {
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return rows[0] ?? null;
}
