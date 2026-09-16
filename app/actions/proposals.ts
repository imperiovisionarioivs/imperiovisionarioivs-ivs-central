"use server";

import { db } from "@/lib/db";
import { activities, clients, proposals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  proposalCreateSchema,
  proposalReviseSchema,
  proposalStatusUpdateSchema,
} from "@/lib/validation";

function formatValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "sem valor definido";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Only forward transitions are allowed from the UI; "aceita"/"recusada" are
// terminal for a given revision — a changed offer after that point is a new
// revision (reviseProposalAction), not a status edit on the closed one.
const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["enviada"],
  enviada: ["aceita", "recusada"],
  aceita: [],
  recusada: [],
};

export async function createProposalAction(input: unknown) {
  const user = await requirePermission("proposal.manage");
  const data = proposalCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [client] = await tx.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, data.clientId)).limit(1);
    if (!client) throw new Error("Cliente não encontrado");

    const [row] = await tx
      .insert(proposals)
      .values({
        clientId: data.clientId,
        rootId: 0, // placeholder — set to its own id immediately below
        revisionNumber: 1,
        isLatest: true,
        status: "rascunho",
        title: data.title,
        description: data.description,
        valueCents: data.valueCents ?? null,
        validUntil: data.validUntil,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: proposals.id });
    if (!row) throw new Error("Falha ao criar proposta");

    await tx.update(proposals).set({ rootId: row.id }).where(eq(proposals.id, row.id));

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: "nota",
      message: `Proposta criada: "${data.title}" (${formatValue(data.valueCents)})`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/propostas");
  return { ok: true, id };
}

/**
 * Cria uma NOVA revisão de uma proposta existente — nunca sobrescreve a
 * anterior. A revisão anterior é marcada como não-atual (isLatest=false) e
 * permanece no histórico com seu status final (ex.: "recusada"); a nova
 * revisão sempre nasce como "rascunho", porque representa uma oferta
 * revisada que ainda não foi enviada com os novos termos.
 */
export async function reviseProposalAction(input: unknown) {
  const user = await requirePermission("proposal.manage");
  const data = proposalReviseSchema.parse(input);

  const newId = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, data.proposalId), eq(proposals.isLatest, true)))
      .limit(1);
    if (!previous) throw new Error("Proposta não encontrada, ou já foi substituída por uma revisão mais nova");

    // Flip the previous revision to non-latest BEFORE inserting the new one
    // — proposals_latest_per_root_idx (a partial unique index) would reject
    // two is_latest=true rows for the same rootId at once, so order matters.
    await tx
      .update(proposals)
      .set({ isLatest: false, supersededAt: new Date() })
      .where(eq(proposals.id, previous.id));

    const [row] = await tx
      .insert(proposals)
      .values({
        clientId: previous.clientId,
        rootId: previous.rootId,
        revisionNumber: previous.revisionNumber + 1,
        isLatest: true,
        status: "rascunho",
        title: data.title,
        description: data.description,
        valueCents: data.valueCents ?? null,
        validUntil: data.validUntil,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: proposals.id });
    if (!row) throw new Error("Falha ao criar nova revisão");

    await tx.insert(activities).values({
      clientId: previous.clientId,
      type: "nota",
      message: `Nova revisão da proposta "${data.title}" (rev. ${previous.revisionNumber + 1}, ${formatValue(data.valueCents)})`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes`);
  revalidatePath("/propostas");
  return { ok: true, id: newId };
}

export async function updateProposalStatusAction(input: unknown) {
  const user = await requirePermission("proposal.manage");
  const { proposalId, status } = proposalStatusUpdateSchema.parse(input);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!current) throw new Error("Proposta não encontrada");
    if (!current.isLatest) throw new Error("Só é possível alterar o status da revisão mais recente");

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(`Transição inválida: "${current.status}" → "${status}"`);
    }

    await tx.update(proposals).set({ status }).where(eq(proposals.id, proposalId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Proposta "${current.title}" marcada como "${status}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath(`/clientes`);
  revalidatePath("/propostas");
  return { ok: true };
}
