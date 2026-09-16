"use server";

import { db } from "@/lib/db";
import { activities, contracts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { contractCreateSchema, contractSignSchema, contractStatusUpdateSchema } from "@/lib/validation";

const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["enviado"],
  enviado: ["assinado", "rascunho"],
  assinado: ["encerrado"],
  encerrado: [],
};

export async function createContractAction(input: unknown) {
  const user = await requirePermission("contract.manage");
  const data = contractCreateSchema.parse(input);

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contracts)
      .values({
        clientId: data.clientId,
        proposalId: data.proposalId ?? null,
        title: data.title,
        valueCents: data.valueCents ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes,
        createdById: user.id,
        createdByName: user.name,
      })
      .returning({ id: contracts.id });
    if (!row) throw new Error("Falha ao criar contrato");

    await tx.insert(activities).values({
      clientId: data.clientId,
      type: "nota",
      message: `Contrato criado: "${data.title}"`,
      actorId: user.id,
      actorName: user.name,
    });

    return row.id;
  });

  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/contratos");
  return { ok: true, id };
}

export async function updateContractStatusAction(input: unknown) {
  const user = await requirePermission("contract.manage");
  const { contractId, status } = contractStatusUpdateSchema.parse(input);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!current) throw new Error("Contrato não encontrado");

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(`Transição inválida: "${current.status}" → "${status}"`);
    }

    await tx.update(contracts).set({ status, updatedAt: new Date() }).where(eq(contracts.id, contractId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Contrato "${current.title}" marcado como "${status}"`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/contratos");
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Registra a EVIDÊNCIA de uma assinatura feita fora deste app (provedor +
 * referência/link do documento assinado) e move o contrato para
 * "assinado". Este app não assina nada — não tem integração com nenhum
 * provedor de assinatura eletrônica nem armazenamento de arquivo; isto é um
 * registro do que já aconteceu em outro lugar.
 */
export async function signContractAction(input: unknown) {
  const user = await requirePermission("contract.manage");
  const { contractId, signerName, signatureProvider, signatureReference } = contractSignSchema.parse(input);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
    if (!current) throw new Error("Contrato não encontrado");
    if (current.status !== "enviado" && current.status !== "rascunho") {
      throw new Error(`Não é possível registrar assinatura a partir do status "${current.status}"`);
    }

    await tx
      .update(contracts)
      .set({
        status: "assinado",
        signedAt: new Date(),
        signerName,
        signatureProvider,
        signatureReference,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    await tx.insert(activities).values({
      clientId: current.clientId,
      type: "nota",
      message: `Contrato "${current.title}" assinado por ${signerName}${signatureProvider ? ` via ${signatureProvider}` : ""}`,
      actorId: user.id,
      actorName: user.name,
    });
  });

  revalidatePath("/contratos");
  revalidatePath("/clientes");
  return { ok: true };
}
